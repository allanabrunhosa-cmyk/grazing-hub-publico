import "server-only";
import { liberacaoTransmissaoBrasilNfe } from "./bloqueio-transmissao";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { prepararFiscalSaidaLegadoHomologacao as prepararFiscalSaida } from "../servico";
import { conferirAcessoAdministrativoBrasilNfe } from "./configuracao";
import { exigirBaseHomologacaoControlada } from "./capacidade-homologacao";
import { propostasPilotoBrasilNfe, dadosDocumentaisPilotoBrasilNfe } from "./proposta-piloto";
import { listarRegrasTributariasBrasilNfe, obterHistoricoRegraTributariaBrasilNfe, salvarRascunhoRegraTributariaBrasilNfe, vincularRegrasDocumentoBrasilNfe } from "./regras-tributarias";
import { hashRegraFiscalBrasilNfe } from "./regras-tributarias-dominio";
import { prepararPayloadLocalBrasilNfe } from "./payload-local";
import { materializarItemRegraBrasilNfe } from "./regras-tributarias-dominio";
import { serializarPayloadLocalBrasilNfe } from "./payload-local";
import { createHash } from "node:crypto";

export const ID_PRODUTO_PILOTO_BRASILNFE = "piloto-fiscal-mini-brioches";
export const ENDERECO_DESTINATARIO_PILOTO = { cep: "01001000", logradouro: "Endereco sintetico de homologacao", numero: "1", bairro: "Centro", cidade: "Sao Paulo", uf: "SP", codMunicipio: "3550308", codPais: 1058, pais: "BRASIL" };
const emitenteComprovadoPiloto = dadosDocumentaisPilotoBrasilNfe;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
/** Massa administrativa real, exclusiva do banco isolado; reutiliza os models e
 * serviços existentes. Não chama confirmação comercial, títulos ou estoque. */
export async function prepararCenariosPilotoBrasilNfe(sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada();
  const { formaId } = await prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await conferirAcesso(tx, sessao, ["revisar", "fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-piloto-local'))`;
    const emitente = await tx.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { cnpj: true } });
    if (emitente.cnpj?.replace(/[.\/-]/g, "") !== dadosDocumentaisPilotoBrasilNfe.cnpj) throw new Error("O emitente não corresponde ao dossiê deste piloto. Não copiar complementos para outra empresa.");
    const forma = await tx.formaPagamentoVenda.findFirst({ where: { ativo: true, tipo: "PIX" }, orderBy: { id: "asc" }, select: { id: true } });
    if (!forma) throw new Error("O piloto precisa de forma PIX ativa, sem gerar pagamento real.");
    const item = propostasPilotoBrasilNfe(55, ID_PRODUTO_PILOTO_BRASILNFE, forma.id, emitenteComprovadoPiloto)[2].conteudo;
    if (item.tipo !== "ITEM") throw new Error("Perfil do piloto inválido.");
    const existente = await tx.produtoVenda.findUnique({ where: { id: ID_PRODUTO_PILOTO_BRASILNFE } });
    if (!existente) {
      await tx.produtoVenda.create({ data: { id: ID_PRODUTO_PILOTO_BRASILNFE, nome: "Piloto fiscal · Sanduíches no mini brioche — 20 un", unidade: "UN", preco: "0", fiscal: json(item.perfil.classificacoes), fiscalRevisado: false, observacoes: "Somente homologacao sintetica no banco administrativo. Dois sabores do dossie, sem GTIN. Valores de venda definidos apenas no cenario." } });
      await tx.historicoCadastroVenda.create({ data: { entidade: "PRODUTO", registroId: ID_PRODUTO_PILOTO_BRASILNFE, usuarioId: sessao.userId, usuarioNome: sessao.nome, depois: { tipo: "CADASTRO_PILOTO_SINTETICO", fiscalRevisado: false, fonte: "PILOTO-55-CLASSIFICACAO", versao: 1 } } });
    }
    return { formaId: forma.id };
  });
  const atuais = await listarRegrasTributariasBrasilNfe(sessao);
  for (const modelo of [55, 65] as const) for (const proposta of propostasPilotoBrasilNfe(modelo, ID_PRODUTO_PILOTO_BRASILNFE, formaId, emitenteComprovadoPiloto)) {
    if (!atuais.some(r => r.modelo === modelo && r.alvo === proposta.alvo && r.produtoId === (proposta.produtoId ?? null))) await salvarRascunhoRegraTributariaBrasilNfe(proposta, sessao);
  }
  for (const modelo of [55, 65] as const) {
    const pedido = await prisma.$transaction(async tx => {
      await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
      const pessoa = await conferirAcesso(tx, sessao, ["revisar", "fiscal"]);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-piloto-local'))`;
      const chaveCriacao = `brasilnfe-piloto-${modelo}-2026-v1`, existente = await tx.pedidoVenda.findUnique({ where: { chaveCriacao } });
      if (existente) return existente;
      const novo = await tx.pedidoVenda.create({ data: { chaveCriacao, hashCriacao: hashRegraFiscalBrasilNfe({ modelo, total: "10.00", fonte: "CENARIO_HOMOLOGACAO_SINTETICO" }), status: "CONFIRMADO", criadoPorId: pessoa.userId, confirmadoEm: new Date(), canalNomeSnapshot: "Homologacao sintetica", origem: "INTERNO", subtotal: "10", total: "10", observacoes: "Homologacao sintetica: nenhuma venda, recebivel, reserva ou entrega real.", compradorSnapshot: { documento: "99999999000191", razaoSocial: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" }, pagamentoInformadoSnapshot: { formaId }, itens: { create: { produtoId: ID_PRODUTO_PILOTO_BRASILNFE, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Piloto sintetico: caixa20 mini brioches Brie e Minas com geleia" }, escolhasSnapshot: [{ sabor: "Brie e geleia", quantidade: 10 }, { sabor: "Minas e geleia", quantidade: 10 }], estadoComposicao: "HOMOLOGACAO_SINTETICA", precoOriginal: "10", precoAplicado: "10", acrescimos: "0", totalLinha: "10" } } } });
      await tx.historicoPedidoVenda.create({ data: { pedidoId: novo.id, tipo: "CENARIO_HOMOLOGACAO_SINTETICO", chaveOperacao: randomUUID(), hashOperacao: novo.hashCriacao, usuarioId: pessoa.userId, usuarioNome: pessoa.nome, versaoNova: 1, motivo: "Cenario ficticio independente de financeiro e estoque, ambiente2, modelo" + modelo, depois: { modelo, total: "10.00", efeitosFinanceiros: false, efeitosEstoque: false } } });
      return novo;
    });
    await prepararFiscalSaida(pedido.id, pedido.versao, sessao);
  }
  return lerPreparacaoPilotosBrasilNfe(sessao);
}
/** Projeção local das PROPOSTAS, com hashes reais. Nunca se faz passar por plano
 * aprovado nem libera transmissão; mostra as lacunas antes da revisão humana. */
export async function lerPreparacaoPilotosBrasilNfe(sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada();
  await prisma.$transaction(async tx => { await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "visualizar"); await conferirAcesso(tx, sessao, ["consultar"]); });
  const regras = await listarRegrasTributariasBrasilNfe(sessao);
  const loja = await prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { nome: true, cnpj: true, enderecoEstruturado: true } });
  const resultados = [];
  for (const modelo of [55, 65] as const) {
    const pedido = await prisma.pedidoVenda.findUnique({ where: { chaveCriacao: `brasilnfe-piloto-${modelo}-2026-v1` } });
    if (!pedido) continue;
    const doc = await prisma.documentoFiscalSaida.findFirstOrThrow({ where: { pedidoId: pedido.id, versaoPedido: pedido.versao }, orderBy: { revisaoFiscal: "desc" } });
    const perfis = regras.filter(r => r.modelo === modelo && ["EMPRESA", "OPERACAO", "PRODUTO"].includes(r.alvo) && (r.alvo !== "PRODUTO" || r.produtoId === ID_PRODUTO_PILOTO_BRASILNFE));
    const historicos = await Promise.all(perfis.map(r => obterHistoricoRegraTributariaBrasilNfe(r.id, sessao)));
    const emp = historicos.find(h => h.alvo === "EMPRESA")?.versoes[0], op = historicos.find(h => h.alvo === "OPERACAO")?.versoes[0], item = historicos.find(h => h.alvo === "PRODUTO")?.versoes[0];
    if (emp?.conteudo.tipo !== "EMPRESA" || op?.conteudo.tipo !== "OPERACAO" || item?.conteudo.tipo !== "ITEM") continue;
    const i = (doc.payload as { itens: { id: string; produtoId: string; fiscal: { versaoCadastro: number } }[] }).itens[0];
    const destinatario = op.conteudo.destinatario.identificar ? { ...op.conteudo.destinatario, endereco: ENDERECO_DESTINATARIO_PILOTO } : op.conteudo.destinatario;
    const parametros = { vinculo: { documentoId: doc.id, hashPayload: doc.hashPayload, revisaoPedido: doc.versaoPedido }, referenciaFundamentacao: op.id, emitente: emp.conteudo.emitente, operacao: op.conteudo.operacao, destinatario, pagamentos: op.conteudo.pagamentos, itens: [materializarItemRegraBrasilNfe(item.conteudo.perfil, { itemId: i.id, produtoId: i.produtoId, versaoCadastro: i.fiscal.versaoCadastro, referenciaFundamentacao: item.id }, { itemId: i.id })] };
    const local = prepararPayloadLocalBrasilNfe(doc, modelo, loja, parametros);
    const aprovadas = historicos.every(h => h.versoes[0].estado === "APROVADA");
    const pendenciasRevisao = historicos.flatMap(h => (h.versoes[0].fundamentacaoFiscal?.confianca ?? []).filter(c => ["PENDENTE", "REVISAO_ESPECIALIZADA"].includes(c.estado)).map(c => ({ campo: c.campo, motivo: c.justificativa })));
    resultados.push({ documentoId: doc.id, pedidoId: pedido.id, modelo, ambiente: 2 as const, estado: doc.status, total: local.payload?.ValorTotal ?? pedido.total.toFixed(2), hashSnapshot: doc.hashPayload, hashPayloadFiscal: local.payload ? createHash("sha256").update(serializarPayloadLocalBrasilNfe(local)).digest("hex") : null, revisaoPedido: doc.versaoPedido, montagemConcluida: local.montagemConcluida, aprovacaoInterna: aprovadas, transmissaoPermitida: false as const, liberacaoTransmissao: liberacaoTransmissaoBrasilNfe(), pendencias: [...local.pendencias, ...pendenciasRevisao], versoes: historicos.map(h => ({ regraId: h.id, alvo: h.alvo, versaoId: h.versoes[0].id, revisao: h.revisao, conteudoHash: h.versoes[0].conteudoHash, fundamentacaoHash: h.versoes[0].fundamentacaoHash, aprovacaoHash: h.versoes[0].aprovacaoHash })), historicos });
  }
  return resultados;
}
export async function vincularPilotoAprovadoBrasilNfe(documentoId: string, sessao: SessaoAtual) {
  const pilotos = await lerPreparacaoPilotosBrasilNfe(sessao), p = pilotos.find(p => p.documentoId === documentoId);
  if (!p?.aprovacaoInterna) throw new Error("A revisão interna consolidada ainda não foi aprovada.");
  const d = await prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, select: { payload: true } });
  const i = (d.payload as { itens: { id: string }[] }).itens[0];
  return vincularRegrasDocumentoBrasilNfe({ documentoId, modelo: p.modelo, empresaVersaoId: p.versoes.find(v => v.alvo === "EMPRESA")!.versaoId, operacaoVersaoId: p.versoes.find(v => v.alvo === "OPERACAO")!.versaoId, itens: [{ itemId: i.id, versaoId: p.versoes.find(v => v.alvo === "PRODUTO")!.versaoId }], complementos: { ...(p.modelo === 55 ? { destinatario: ENDERECO_DESTINATARIO_PILOTO } : {}), bases: [{ itemId: i.id }], cartoes: [] } }, sessao);
}
/** Refinamento administrativo de propostas anteriores do próprio piloto.
 * Não altera classificação, snapshot, vigência ou aprovação já registrada. */
export async function separarRepresentacaoIpiPilotoBrasilNfe(sessao: SessaoAtual) {
  const pilotos = await lerPreparacaoPilotosBrasilNfe(sessao);
  if (await prisma.documentoFiscalSaida.count({ where: { id: { in: pilotos.map(p => p.documentoId) }, OR: [{ tentativas: { gt: 0 } }, { acao: { not: null } }, { leaseToken: { not: null } }] } })) throw new Error("Piloto já processado; não substituir sua preparação.");
  for (const p of pilotos) {
    const h = p.historicos.find(h => h.alvo === "PRODUTO"), v = h?.versoes[0];
    if (!h || !v || !["PROPOSTA", "EM_REVISAO"].includes(v.estado) || v.conteudo.tipo !== "ITEM" || v.conteudo.perfil.representacaoIpi !== "OMITIR_SIMPLES" || v.conteudo.perfil.ipiAplicavel === null) continue;
    await salvarRascunhoRegraTributariaBrasilNfe({ regraId: h.id, revisao: h.revisao, modelo: h.modelo, operacao: h.operacao, alvo: h.alvo, produtoId: h.produtoId, vigenteDesde: v.vigenteDesde, vigenteAte: v.vigenteAte, fundamentacaoFiscal: v.fundamentacaoFiscal, conteudo: { ...v.conteudo, perfil: { ...v.conteudo.perfil, ipiAplicavel: null } } }, sessao);
  }
  return lerPreparacaoPilotosBrasilNfe(sessao);
}
