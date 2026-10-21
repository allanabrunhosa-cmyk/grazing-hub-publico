import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { definirContextoAtividade } from "@/lib/atividades/registro";
import { validarCliente, validarProduto } from "./dominio";
import { historico, salvarClienteNaTransacao, type Autor } from "./persistencia";
import { classificarNaturezaCliente } from "./clientes-identidade";
import { normalizarEmailCliente } from "./cliente-identificadores";
import { resolverClienteCanonico } from "./clientes-unicidade";
import {
  ORIGEM_HISTORICA, LOJA_HISTORICA, ehPedidoHistorico, hashCanonico,
  identidadeComprador, normalizarNome, validarPacoteHistorico, dataHistoricaSaoPaulo,
  itensHistoricosEfetivos, totaisHistoricosEfetivos, hashVersaoRegistro,
  type PacoteHistorico, type RegistroHistorico,
} from "./historico-dominio";

type Tx = Prisma.TransactionClient;
type Situacao = "NOVO" | "ATUALIZAR" | "MANTER" | "CONFLITO";
export type GuardasImportacaoHistorica = {
  backupHubSha256: string; restauracaoHubSha256: string;
  backupAtendimentoSha256: string; restauracaoAtendimentoSha256: string;
  baselineSha256: string; conferenciaSha256: string;
};
export type ContextoImportacaoHistorica = {
  usuarioId: string; sessaoVersao: number; loteId: string; guardas: GuardasImportacaoHistorica;
};
type Entrada = ContextoImportacaoHistorica & { pacote: unknown };
export type LinhaPreviaHistorica = {
  numeroOriginal: string; linha: number; situacao: Situacao; motivo: string;
  pedidoId: string | null; versao: number | null; hashLinha: string; hashVersao: string;
  clienteChave: string; clienteId: string | null; pendencias: string[];
  produtos: { bloco: number; chave: string; produtoId: string | null; regra: string }[];
};
const foto = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
const objeto = (valor: unknown): Record<string, unknown> => valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
const decimal = (valor: string) => new Prisma.Decimal(valor);
const incluirProduto = {
  componentes: { include: { insumo: { select: { id: true, nome: true, tipo: true, unidade: true, custoMedio: true, ativo: true, excluidoEm: true, updatedAt: true } } }, orderBy: [{ ordem: "asc" }, { id: "asc" }] },
  _count: { select: { grupos: true } },
} satisfies Prisma.ProdutoVendaInclude;
type Produto = Prisma.ProdutoVendaGetPayload<{ include: typeof incluirProduto }>;
const incluirPedido = { itens: { where: { vigente: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }] } } satisfies Prisma.PedidoVendaInclude;
type Cliente = Prisma.ClienteVendaGetPayload<Record<string, never>>;
const TABELAS_PROTEGIDAS = ["ContaBancaria", "LancamentoFinanceiro", "MovimentacaoBancaria", "SaldoEstoque", "MovimentacaoEstoque", "ReservaPedido", "CreditoClienteMovimento", "PagamentoExternoPedido", "RepassePagamentoPedido", "LiquidacaoCartao", "FaturaCartao", "TratamentoFinanceiroPedido"] as const;
async function fotografarProtegidos(tx: Tx) {
  const resultado: Record<string, { quantidade: string; digest: string }> = {};
  for (const tabela of TABELAS_PROTEGIDAS) {
    // Identificadores vêm apenas desta whitelist estática, nunca da planilha ou argumentos.
    const consulta = Prisma.sql`SELECT count(*)::text AS quantidade, md5(coalesce(string_agg(to_jsonb(t)::text, '|' ORDER BY to_jsonb(t)::text), '')) AS digest FROM ${Prisma.raw(`"${tabela}"`)} t`;
    const linhas = await tx.$queryRaw<{ quantidade: string; digest: string }[]>(consulta);
    if (!linhas[0] || !/^\d+$/.test(linhas[0].quantidade) || !/^[a-f0-9]{32}$/.test(linhas[0].digest)) throw Error("Não foi possível verificar as tabelas operacionais protegidas.");
    resultado[tabela] = linhas[0];
  }
  return resultado;
}

function validarContexto(entrada: ContextoImportacaoHistorica) {
  if (!entrada || typeof entrada.usuarioId !== "string" || !entrada.usuarioId || entrada.usuarioId.length > 100 || !Number.isSafeInteger(entrada.sessaoVersao) || entrada.sessaoVersao < 0) throw Error("Sessão histórica inválida.");
  if (typeof entrada.loteId !== "string" || !/^[a-zA-Z0-9:_-]{8,160}$/.test(entrada.loteId)) throw Error("Identificador do lote histórico inválido.");
  const guardas = entrada.guardas;
  for (const campo of ["backupHubSha256", "restauracaoHubSha256", "backupAtendimentoSha256", "restauracaoAtendimentoSha256", "baselineSha256", "conferenciaSha256"] as const) {
    if (!guardas || typeof guardas[campo] !== "string" || !/^[a-f0-9]{64}$/.test(guardas[campo])) throw Error("Comprove backup, restauração isolada e saldos antes de importar.");
  }
}

export async function transacaoHistorica<T extends object>(entrada: ContextoImportacaoHistorica, operacao: (tx: Tx, autor: Autor) => Promise<T>, somenteLeitura = false) {
  validarContexto(entrada);
  return prisma.$transaction(async tx => {
    // Deve preceder a primeira consulta. A prévia também funciona em conexões
    // configuradas com default_transaction_read_only e o banco impede escritas.
    if (somenteLeitura) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    // A trava exclusiva é tentada antes das travas globais, para rejeitar outro importador sem espera.
    const trava = await tx.$queryRaw<{ obtida: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('vendas-importacao-historica')) AS obtida`;
    if (trava[0]?.obtida !== true) throw Error("Já existe uma importação histórica em execução.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    // Sob Repeatable Read, uma revogação posterior ao primeiro snapshot deve causar
    // conflito de serialização, em vez de permitir autorização por identidade antiga.
    if (!somenteLeitura) await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${entrada.usuarioId} FOR UPDATE`;
    const usuario = await tx.usuario.findUnique({ where: { id: entrada.usuarioId }, select: { id: true, nome: true, ativo: true, excluidoEm: true, senhaDefinida: true, sessaoVersao: true, perfilAcesso: { select: { sistema: true } } } });
    if (!usuario?.ativo || usuario.excluidoEm || !usuario.senhaDefinida || usuario.sessaoVersao !== entrada.sessaoVersao) throw Error("Sua sessão foi encerrada.");
    if (usuario.perfilAcesso?.sistema !== "ADMINISTRADOR") throw Error("Somente administrador ativo pode importar o histórico.");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
    const autor = { userId: usuario.id, nome: usuario.nome, versao: usuario.sessaoVersao };
    await definirContextoAtividade(tx, "AUTOMACAO", entrada.loteId);
    const antes = somenteLeitura ? null : await fotografarProtegidos(tx);
    const resultado = await operacao(tx, autor);
    if (!antes) return { ...resultado, preservacao: null };
    const depois = await fotografarProtegidos(tx);
    if (hashCanonico(antes) !== hashCanonico(depois)) throw Error("A importação alterou dados operacionais protegidos. O lote foi revertido.");
    const preservacao = { antes, depois, iguais: true as const, isolamento: "REPEATABLE_READ" as const };
    const semEfeito = "aplicados" in resultado && resultado.aplicados === 0 || "revertidos" in resultado && resultado.revertidos === 0;
    if (!semEfeito) await historico(tx, autor, "IMPORTACAO", entrada.loteId, null, {
      tipo: "revertidos" in resultado ? "REVERSAO_HISTORICA" : "IMPORTACAO_HISTORICA", loteId: entrada.loteId,
      resultado, guardas: entrada.guardas, hashProva: hashCanonico(preservacao), isolamento: preservacao.isolamento, iguais: true });
    return { ...resultado, preservacao };
  }, { timeout: 600000, maxWait: 10000, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

function chaveProduto(nome: string) { return normalizarNome(nome); }
function alvoProduto(nome: string) {
  const chave = chaveProduto(nome);
  return /^grazinng para 4\s*-\s*luxo branca$/.test(chave) ? "grazing para 4" : chave;
}
function telefoneComparavel(valor: string | null) { return (valor ?? "").replace(/\D/g, ""); }
function correspondenciasCliente(registro: RegistroHistorico, clientes: Cliente[]) {
  const pessoa = identidadeComprador(registro);
  const emails = new Set(pessoa.emails.map(normalizarEmailCliente).filter(Boolean));
  const porEmail = clientes.filter(cliente => emails.has(normalizarEmailCliente(cliente.email)));
  if (porEmail.length) return porEmail;
  if (!pessoa.nome || pessoa.conflitos.length) return [];
  return clientes.filter(cliente => {
    if (normalizarNome(cliente.nome) !== normalizarNome(pessoa.nome)) return false;
    const email = normalizarEmailCliente(cliente.email) ?? "", telefone = telefoneComparavel(cliente.telefone);
    const emailConfere = !!email && pessoa.emails.includes(email), telefoneConfere = !!telefone && pessoa.telefones.includes(telefone);
    if (email && pessoa.emails.length && !emailConfere) return false;
    return emailConfere || telefoneConfere;
  });
}
function entradaCliente(registro: RegistroHistorico, registros: RegistroHistorico[] = [registro]) {
  const pessoa = identidadeComprador(registro);
  if (!pessoa.nome) return null;
  const empresas = [...new Set(registros.map(r => r.comprador.empresa?.trim()).filter((v): v is string => !!v))];
  const juridica = registros.some(r => classificarNaturezaCliente({ nome: r.comprador.nome_cobranca, empresa: r.comprador.empresa }).tipo === "PJ");
  const partes = pessoa.nome.trim().split(/\s+/), primeiroNome = partes[0], sobrenome = partes.slice(1).join(" ");
  return validarCliente({ id: "", versao: 0, nome: juridica && empresas.length === 1 ? empresas[0] : pessoa.nome, tipo: juridica ? "PJ" : "PF", documento: null,
    primeiroNome, sobrenome, ...(juridica ? { nomeContato: primeiroNome, sobrenomeContato: sobrenome } : {}),
    email: pessoa.emails[0] ?? null, telefone: pessoa.telefones[0] ?? null, contato: juridica ? pessoa.nome : null,
    observacoes: juridica ? "Cadastro histórico classificado como pessoa jurídica por menção empresarial. CNPJ e razão social pendentes de comprovação; nomes pessoais e empresas originais preservados na fonte."
      : "Cadastro histórico do comprador. Documento não comprovado; contatos alternativos e empresa preservados na fonte.",
    ativo: true, enderecos: [] });
}
function entradaProduto(nome: string) {
  return validarProduto({ id: "", versao: 0, nome, especificacao: null, descricao: null, tipo: "PADRAO", codigo: null,
    unidade: "UN", fotoUrl: null, observacoes: "Produto histórico inativo. Sem composição, custo ou informação fiscal inferidos.",
    modoPreparo: null, ativo: false, categorias: [], grupos: [], preco: "0", componentes: [] });
}

async function preparar(tx: Tx, pacote: PacoteHistorico) {
  const [fontes, produtos, clientes] = await Promise.all([
    tx.identidadeExternaVenda.findMany({ where: { origem: ORIGEM_HISTORICA, loja: LOJA_HISTORICA }, orderBy: { id: "asc" } }),
    tx.produtoVenda.findMany({ include: incluirProduto, orderBy: { id: "asc" } }),
    tx.clienteVenda.findMany({ orderBy: { id: "asc" } }),
  ]);
  const idsPedidos = fontes.filter(f => f.entidade === "PEDIDO_HISTORICO").map(f => f.destinoId);
  const numeros = pacote.registros.map(r => -Number(r.numero_original));
  if (numeros.some(n => !Number.isSafeInteger(n) || n >= 0 || n < -2147483648)) throw Error("Número original não cabe no identificador histórico reservado.");
  const pedidos = await tx.pedidoVenda.findMany({ where: { OR: [{ id: { in: idsPedidos } }, { referenciaOrigem: ORIGEM_HISTORICA, referenciaEstabelecimento: LOJA_HISTORICA }, { numero: { in: numeros } }] }, include: incluirPedido, orderBy: { id: "asc" } });
  const porFonte = (entidade: string, chave: string) => fontes.find(f => f.entidade === entidade && f.chave === chave);
  const linhas: LinhaPreviaHistorica[] = [];
  type PlanoCliente = { registro: RegistroHistorico; destinoId: string | null; entrada: ReturnType<typeof entradaCliente>; pendencia: string | null; email: string | null };
  const clientesPlanejados = new Map<string, PlanoCliente>();
  const registrosPorComprador = new Map<string, RegistroHistorico[]>();
  for (const registro of pacote.registros) {
    const chave = identidadeComprador(registro).chave;
    registrosPorComprador.set(chave, [...(registrosPorComprador.get(chave) ?? []), registro]);
  }
  const clientesPorId = new Map(clientes.map(cliente => [cliente.id, cliente]));
  const raizes = new Map<string, Promise<string | null>>();
  for (const registro of pacote.registros) {
    const pessoa = identidadeComprador(registro);
    if (clientesPlanejados.has(pessoa.chave)) continue;
    const identidade = porFonte("CLIENTE_HISTORICO", pessoa.chave), vinculado = identidade ? clientesPorId.get(identidade.destinoId) : null;
    const correspondencias = vinculado ? [vinculado] : correspondenciasCliente(registro, clientes);
    const candidatos = new Map<string, Cliente>();
    let aliasIndisponivel = false;
    for (const correspondencia of correspondencias) {
      if (!raizes.has(correspondencia.id)) raizes.set(correspondencia.id, correspondencia.unificadoEmId ? resolverClienteCanonico(tx, correspondencia.id) : Promise.resolve(correspondencia.id));
      const raizId = await raizes.get(correspondencia.id)!, raiz = raizId ? clientesPorId.get(raizId) : null;
      if (raiz) candidatos.set(raiz.id, raiz);
      else if (correspondencia.unificadoEmId) aliasIndisponivel = true;
    }
    let entrada: ReturnType<typeof entradaCliente> = null, pendencia: string | null = null;
    try { entrada = entradaCliente(registro, registrosPorComprador.get(pessoa.chave)); } catch { pendencia = "cliente_fora_dos_limites_cadastrais; original_preservado"; }
    if (!entrada && !pendencia) pendencia = "comprador_sem_nome_cadastravel; contatos_preservados";
    if (identidade && !vinculado) pendencia = "identidade_cliente_sem_destino; revisao_necessaria";
    if (candidatos.size > 1) pendencia = "mais_de_um_cliente_compativel; sem_fusao_automatica";
    if (aliasIndisponivel) pendencia = "cliente_unificado; revisao_necessaria";
    clientesPlanejados.set(pessoa.chave, { registro, destinoId: candidatos.size === 1 ? [...candidatos.keys()][0] : null, entrada, pendencia, email: normalizarEmailCliente(entrada?.email) });
  }
  // A prévia considera todo o lote antes de escolher o perfil que será criado.
  // Fontes e chaves individuais continuam preservadas, mesmo com nomes diferentes.
  const planosPorEmail = new Map<string, PlanoCliente[]>();
  for (const plano of clientesPlanejados.values()) if (plano.email) planosPorEmail.set(plano.email, [...(planosPorEmail.get(plano.email) ?? []), plano]);
  for (const planos of planosPorEmail.values()) {
    const destinos = new Set(planos.flatMap(plano => plano.destinoId ? [plano.destinoId] : []));
    if (destinos.size > 1) for (const plano of planos) { plano.destinoId = null; plano.pendencia = "mais_de_um_cliente_compativel; sem_fusao_automatica"; }
    else if (destinos.size === 1) for (const plano of planos) if (!plano.pendencia) plano.destinoId = [...destinos][0];
  }
  for (const registro of pacote.registros) {
    const fonte = porFonte("PEDIDO_HISTORICO", registro.numero_original), pedido = fonte ? pedidos.find(p => p.id === fonte.destinoId) : undefined;
    let situacao: Situacao = "NOVO", motivo = "Pedido histórico novo, sem efeitos operacionais.";
    if (fonte && (!pedido || !ehPedidoHistorico(pedido))) { situacao = "CONFLITO"; motivo = "Identidade externa aponta para pedido indisponível ou operacional."; }
    else if (fonte && pedido) {
      if (fonte.resumoOrigem === hashVersaoRegistro(registro)) { situacao = "MANTER"; motivo = "Origem sem mudança; dados e edições locais preservados."; }
      else if (pedido.versao !== fonte.versaoDestino || pedido.status !== "HISTORICO") { situacao = "CONFLITO"; motivo = "Pedido foi editado ou revertido após a importação anterior."; }
      else { situacao = "ATUALIZAR"; motivo = "Somente esta linha da fonte mudou; será criada nova revisão auditável."; }
    } else if (pedidos.some(p => p.numero === -Number(registro.numero_original) || p.referenciaOrigem === ORIGEM_HISTORICA && p.referenciaEstabelecimento === LOJA_HISTORICA && p.referenciaPedido === registro.numero_original)) {
      situacao = "CONFLITO"; motivo = "Número ou referência já existe sem identidade histórica comprovada.";
    }
    const pessoa = identidadeComprador(registro), pendencias: string[] = [];
    const cliente = clientesPlanejados.get(pessoa.chave)!;
    if (cliente.pendencia) pendencias.push(cliente.pendencia);
    if (situacao !== "MANTER" && cliente.pendencia === "cliente_unificado; revisao_necessaria") {
      situacao = "CONFLITO"; motivo = "O vínculo do comprador aponta para cadastro unificado. Revise a identidade antes de importar.";
    }
    if (situacao === "ATUALIZAR" && pedido && pedido.clienteId !== cliente.destinoId && (!pedido.clienteId || await resolverClienteCanonico(tx, pedido.clienteId) !== cliente.destinoId)) {
      situacao = "CONFLITO"; motivo = "O vínculo cadastral atual do pedido foi preservado. Revise o comprador antes de atualizar a fonte.";
      pendencias.push("vinculo_cliente_atual_preservado; revisao_necessaria");
    }
    if (pessoa.conflitos.length) pendencias.push(...pessoa.conflitos);
    const mapeamentos = itensHistoricosEfetivos(registro).map(item => {
      const chave = chaveProduto(item.nome_normalizado), alvo = alvoProduto(item.nome_normalizado);
      const identidade = porFonte("PRODUTO_HISTORICO", chave);
      const candidatos = identidade ? produtos.filter(p => p.id === identidade.destinoId) : produtos.filter(p => chaveProduto(p.nome) === alvo);
      if (item.produto_externo_nao_identificado || chave === "produto externo") return { bloco: item.bloco, chave, produtoId: null, regra: "LEGADO_NAO_IDENTIFICADO" };
      if (item.incompleto) return { bloco: item.bloco, chave, produtoId: null, regra: "ITEM_INCOMPLETO" };
      if (candidatos.length > 1 || identidade && !candidatos.length) { pendencias.push(`produto_bloco_${item.bloco}_ambiguo_ou_vinculo_indisponivel`); return { bloco: item.bloco, chave, produtoId: null, regra: "AMBIGUO_SEM_VINCULO" }; }
      if (!candidatos.length) {
        try { entradaProduto(item.nome_normalizado); }
        catch { pendencias.push(`produto_bloco_${item.bloco}_fora_dos_limites_cadastrais; original_preservado`); return { bloco: item.bloco, chave, produtoId: null, regra: "NOME_NAO_CADASTRAVEL" }; }
      }
      return { bloco: item.bloco, chave, produtoId: candidatos[0]?.id ?? null,
        regra: candidatos.length ? chave === alvo ? "NOME_EXATO_UNICO" : "EQUIVALENCIA_AUTORIZADA_LUXO_BRANCA" : "CRIAR_INATIVO" };
    });
    linhas.push({ numeroOriginal: registro.numero_original, linha: registro.linha, situacao, motivo, pedidoId: pedido?.id ?? null,
      versao: pedido?.versao ?? null, hashLinha: registro.hash_linha, hashVersao: hashVersaoRegistro(registro), clienteChave: pessoa.chave, clienteId: cliente.destinoId, pendencias, produtos: mapeamentos });
  }
  const contagens = { novos: linhas.filter(l => l.situacao === "NOVO").length, atualizar: linhas.filter(l => l.situacao === "ATUALIZAR").length,
    manter: linhas.filter(l => l.situacao === "MANTER").length, conflitos: linhas.filter(l => l.situacao === "CONFLITO").length };
  const token = hashCanonico(foto({ pacote, produtos, clientes, fontes, pedidos, linhas }));
  return { pacote, linhas, contagens, token, fontes, produtos, clientes, pedidos, clientesPlanejados };
}

export async function prepararImportacaoHistorica(entrada: Entrada) {
  const pacote = validarPacoteHistorico(entrada.pacote);
  return transacaoHistorica(entrada, async tx => {
    const previa = await preparar(tx, pacote);
    return { token: previa.token, linhas: previa.linhas, contagens: previa.contagens, fonteSha256: pacote.metadados.sha256 };
  }, true);
}

function consumo(registro: RegistroHistorico, produto: Produto | undefined, quantidade: string, bloco: number) {
  const base = { bloco, produtoId: produto?.id ?? null, operacional: false, movimentacaoGerada: false };
  if (registro.data_criacao.mes >= "2026-09") return { ...base, estado: "NAO_REAPLICADO_SETEMBRO", baseTemporal: registro.data_criacao.local_exato, componentes: [] };
  const atendido = registro.status.final_legado === "Retirado" && ["ordem_reversa_validada_por_cadeia_completa", "transicao_unica", "estado_constante"].includes(registro.status.regra);
  const item = itensHistoricosEfetivos(registro).find(i => i.bloco === bloco);
  if (item?.produto_externo_nao_identificado || chaveProduto(item?.nome_normalizado ?? "") === "produto externo" || !atendido || !produto || produto.tipo !== "PADRAO" || produto._count.grupos || !produto.componentes.length || produto.componentes.some(c => c.insumo.tipo !== "INSUMO" || c.insumo.excluidoEm || c.unidade !== c.insumo.unidade || c.quantidade.lte(0))) {
    return { ...base, estado: "NAO_APURADO", motivo: "Atendimento, composição simples ou conversões insuficientes; não se presume consumo zero.", componentes: [] };
  }
  return { ...base, estado: "ESTIMATIVA_COMPOSICAO_ATUAL", baseTemporal: registro.data_criacao.local_exato,
    regraTemporal: "Data da criação usada como estimativa; entrega não informada.", composicaoHistoricaComprovada: false,
    custoHistoricoComprovado: false, produtoVersao: produto.versao, quantidadeComercial: quantidade,
    componentes: produto.componentes.map(c => ({ insumoId: c.insumoId, nome: c.insumo.nome, unidade: c.unidade,
      quantidadePorProduto: c.quantidade.toString(), quantidadeEstimada: c.quantidade.mul(quantidade).toString(),
      custoUnitarioReferencia: c.insumo.custoMedio.gt(0) ? c.insumo.custoMedio.toString() : null,
      custoEstimado: c.insumo.custoMedio.gt(0) ? c.quantidade.mul(quantidade).mul(c.insumo.custoMedio).toString() : null,
      referenciaAtualizadaEm: c.insumo.updatedAt.toISOString(), preparacaoExplodida: false })) };
}

function camposPedido(registro: RegistroHistorico, clienteId: string | null) {
  const totais = totaisHistoricosEfetivos(registro);
  const subtotal = decimal(totais.subtotal_produtos_original), desconto = decimal(totais.desconto_itens);
  const frete = Prisma.Decimal.max(decimal(totais.frete_ajuste_original), 0), total = decimal(totais.total_original);
  return { clienteId, status: "HISTORICO", statusOperacional: "HISTORICO", modoFinanceiro: "EXTERNO", origem: "HISTORICO_LEGADO",
    referenciaOrigem: ORIGEM_HISTORICA, referenciaEstabelecimento: LOJA_HISTORICA, referenciaPedido: registro.numero_original,
    fusoHorario: "America/Sao_Paulo", confirmadoEm: null, entregueEm: null, canceladoEm: null, atendimento: null, prazo: null,
    previsaoData: null, previsaoJanela: null, canalId: null, canalNomeSnapshot: "Histórico legado",
    compradorSnapshot: foto({ nome: registro.comprador.nome_cobranca, empresa: registro.comprador.empresa, emails: registro.comprador.emails, telefones: registro.comprador.telefones }),
    cobrancaSnapshot: Prisma.DbNull, destinatarioSnapshot: foto({ nome: registro.destinatario.nome_entrega_original, contato: null }),
    enderecoSnapshot: Prisma.DbNull, entregaSnapshot: Prisma.DbNull, pagamentoInformadoSnapshot: Prisma.DbNull,
    formaPagamentoInformada: registro.metodo_pagamento_original, observacoes: registro.notas_originais,
    rascunho: foto({ historico: true, numeroOriginal: registro.numero_original }),
    subtotal: subtotal.toFixed(2), desconto: desconto.toFixed(2), frete: frete.toFixed(2),
    outrosCustos: total.minus(subtotal.minus(desconto).plus(frete)).toFixed(2), total: total.toFixed(2),
    createdAt: dataHistoricaSaoPaulo(registro.data_criacao), custoEntregaEstimado: null, custoEntregaEfetivo: null, prestadorEntregaId: null };
}

async function gravarFonte(tx: Tx, entidade: string, chave: string, destinoId: string, resumoOrigem: string, dadosOrigem: unknown, versaoDestino: number) {
  const identificacao = { origem: ORIGEM_HISTORICA, loja: LOJA_HISTORICA, entidade, chave };
  const valores = { destinoId, resumoOrigem, dadosOrigem: foto(dadosOrigem), versaoDestino };
  return tx.identidadeExternaVenda.upsert({ where: { origem_loja_entidade_chave: identificacao }, create: { ...identificacao, ...valores }, update: valores });
}

export async function executarImportacaoHistorica(entrada: Entrada & { tokenPrevia: string }) {
  const pacote = validarPacoteHistorico(entrada.pacote);
  if (typeof entrada.tokenPrevia !== "string" || !/^[a-f0-9]{64}$/.test(entrada.tokenPrevia)) throw Error("Gere e confira a prévia completa antes de importar.");
  return transacaoHistorica(entrada, async (tx, autor) => {
    const previa = await preparar(tx, pacote);
    if (previa.token !== entrada.tokenPrevia && (previa.contagens.novos || previa.contagens.atualizar || previa.contagens.conflitos)) throw Error("Fonte, cadastros ou vínculos mudaram depois da prévia. Nada foi importado.");
    const processar = previa.linhas.filter(l => l.situacao === "NOVO" || l.situacao === "ATUALIZAR");
    const produtosCriados = new Map<string, Produto>(), clientesResolvidos = new Map<string, string | null>(), clientesPorEmail = new Map<string, string>();
    let clientesCriados = 0, clientesReutilizados = 0, produtosNovos = 0;
    const resultado: { numeroOriginal: string; linha: number; pedidoId: string | null; versao: number | null; situacao: Situacao; pendencias: string[] }[] = [];
    for (const linha of previa.linhas) {
      if (linha.situacao === "MANTER" || linha.situacao === "CONFLITO") { resultado.push({ numeroOriginal: linha.numeroOriginal, linha: linha.linha, pedidoId: linha.pedidoId, versao: linha.versao, situacao: linha.situacao, pendencias: linha.pendencias }); continue; }
      const registro = pacote.registros.find(r => r.numero_original === linha.numeroOriginal)!;
      let clienteId = clientesResolvidos.get(linha.clienteChave);
      if (clienteId === undefined) {
        const plano = previa.clientesPlanejados.get(linha.clienteChave)!;
        clienteId = plano.destinoId ?? (!plano.pendencia && plano.email ? clientesPorEmail.get(plano.email) ?? null : null);
        if (clienteId) clientesReutilizados++;
        else if (plano.entrada && !plano.pendencia) { clienteId = await salvarClienteNaTransacao(tx, plano.entrada, autor, "LEGADO"); clientesCriados++; }
        if (clienteId) {
          if (plano.email) clientesPorEmail.set(plano.email, clienteId);
          const cliente = await tx.clienteVenda.findUniqueOrThrow({ where: { id: clienteId }, select: { versao: true } });
          if (!previa.fontes.some(fonte => fonte.entidade === "CLIENTE_HISTORICO" && fonte.chave === linha.clienteChave)) await gravarFonte(tx, "CLIENTE_HISTORICO", linha.clienteChave, clienteId, hashCanonico(foto(identidadeComprador(registro))), { loteId: entrada.loteId, regra: identidadeComprador(registro).regra, documentoComprovado: false, naturezaJuridicaComprovada: false }, cliente.versao);
        }
        clientesResolvidos.set(linha.clienteChave, clienteId ?? null);
      }
      const antes = linha.pedidoId ? previa.pedidos.find(p => p.id === linha.pedidoId)! : null;
      const fonteAntes = previa.fontes.find(f => f.entidade === "PEDIDO_HISTORICO" && f.chave === registro.numero_original) ?? null;
      const versao = antes ? antes.versao + 1 : 1, pedidoId = antes?.id ?? randomUUID();
      const dadosPedido = camposPedido(registro, clienteId ?? null);
      if (antes) await tx.pedidoVenda.update({ where: { id: pedidoId, versao: antes.versao }, data: { ...dadosPedido, versao } });
      else await tx.pedidoVenda.create({ data: { ...dadosPedido, id: pedidoId, numero: -Number(registro.numero_original), criadoPorId: autor.userId, chaveCriacao: `historico:${ORIGEM_HISTORICA}:${registro.numero_original}`, hashCriacao: hashVersaoRegistro(registro) } });
      await tx.itemPedidoVenda.updateMany({ where: { pedidoId, vigente: true }, data: { vigente: false } });
      const consumoSnapshot: unknown[] = [], produtosSnapshot: unknown[] = [];
      const itensEfetivos = itensHistoricosEfetivos(registro), totaisEfetivos = totaisHistoricosEfetivos(registro);
      for (const item of itensEfetivos) {
        const mapa = linha.produtos.find(p => p.bloco === item.bloco)!;
        let produto = mapa.produtoId ? previa.produtos.find(p => p.id === mapa.produtoId) : produtosCriados.get(mapa.chave);
        if (!produto && mapa.regra === "CRIAR_INATIVO") {
          const validado = entradaProduto(item.nome_normalizado);
          produto = await tx.produtoVenda.create({ data: { nome: validado.nome, tipo: validado.tipo, classificacao: validado.classificacao,
            classificacoes: validado.classificacoes, unidade: validado.unidade, ativo: false, preco: validado.preco,
            fiscal: {}, fiscalRevisado: false, observacoes: validado.observacoes }, include: incluirProduto });
          produtosCriados.set(mapa.chave, produto); produtosNovos++;
          await gravarFonte(tx, "PRODUTO_HISTORICO", mapa.chave, produto.id, hashCanonico({ nomeOriginal: item.nome_original }), { loteId: entrada.loteId, nomeOriginal: item.nome_original, regra: mapa.regra }, produto.versao);
          await historico(tx, autor, "PRODUTO", produto.id, null, produto);
        }
        produtosSnapshot.push({ bloco: item.bloco, produtoId: produto?.id ?? null, regra: mapa.regra, nomeOriginal: item.nome_original, varianteOriginal: mapa.regra === "EQUIVALENCIA_AUTORIZADA_LUXO_BRANCA" ? "luxo branca" : null });
        if (item.incompleto || item.quantidade === null || item.preco_unitario_liquido === null) { consumoSnapshot.push({ bloco: item.bloco, estado: "NAO_APURADO", motivo: "Item incompleto preservado na fonte.", operacional: false }); continue; }
        consumoSnapshot.push(consumo(registro, produto, item.quantidade, item.bloco));
        const origemComplementar = objeto(item.complemento);
        await tx.itemPedidoVenda.create({ data: { pedidoId, produtoId: produto?.id ?? null, versaoPedido: versao, ordem: item.bloco - 1,
          quantidade: item.quantidade, unidadeSnapshot: produto?.unidade ?? "UN", vigente: true,
          produtoSnapshot: foto({ nome: item.nome_original ?? item.nome_normalizado, tipo: produto?.tipo ?? "LEGADO_NAO_IDENTIFICADO", unidade: produto?.unidade ?? "UN", categorias: [],
            historico: { bloco: item.bloco, linha: registro.linha, descontoOriginalLinha: item.desconto_linha, precoExportadoLiquido: true, identificacao: mapa.regra, originais: item.originais,
              provenienciaComplementar: item.bloco > 10 ? { origem: origemComplementar.origem, chave: origemComplementar.chave, pedidoWooId: origemComplementar.pedidoWooId, itemWooId: origemComplementar.itemWooId,
                hashRaw: origemComplementar.rawSha256, hashComplemento: registro.complemento!.hash_sha256 } : null } }),
          escolhasSnapshot: [], composicaoSnapshot: Prisma.DbNull, estadoComposicao: "HISTORICO_NAO_OPERACIONAL",
          precoOriginal: item.preco_unitario_liquido, precoAplicado: item.preco_unitario_liquido, acrescimos: "0", desconto: "0", totalLinha: item.liquido_linha!, observacoes: null } });
      }
      const pago = registro.pagamento_informado;
      const dadosOrigem = { registro, hub: { loteId: entrada.loteId, versaoPedido: versao, clienteId: clienteId ?? null, clienteChave: linha.clienteChave,
        fonteSha256: pacote.metadados.sha256, hashVersao: hashVersaoRegistro(registro), itensFontePrincipal: registro.itens.length, itensComplementares: itensEfetivos.length-registro.itens.length,
        produtos: produtosSnapshot, consumo: consumoSnapshot,
        consulta: { itens: itensEfetivos.map(i=>({bloco:i.bloco,nome_original:i.nome_original,quantidade:i.quantidade,preco_unitario_liquido:i.preco_unitario_liquido,desconto_linha:i.desconto_linha,liquido_linha:i.liquido_linha,origem:i.bloco>10 ? "WOOCOMMERCE_COMPLEMENTAR" : "EXCEL_PRIMARIO"})),totais:totaisEfetivos },
        pagamento: pago ? { dataLocal: pago.local_exato, mes: pago.mes, total: registro.totais.total_original, base: "PAGAMENTO_INFORMADO", comprovacao: "FONTE_SEM_CONCILIACAO", operacional: false, eventoSetembroProtegido: pago.mes >= "2026-09" } : null,
        parcelaNaoDetalhada: { valor: totaisEfetivos.valor_historico_nao_detalhado, quantidade: null, produtoFisico: false, consumo: null },
        ajusteLegadoAClassificar: totaisEfetivos.diferenca_total_apos_nao_detalhado, freteOriginal: totaisEfetivos.frete_ajuste_original,
        enderecosConfirmadosEntrega: false, saldosOperacionaisAfetados: false, financeiroSegregadoSemCompensacao: true } };
      const fonteDepois = await gravarFonte(tx, "PEDIDO_HISTORICO", registro.numero_original, pedidoId, hashVersaoRegistro(registro), dadosOrigem, versao);
      await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: antes ? "HISTORICO_ATUALIZADO" : "HISTORICO_IMPORTADO",
        chaveOperacao: `historico:${hashCanonico({ loteId: entrada.loteId, numero: registro.numero_original, versao, hashVersao: hashVersaoRegistro(registro) })}`,
        hashOperacao: hashVersaoRegistro(registro), usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: antes?.versao ?? null, versaoNova: versao,
        antes: antes ? foto({ pedido: antes, fonte: fonteAntes }) : Prisma.DbNull,
        depois: foto({ loteId: entrada.loteId, fonteId: fonteDepois.id, numeroOriginal: registro.numero_original, hashLinha: registro.hash_linha, hashVersao: hashVersaoRegistro(registro), versaoPedido: versao, fonteSha256: pacote.metadados.sha256, guardas: entrada.guardas }),
        motivo: "Importação histórica segregada, sem efeitos operacionais." } });
      resultado.push({ numeroOriginal: registro.numero_original, linha: registro.linha, pedidoId, versao, situacao: linha.situacao, pendencias: linha.pendencias });
    }
    return { ...previa.contagens, aplicados: processar.length, clientesCriados, clientesReutilizados, produtosNovos, loteId: entrada.loteId,
      fonteSha256: pacote.metadados.sha256, tokenPrevia: entrada.tokenPrevia, registros: resultado };
  });
}

const camposRestauraveis = ["clienteId", "canalId", "canalNomeSnapshot", "origem", "status", "statusOperacional", "atendimento", "prazo", "previsaoJanela", "observacoes", "formaPagamentoInformada", "subtotal", "desconto", "frete", "outrosCustos", "total", "modoFinanceiro", "versaoFinanceiro", "fusoHorario", "referenciaOrigem", "referenciaEstabelecimento", "referenciaPedido", "custoEntregaEstimado", "custoEntregaEfetivo", "prestadorEntregaId"] as const;
const jsonRestauraveis = ["rascunho", "compradorSnapshot", "cobrancaSnapshot", "destinatarioSnapshot", "enderecoSnapshot", "entregaSnapshot", "pagamentoInformadoSnapshot"] as const;

export async function reverterImportacaoHistorica(entrada: ContextoImportacaoHistorica) {
  return transacaoHistorica(entrada, async (tx, autor) => {
    const eventos = await tx.historicoPedidoVenda.findMany({ where: { tipo: { in: ["HISTORICO_IMPORTADO", "HISTORICO_ATUALIZADO"] }, depois: { path: ["loteId"], equals: entrada.loteId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    let revertidos = 0;
    const pendencias: { pedidoId: string; motivo: string }[] = [];
    for (const evento of eventos) {
      const repetido = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: `historico-reversao:${evento.id}` } });
      if (repetido) continue;
      const atual = await tx.pedidoVenda.findUnique({ where: { id: evento.pedidoId }, include: incluirPedido });
      const fonte = await tx.identidadeExternaVenda.findFirst({ where: { origem: ORIGEM_HISTORICA, loja: LOJA_HISTORICA, entidade: "PEDIDO_HISTORICO", destinoId: evento.pedidoId } });
      if (!atual || !fonte || !ehPedidoHistorico(atual) || atual.versao !== evento.versaoNova || fonte.versaoDestino !== atual.versao || objeto(objeto(fonte.dadosOrigem).hub).loteId !== entrada.loteId) { pendencias.push({ pedidoId: evento.pedidoId, motivo: "Há alterações ou versões posteriores; preservadas para revisão." }); continue; }
      const anterior = objeto(evento.antes), pedidoAnterior = objeto(anterior.pedido), fonteAnterior = objeto(anterior.fonte), versao = atual.versao + 1;
      await tx.itemPedidoVenda.updateMany({ where: { pedidoId: atual.id, vigente: true }, data: { vigente: false } });
      if (evento.tipo === "HISTORICO_IMPORTADO") {
        await tx.pedidoVenda.update({ where: { id: atual.id, versao: atual.versao }, data: { status: "HISTORICO_REVERTIDO", statusOperacional: "HISTORICO_REVERTIDO", versao } });
        const dados = objeto(fonte.dadosOrigem), hub = objeto(dados.hub);
        await tx.identidadeExternaVenda.update({ where: { id: fonte.id }, data: { versaoDestino: versao, dadosOrigem: foto({ ...dados, hub: { ...hub, versaoPedido: versao, revertido: true, loteReversao: entrada.loteId } }) } });
      } else {
        if (!pedidoAnterior.id || !fonteAnterior.id || !Array.isArray(pedidoAnterior.itens)) throw Error("Snapshot de reversão indisponível. Nada foi alterado.");
        const dados: Record<string, unknown> = { versao };
        for (const campo of camposRestauraveis) dados[campo] = pedidoAnterior[campo] ?? null;
        for (const campo of jsonRestauraveis) dados[campo] = pedidoAnterior[campo] == null ? Prisma.DbNull : foto(pedidoAnterior[campo]);
        for (const campo of ["createdAt", "confirmadoEm", "entregueEm", "canceladoEm", "previsaoData"] as const) dados[campo] = pedidoAnterior[campo] ? new Date(String(pedidoAnterior[campo])) : null;
        await tx.pedidoVenda.update({ where: { id: atual.id, versao: atual.versao }, data: dados as Prisma.PedidoVendaUncheckedUpdateInput });
        for (const bruto of pedidoAnterior.itens) {
          const item = objeto(bruto), campos = ["produtoId", "ordem", "quantidade", "observacoes", "unidadeSnapshot", "estadoComposicao", "precoOriginal", "precoAplicado", "acrescimos", "desconto", "totalLinha"];
          const data = Object.fromEntries(campos.map(campo => [campo, item[campo] ?? null]));
          await tx.itemPedidoVenda.create({ data: { ...data, pedidoId: atual.id, versaoPedido: versao, vigente: true,
            produtoSnapshot: foto(item.produtoSnapshot), escolhasSnapshot: foto(item.escolhasSnapshot), composicaoSnapshot: item.composicaoSnapshot == null ? Prisma.DbNull : foto(item.composicaoSnapshot) } as Prisma.ItemPedidoVendaUncheckedCreateInput });
        }
        const origemAnterior = objeto(fonteAnterior.dadosOrigem), hubAnterior = objeto(origemAnterior.hub);
        await tx.identidadeExternaVenda.update({ where: { id: fonte.id }, data: { resumoOrigem: String(fonteAnterior.resumoOrigem), versaoDestino: versao, dadosOrigem: foto({ ...origemAnterior, hub: { ...hubAnterior, versaoPedido: versao, restauradoPeloLote: entrada.loteId } }) } });
      }
      await tx.historicoPedidoVenda.create({ data: { pedidoId: atual.id, tipo: "HISTORICO_REVERTIDO", chaveOperacao: `historico-reversao:${evento.id}`, hashOperacao: hashCanonico({ evento: evento.id, loteId: entrada.loteId }), usuarioId: autor.userId, usuarioNome: autor.nome,
        versaoAnterior: atual.versao, versaoNova: versao, antes: foto({ pedido: atual, fonte }), depois: foto({ loteId: entrada.loteId, eventoRevertido: evento.id, versaoPedido: versao, cadastrosPreservados: true, tagsExternasGeridasSeparadamente: true, guardas: entrada.guardas }), motivo: "Reversão histórica sem apagar auditoria ou cadastros compartilhados." } });
      revertidos++;
    }
    return { loteId: entrada.loteId, revertidos, pendencias, cadastrosPreservados: true };
  });
}
