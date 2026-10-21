import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { historico } from "./persistencia";
import { ErroPedidoVenda, type PedidoEntrada } from "./pedidos-dominio";
import { entregasVazias, validarConfiguracaoEntregas, validarEnderecoEntrega, pendenciasEntregas, textoEndereco, enderecoPreciso, memoriaPendente, regrasAplicaveis, excecaoComercialEntrega, precificarEntrega, cents, moedaCentavos, type MemoriaEntrega, type EnderecoEntrega } from "./entregas-dominio";
import { GoogleRotas, FalhaMapas, integracaoMapasPronta, type RotaEntrega, type ProvedorRotas } from "./entregas-mapas";
import { assinaturaEntradas, assinarEntrega, verificarEntrega } from "./entregas-recibo";
import { selecionarVeiculoEntrega, type SelecaoVeiculoEntrega } from "./entregas-veiculos";
type Tx = Prisma.TransactionClient;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function autorEntregas(tx: Tx, sessao: SessaoAtual, recurso: string, acao: "visualizar" | "editar" | "adicionar" = "editar") {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0) || (u.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, u.permissoesPersonalizadas as Excecoes, recurso, acao))) throw new ErroPedidoVenda("Seu acesso não permite esta operação de entregas.");
  return { userId: u.id, nome: u.nome };
}
export async function consultarEntregas() {
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { entregas: true, versaoEntregas: true, endereco: true, nome: true, enderecoEstruturado: true } });
  const config = loja?.entregas ? validarConfiguracaoEntregas(loja.entregas) : entregasVazias();
  const enderecoLoja = loja?.enderecoEstruturado ? validarEnderecoEntrega(loja.enderecoEstruturado) : null;
  const origemLoja = config.modelo === "SLOTS" ? enderecoPreciso(enderecoLoja) ? textoEndereco(enderecoLoja!) : "" : loja?.endereco ?? "";
  return { config, versao: loja?.versaoEntregas ?? 0, origemLoja, nomeLoja: loja?.nome ?? "Grazing Table & Co", enderecoLoja, enderecoLojaLegado: loja?.endereco ?? "", mapasProntos: integracaoMapasPronta(), pendencias: [...pendenciasEntregas(config, origemLoja), ...(!integracaoMapasPronta() ? ["Integração Google Maps pendente de configuração"] : [])] };
}
export async function salvarEntregas(valor: unknown, versao: number, sessao: SessaoAtual) {
  const config = validarConfiguracaoEntregas(valor);
  if (!Number.isSafeInteger(versao) || versao < 0) throw new ErroPedidoVenda("Versão de configuração inválida.");
  return prisma.$transaction(async tx => {
    const autor = await autorEntregas(tx, sessao, "vendas.area-entrega");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('embalagens-venda'))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('entregas-config'))`;
    const antes = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" } });
    if ((antes?.versaoEntregas ?? 0) !== versao) throw new ErroPedidoVenda("Entregas foram alteradas em outra tela. Reabra antes de salvar.");
    const idsEmbalagem = (config.regrasVeiculo ?? []).map(r => r.tipoEmbalagemId);
    if (idsEmbalagem.length) {
      const tipos = await tx.tipoEmbalagemVenda.findMany({ where: { id: { in: idsEmbalagem } }, select: { id: true, ativo: true } });
      if (config.regrasVeiculo!.some(r => !tipos.some(t => t.id === r.tipoEmbalagemId && (!r.ativo || t.ativo)))) throw new ErroPedidoVenda("Regras de veículo exigem tipos de embalagem existentes e ativos.");
    }
    const enderecoLoja = antes?.enderecoEstruturado ? validarEnderecoEntrega(antes.enderecoEstruturado) : null;
    const origemLoja = config.modelo === "SLOTS" ? enderecoPreciso(enderecoLoja) ? textoEndereco(enderecoLoja!) : "" : antes?.endereco ?? "";
    if (config.ativo && (pendenciasEntregas(config, origemLoja).length || !integracaoMapasPronta())) throw new ErroPedidoVenda("Complete origem, capacidades dos veículos, frete e integração antes de ativar o cálculo automático.");
    await tx.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { entregas: json(config), versaoEntregas: 1 }, update: { entregas: json(config), versaoEntregas: { increment: 1 } } });
    await historico(tx, autor, "ENTREGAS", "singleton", { config: antes?.entregas ?? null, versao }, { config, versao: versao + 1 });
    return { versao: versao + 1, config };
  });
}
/** Cota compartilhada pelo cálculo de entrega e pelo mapa regional sob solicitação explícita. */
export async function consumirChamadaMapasEntrega(userId: string) {
  await prisma.$transaction(async tx => {
    const agora = Date.now(), dia = Math.floor(agora / 86400000), minuto = Math.floor(agora / 60000);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('entregas-uso'))`;
    await tx.usoMapaEntrega.deleteMany({ where: { expiraEm: { lt: new Date(agora) } } });
    const diario = Number(process.env.GOOGLE_MAPS_LIMITE_DIA ?? "300"), individual = Number(process.env.GOOGLE_MAPS_LIMITE_MINUTO ?? "12");
    if (!Number.isSafeInteger(diario) || diario < 1 || !Number.isSafeInteger(individual) || individual < 1) throw new FalhaMapas("PROVEDOR_INDISPONIVEL");
    for (const [id, limite, expira] of [[`dia:${dia}`, diario, (dia + 1) * 86400000], [`usuario:${userId}:${minuto}`, individual, (minuto + 1) * 60000]] as const) {
      const uso = await tx.usoMapaEntrega.findUnique({ where: { id } });
      if ((uso?.quantidade ?? 0) >= limite) throw new FalhaMapas("PROVEDOR_INDISPONIVEL");
      await tx.usoMapaEntrega.upsert({ where: { id }, create: { id, quantidade: 1, expiraEm: new Date(expira) }, update: { quantidade: { increment: 1 } } });
    }
  });
}
export type ResultadoEntrega = { memoria: MemoriaEntrega; rota: RotaEntrega | null; recibo: string; calculadoEm: string; validoAte: string; versao: number; origemInformada: string; veiculo: "CARRO" | "MOTO" | null; selecaoVeiculo?: SelecaoVeiculoEntrega };
export type EntradaCalculoEntrega = { clienteId: string | null; atendimento: "ENTREGA" | "RETIRADA"; endereco: EnderecoEntrega | null; subtotalProdutos: string; tiposEmbalagemIds?: string[]; slotsOcupados?: number | null; veiculoEntregaId?: string | null };
const vinculo = (e: EntradaCalculoEntrega, s: SessaoAtual, origem: string, versao: number, veiculo: string | null, selecao?: SelecaoVeiculoEntrega) => assinaturaEntradas({ loja: "singleton", usuario: s.userId, cliente: e.clienteId, atendimento: e.atendimento, endereco: e.endereco, subtotal: moedaCentavos(cents(e.subtotalProdutos)), origem, veiculo, versao, ...(selecao && (selecao.id || selecao.embalagens.length || e.veiculoEntregaId || selecao.modelo === "SLOTS") ? { selecaoVeiculo: selecao } : {}) });
const emCurso = new Map<string, Promise<ResultadoEntrega>>();
/** Compartilhado pelo simulador e Pedido; deduplica apenas solicitações em andamento. */
export async function calcularEntrega(e: EntradaCalculoEntrega, sessao: SessaoAtual, provedor: ProvedorRotas = new GoogleRotas()): Promise<ResultadoEntrega> {
  const chave = assinaturaEntradas({ e, usuario: sessao.userId });
  const anterior = emCurso.get(chave); if (anterior) return anterior;
  const promessa = executarCalculo(e, sessao, provedor); emCurso.set(chave, promessa);
  try { return await promessa; } finally { emCurso.delete(chave); }
}
async function executarCalculo(e: EntradaCalculoEntrega, sessao: SessaoAtual, provedor: ProvedorRotas): Promise<ResultadoEntrega> {
  const { config: c, origemLoja, versao, mapasProntos } = await consultarEntregas();
  e = { ...e, endereco: e.endereco ? validarEnderecoEntrega(e.endereco) : null, subtotalProdutos: moedaCentavos(cents(e.subtotalProdutos)) };
  if (e.tiposEmbalagemIds && (!Array.isArray(e.tiposEmbalagemIds) || e.tiposEmbalagemIds.length > 100 || e.tiposEmbalagemIds.some(v => typeof v !== "string" || !v || v.length > 100))) throw new ErroPedidoVenda("Tipos de embalagem inválidos.");
  if (e.veiculoEntregaId != null && (typeof e.veiculoEntregaId !== "string" || e.veiculoEntregaId.length > 100)) throw new ErroPedidoVenda("Veículo de entrega inválido.");
  const selecao = selecionarVeiculoEntrega(c, e.tiposEmbalagemIds, e.atendimento === "RETIRADA" ? null : e.veiculoEntregaId, e.slotsOcupados);
  const origem = c.origemTipo === "LOJA" ? origemLoja : textoEndereco(c.origem);
  const v = vinculo(e, sessao, origem, versao, selecao.perfil, selecao), calculadoEm = new Date().toISOString();
  let memoria = memoriaPendente("CONFIGURACAO_INCOMPLETA", e.subtotalProdutos), rota: RotaEntrega | null = null;
  if (e.atendimento === "RETIRADA") memoria = { ...memoriaPendente("PERMITIDO", e.subtotalProdutos), frete: "0.00", motivo: "Retirada: frete zero, sem chamada de mapas" };
  else if (!enderecoPreciso(e.endereco)) memoria = memoriaPendente("ENDERECO_PENDENTE", e.subtotalProdutos);
  else if (pendenciasEntregas(c, origemLoja, e.veiculoEntregaId).length || !c.ativo || !selecao.perfil) memoria = { ...memoriaPendente("CONFIGURACAO_INCOMPLETA", e.subtotalProdutos), ...(selecao.pendencia ? { motivo: selecao.pendencia } : {}) };
  else if (regrasAplicaveis(c, e.endereco!).some(r => r.bloquear)) memoria = { ...memoriaPendente("BLOQUEADO", e.subtotalProdutos), excecaoId: regrasAplicaveis(c, e.endereco!).find(r => r.bloquear)!.id };
  else if (!mapasProntos) memoria = memoriaPendente("PROVEDOR_INDISPONIVEL", e.subtotalProdutos);
  else {
    try {
      rota = await provedor.calcular(origem, e.endereco!, selecao.perfil!, () => consumirChamadaMapasEntrega(sessao.userId));
      memoria = precificarEntrega(c, e.endereco!, e.subtotalProdutos, rota.distanciaMetros, selecao.id);
    } catch (erro) {
      if (!(erro instanceof FalhaMapas)) throw erro;
      memoria = memoriaPendente(erro.estado, e.subtotalProdutos);
    }
  }
  // O recibo e o histórico contêm decisão comercial própria, nunca dados geográficos do Google.
  const recibo = await assinarEntrega({ vinculo: v, memoria, versao, calculadoEm });
  return { memoria, rota, recibo, versao, calculadoEm, validoAte: new Date(Date.now() + 600000).toISOString(), origemInformada: origem, veiculo: selecao.perfil, selecaoVeiculo: selecao };
}
export type InstrucaoEntrega = { metodo: "AUTOMATICO" | "MANUAL"; recibo: string; motivo: string; excecaoCobertura: boolean; motivoCobertura: string };
export function validarInstrucaoEntrega(v: unknown): InstrucaoEntrega | null {
  if (v == null) return null;
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroPedidoVenda("Método do frete inválido.");
  const d = v as Record<string, unknown>;
  if (!["AUTOMATICO","MANUAL"].includes(String(d.metodo)) || typeof d.recibo !== "string" || d.recibo.length > 12000 || typeof d.motivo !== "string" || d.motivo.length > 1000 || typeof d.excecaoCobertura !== "boolean" || typeof d.motivoCobertura !== "string" || d.motivoCobertura.length > 1000) throw new ErroPedidoVenda("Complete a instrução de frete.");
  return { metodo: d.metodo as InstrucaoEntrega["metodo"], recibo: d.recibo, motivo: d.motivo.trim(), excecaoCobertura: d.excecaoCobertura, motivoCobertura: d.motivoCobertura.trim() };
}
export async function validarFretePedido(tx: Tx, d: PedidoEntrada, subtotalProdutos: string, sessao: SessaoAtual, anterior?: { entregaSnapshot: Prisma.JsonValue | null; frete: Prisma.Decimal; clienteId?: string | null; atendimento?: string | null; enderecoSnapshot?: Prisma.JsonValue | null; subtotal?: Prisma.Decimal; desconto?: Prisma.Decimal }, tiposEmbalagemIds: string[] = [], slotsOcupados?: number | null) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('entregas-config'))`;
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoLoja" WHERE id = 'singleton' FOR SHARE`;
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" } }), c = loja?.entregas ? validarConfiguracaoEntregas(loja.entregas) : entregasVazias();
  const enderecoLoja = loja?.enderecoEstruturado ? validarEnderecoEntrega(loja.enderecoEstruturado) : null;
  const origemLoja = c.modelo === "SLOTS" ? enderecoPreciso(enderecoLoja) ? textoEndereco(enderecoLoja!) : "" : loja?.endereco ?? "";
  const origem = c.origemTipo === "LOJA" ? origemLoja : textoEndereco(c.origem);
  const e: EntradaCalculoEntrega = { clienteId: d.clienteId, atendimento: d.atendimento!, endereco: d.endereco ? validarEnderecoEntrega(d.endereco) : null, subtotalProdutos, tiposEmbalagemIds, veiculoEntregaId: d.veiculoEntregaId, slotsOcupados };
  const entradasComerciais = { cliente: d.clienteId, atendimento: d.atendimento, endereco: e.endereco, subtotalProdutos: moedaCentavos(cents(subtotalProdutos)), frete: moedaCentavos(cents(d.frete)) };
  const logisticaComercial = c.modelo === "SLOTS" ? { slotsOcupados: slotsOcupados ?? null, ...(d.veiculoEntregaId ? { veiculoEntregaId: d.veiculoEntregaId } : {}) } : d.veiculoEntregaId || tiposEmbalagemIds.length ? { veiculoEntregaId: d.veiculoEntregaId ?? null, embalagens: [...new Set(tiposEmbalagemIds)].sort() } : null;
  const assinaturaComercial = assinaturaEntradas({ ...entradasComerciais, ...(logisticaComercial ? { logistica: logisticaComercial } : {}) });
  const anteriorSnapshot = anterior?.entregaSnapshot as Record<string, unknown> | null;
  if (!d.entrega && c.modelo === "SLOTS" && anteriorSnapshot && (anteriorSnapshot.selecaoVeiculo as SelecaoVeiculoEntrega | undefined)?.escolha !== "SLOTS") {
    const logisticaAnterior = d.veiculoEntregaId || tiposEmbalagemIds.length ? { veiculoEntregaId: d.veiculoEntregaId ?? null, embalagens: [...new Set(tiposEmbalagemIds)].sort() } : null;
    const assinaturaAnterior = assinaturaEntradas({ ...entradasComerciais, ...(logisticaAnterior ? { logistica: logisticaAnterior } : {}) });
    if (anteriorSnapshot.assinaturaComercial === assinaturaAnterior && anterior!.frete.equals(d.frete)) return { frete: anterior!.frete.toFixed(2), snapshot: anterior!.entregaSnapshot! };
  }
  if (!d.entrega && anteriorSnapshot?.assinaturaComercial === assinaturaComercial && anterior!.frete.equals(d.frete)) return { frete: anterior!.frete.toFixed(2), snapshot: anterior!.entregaSnapshot! };
  if (!d.entrega && anteriorSnapshot && !anteriorSnapshot.selecaoVeiculo && !d.veiculoEntregaId && !d.itens.some(i => i.tipoEmbalagemId != null) && anteriorSnapshot.assinaturaComercial === assinaturaEntradas(entradasComerciais) && anterior!.frete.equals(d.frete)) return { frete: anterior!.frete.toFixed(2), snapshot: anterior!.entregaSnapshot! };
  // Pedido histórico sem snapshot pode receber revisão não comercial depois de configurar Entregas.
  // Novos valores/endereço/modalidade continuam exigindo cálculo ou contingência justificada.
  if (!d.entrega && anterior && !anteriorSnapshot && anterior.subtotal && anterior.desconto) {
    const assinaturaAnterior = assinaturaEntradas({ cliente: anterior.clienteId, atendimento: anterior.atendimento, endereco: anterior.enderecoSnapshot ? validarEnderecoEntrega(anterior.enderecoSnapshot) : null, subtotalProdutos: anterior.subtotal.minus(anterior.desconto).toFixed(2), frete: anterior.frete.toFixed(2) });
    if (!d.veiculoEntregaId && !d.itens.some(i => i.tipoEmbalagemId != null) && assinaturaAnterior === assinaturaEntradas(entradasComerciais)) return { frete: anterior.frete.toFixed(2), snapshot: json({ metodo: "MANUAL_LEGADO", cobertura: "NAO_VALIDADA", assinaturaComercial, destinoInformado: e.endereco, freteCobrado: anterior.frete.toFixed(2), usuarioId: sessao.userId, calculadoEm: new Date().toISOString() }) };
  }
  if (d.atendimento === "RETIRADA") return { frete: "0.00", snapshot: json({ metodo: "RETIRADA", assinaturaComercial, calculadoEm: new Date().toISOString(), usuarioId: sessao.userId }) };
  const selecao = selecionarVeiculoEntrega(c, tiposEmbalagemIds, e.veiculoEntregaId, slotsOcupados);
  if (c.modelo === "SLOTS" && !selecao.id) throw new ErroPedidoVenda(selecao.pendencia ?? "Configure os slots e capacidades para calcular a entrega.");
  const instrucao = d.entrega;
  // Legado e configuração ainda nunca criada conservam operação anterior.
  if (!instrucao && !loja?.entregas && (!anteriorSnapshot || anteriorSnapshot.metodo === "MANUAL_LEGADO")) return { frete: d.frete, snapshot: json({ metodo: "MANUAL_LEGADO", cobertura: "NAO_VALIDADA", assinaturaComercial, origemInformada: origem, destinoInformado: e.endereco, usuarioId: sessao.userId, calculadoEm: new Date().toISOString() }) };
  if (!instrucao) throw new ErroPedidoVenda("Calcule o frete ou registre um ajuste manual justificado antes de confirmar/revisar.");
  // Uma simulação anterior ao cadastro do cliente continua válida com as mesmas entradas logísticas/comerciais.
  // Recibos vinculados a um cliente existente continuam proibidos para outro cliente.
  const vinculos = [vinculo(e, sessao, origem, loja?.versaoEntregas ?? 0, selecao.perfil, selecao), vinculo({ ...e, clienteId: null }, sessao, origem, loja?.versaoEntregas ?? 0, selecao.perfil, selecao)];
  const memoria = instrucao.recibo ? (await verificarEntrega(instrucao.recibo, vinculos)).memoria as MemoriaEntrega : memoriaPendente(!enderecoPreciso(e.endereco) ? "ENDERECO_PENDENTE" : c.ativo && !pendenciasEntregas(c,origemLoja,e.veiculoEntregaId).length && !integracaoMapasPronta() ? "PROVEDOR_INDISPONIVEL" : "CONFIGURACAO_INCOMPLETA", subtotalProdutos);
  if (c.modelo === "SLOTS" && (memoria.estado === "FORA_AREA" || instrucao.excecaoCobertura)) throw new ErroPedidoVenda("Entrega limitada às faixas cadastradas em Frete, sem exceção de cobertura.");
  let frete = d.frete, cobertura = memoria.estado, excepcional = false;
  if (instrucao.metodo === "AUTOMATICO") {
    if (memoria.estado !== "PERMITIDO" || memoria.frete == null) throw new ErroPedidoVenda(memoria.motivo);
    if (cents(d.frete) !== cents(memoria.frete)) throw new ErroPedidoVenda("Frete divergente do cálculo. Calcule novamente ou justifique ajuste manual.");
    frete = memoria.frete;
  } else {
    await autorEntregas(tx, sessao, "vendas.pedidos.frete");
    if (!instrucao.motivo) throw new ErroPedidoVenda("Informe o motivo do ajuste manual do frete.");
    if (!instrucao.recibo && c.ativo && integracaoMapasPronta() && !pendenciasEntregas(c, origemLoja, e.veiculoEntregaId).length) throw new ErroPedidoVenda("Calcule a cobertura antes de ajustar o preço manualmente.");
    const bloqueado = e.endereco && regrasAplicaveis(c, e.endereco).some(r => r.bloquear);
    const minimo = e.endereco ? excecaoComercialEntrega(c,e.endereco)?.pedidoMinimo ?? c.pedidoMinimo : c.pedidoMinimo;
    if (memoria.estado === "ABAIXO_MINIMO" || (minimo && cents(subtotalProdutos) < cents(minimo))) throw new ErroPedidoVenda("Pedido abaixo do mínimo. Ajuste os produtos antes de confirmar.");
    if (bloqueado || memoria.estado === "FORA_AREA" || memoria.estado === "BLOQUEADO") {
      if (!instrucao.excecaoCobertura || !instrucao.motivoCobertura) throw new ErroPedidoVenda("Ajustar o preço não libera a cobertura. Registre aprovação excepcional e motivo.");
      await autorEntregas(tx, sessao, "vendas.pedidos.cobertura"); excepcional = true; cobertura = bloqueado ? "BLOQUEADO" : memoria.estado;
    } else if (instrucao.excecaoCobertura) throw new ErroPedidoVenda("Exceção de cobertura só se aplica a região bloqueada ou fora da área.");
  }
  return { frete, snapshot: json({ metodo: instrucao.metodo, configuracaoId: "singleton", versao: loja?.versaoEntregas ?? 0, origemInformada: origem, destinoInformado: e.endereco, veiculo: selecao.perfil, selecaoVeiculo: selecao, veiculoEntregaId: d.veiculoEntregaId ?? null, assinaturaComercial, cobertura, validacaoAutomatica: memoria.estado === "PERMITIDO" && !!instrucao.recibo, excepcional, motivo: instrucao.motivo || null, motivoCobertura: instrucao.motivoCobertura || null, memoria, freteCobrado: frete, calculadoEm: new Date().toISOString(), usuarioId: sessao.userId, dadosMapas: "Não persistidos; distância e duração disponíveis somente no cálculo corrente." }) };
}
