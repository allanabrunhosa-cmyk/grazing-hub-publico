import "server-only";

import { prisma } from "@/lib/prisma";
import { getSession, type SessaoAtual } from "@/lib/session";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import * as cadastros from "@/lib/vendas/persistencia";
import * as pedidos from "@/lib/vendas/pedidos";
import { criarLancamentoAction, atualizarLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { FUNCOES_NEGOCIO_MCP, type NomeNegocioMcp } from "./registro-negocio";
import { ClienteMcp, ConsultaMcp, ProdutoMcp } from "./contratos-negocio";
import { ErroMcp, registroPermitido } from "./politica";
import type { ContextoMcp } from "./servidor";
import { Prisma } from "@/generated/prisma/client";
import { ADAPTADORES_SUPRIMENTOS } from "./suprimentos";
import { ADAPTADORES_FINANCEIRO_ACOES } from "./financeiro-acoes";
import { ADAPTADORES_PEDIDOS } from "./pedidos-acoes";
import { CondicaoFinanceiraMcp } from "./registro-pedidos";
import { ADAPTADORES_PRODUCAO } from "./producao";
import { ErroPermissao } from "@/lib/permissoes/servidor";
import { ADAPTADORES_CADASTROS } from "./cadastros";
import { ADAPTADORES_CANAIS_FISCAL } from "./canais-fiscal";
import { ADAPTADORES_COMPLEMENTARES } from "./complementar";
import { FUNCOES_FINANCEIRAS_MCP } from "./catalogo";
import { classificacaoComercial } from "@/lib/vendas/classificacao";

export type ReferenciaNegocio = { modelo: "cliente" | "produto" | "pedido" | "lancamento" | "conta"; id: string; hash: string };
type Ambiente = { sessao: SessaoAtual; acesso: ContextoMcp; chave: string; operacaoId: string };
export type AdaptadorMcp = (dados: Record<string, unknown>, ambiente: Ambiente) => Promise<unknown>;
const ver = (s: SessaoAtual, recurso: string) => s.admin || permissaoEfetiva(s.permissoes, s.excecoes, recurso, "visualizar");
const string = (d: Record<string, unknown>, k: string) => d[k] as string;
const numero = (d: Record<string, unknown>, k: string) => d[k] as number;
function formularioLancamento(d: Record<string, unknown>) {
  const f = new FormData();
  for (const campo of ["descricao", "tipo", "valor", "categoriaId", "fornecedorId", "formaPagamentoId", "observacoes", "frequencia"]) if (d[campo] != null) f.set(campo, String(d[campo]));
  if (Array.isArray(d.parcelasVencimento)) for (const vencimento of d.parcelasVencimento) f.append("parcelaVencimento", String(vencimento));
  f.set("dataCompetencia", string(d, "competencia")); f.set("dataVencimento", string(d, "vencimento"));
  return f;
}
function conferirResultado(r: unknown) {
  if (r && typeof r === "object" && (("erro" in r && r.erro) || ("error" in r && r.error))) throw new ErroMcp("invalid_request", 422, "A operação foi recusada pelas regras do HUB. Confira os dados e vínculos na tela correspondente.");
  return r;
}
async function conferirLancamento(d: Record<string, unknown>, a: ContextoMcp) {
  const id = string(d, "id") || string(d, "tituloId");
  const l = await prisma.lancamentoFinanceiro.findUnique({ where: { id } });
  if (!l || !registroPermitido(a.restricoes, l.id, l.contaBancariaId)) throw new ErroMcp("insufficient_scope", 403, "Registro não disponível para esta conexão.");
  if (d.contaId && a.restricoes.contas !== null && !a.restricoes.contas.includes(string(d, "contaId"))) throw new ErroMcp("insufficient_scope", 403, "Conta não disponível para esta conexão.");
  return l;
}
export const ADAPTADORES_MCP: Record<NomeNegocioMcp, AdaptadorMcp> = {
  ...ADAPTADORES_SUPRIMENTOS,
  ...ADAPTADORES_FINANCEIRO_ACOES,
  ...ADAPTADORES_PEDIDOS,
  ...ADAPTADORES_PRODUCAO,
  ...ADAPTADORES_CADASTROS,
  ...ADAPTADORES_CANAIS_FISCAL,
  ...ADAPTADORES_COMPLEMENTARES,
  conexao_contexto: async (_, { sessao, acesso }) => ({ usuario: { id: sessao.userId, nome: sessao.nome, perfil: sessao.perfilNome }, empresaId: acesso.lojaId, conexaoId: acesso.autorizacaoId,
    capacidades: [...FUNCOES_FINANCEIRAS_MCP.map(f=>({ ...f, modulo: "Financeiro", escrita: false, confirmacao: false })), ...FUNCOES_NEGOCIO_MCP].filter(f => acesso.escopos.includes(f.escopo)).map(f => ({ nome: f.nome, modulo: f.modulo, escrita: f.escrita, confirmacao: f.confirmacao })), escopos: acesso.escopos }),
  clientes_consultar: async dados => {
    const d = ConsultaMcp.parse(dados);
    const where: Prisma.ClienteVendaWhereInput = { unificadoEmId: null, ...(d.id ? { id: d.id } : {}), ...(d.busca ? { nome: { contains: d.busca, mode: "insensitive" } } : {}), ...(d.ativo === undefined ? {} : { ativo: d.ativo }) };
    const [registros, total] = await Promise.all([prisma.clienteVenda.findMany({ where, take: d.tamanho, skip: (d.pagina - 1) * d.tamanho, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, tipo: true, versao: true, ativo: true } }), prisma.clienteVenda.count({ where })]);
    return { registros, total, pagina: d.pagina, tamanho: d.tamanho, limitacao: "Dados pessoais, documentos e endereços omitidos." };
  },
  clientes_criar: async (d, { sessao }) => ({ id: await cadastros.salvarCliente({ ...ClienteMcp.parse(d), id: "", versao: 0 }, sessao) }),
  clientes_atualizar: async (d, { sessao }) => { const atual = await prisma.clienteVenda.findUniqueOrThrow({ where: { id: string(d,"id") } }); return { id: await cadastros.salvarCliente({ ...atual, dataNascimento: atual.dataNascimento?.toISOString().slice(0,10) ?? null, ...d }, sessao) }; },
  clientes_inativar: async (d, { sessao }) => cadastros.alterarStatusCadastroVenda("CLIENTE", string(d, "id"), numero(d, "versao"), false, sessao),
  produtos_consultar: async dados => {
    const d = ConsultaMcp.parse(dados);
    const where: Prisma.ProdutoVendaWhereInput = { ...(d.id ? { id: d.id } : {}), ...(d.busca ? { nome: { contains: d.busca, mode: "insensitive" } } : {}), ...(d.ativo === undefined ? {} : { ativo: d.ativo }) };
    const [registros, total] = await Promise.all([prisma.produtoVenda.findMany({ where, take: d.tamanho, skip: (d.pagina - 1) * d.tamanho, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, versao: true, ativo: true, tipo: true, unidade: true, preco: true } }), prisma.produtoVenda.count({ where })]);
    return { registros, total, pagina: d.pagina, tamanho: d.tamanho, limitacao: "Custos, margens e dados fiscais omitidos." };
  },
  produtos_criar: async (d, { sessao }) => ({ id: await cadastros.salvarProduto({ ...ProdutoMcp.parse(d), id: "", versao: 0 }, sessao) }),
  produtos_atualizar: async (d, { sessao }) => {
    const atual = await prisma.produtoVenda.findUniqueOrThrow({ where: { id: string(d,"id") }, include: { categorias: true, grupos: true, componentes: true } });
    // Fotografia interna somente para preservar campos omitidos. A decisão e os
    // cálculos continuam no serviço compartilhado, inclusive concorrência.
    const entrada = { ...Object.fromEntries(Object.entries(atual).filter(([k])=>k in ProdutoMcp.shape)), classificacoes: [classificacaoComercial(atual)], preco: atual.preco.toString(), categorias: atual.categorias.map(c=>c.categoriaId),
      grupos: atual.grupos.map(g=>({ grupoId:g.grupoId, usarPadrao:g.usarPadrao, minimo:g.minimo, maximo:g.maximo, opcoesExcluidas:g.opcoesExcluidas, ajustesOpcoes:g.ajustesOpcoes ?? [] })),
      componentes: atual.componentes.map(c=>({ insumoId:c.insumoId, quantidade:c.quantidade.toString(), unidade:c.unidade, observacaoPorcao:c.observacaoPorcao, porcao:c.porcao, exibirFicha:c.exibirFicha })), ...d };
    return { id: await cadastros.salvarProduto(entrada, sessao) };
  },
  produtos_disponibilidade: async (d, { sessao }) => cadastros.alterarSituacaoProduto(string(d, "id"), numero(d, "versao"), d.ativo as boolean, sessao),
  produtos_preco: async (d, { sessao }) => cadastros.alterarPrecoProduto(string(d, "id"), numero(d, "versao"), string(d, "preco"), sessao),
  pedidos_consultar: async (d, { sessao }) => {
    if (d.id) {
      const [itens, historico] = await Promise.all([prisma.itemPedidoVenda.count({ where: { pedidoId: string(d, "id") } }), prisma.historicoPedidoVenda.count({ where: { pedidoId: string(d, "id") } })]);
      if (itens > 5000 || historico > 5000) throw new ErroMcp("volume_excedido", 422, "Pedido excede 5.000 itens ou eventos; consulte pela interface.");
      const p = await pedidos.obterPedido(string(d, "id"));
      // Nunca retornar o objeto integral: contém fotografias financeiras/pessoais.
      const campos = ["id", "numero", "versao", "status", "statusOperacional", "atendimento", "prazo", "previsaoData", "previsaoJanela", "fusoHorario", "observacoes", "total", "subtotal", "desconto", "frete", "entregueEm"];
      return { ...Object.fromEntries(campos.map(k => [k, p[k] ?? null])), itens: Array.isArray(p.itens) ? p.itens.map((i: Record<string, unknown>) => ({ id: i.id, produtoId: i.produtoId, quantidade: i.quantidade, unidade: i.unidadeSnapshot, observacoes: i.observacoes })) : [],
        historico: Array.isArray(p.historico) ? p.historico.map((h: Record<string, unknown>) => ({ id: h.id, tipo: h.tipo, createdAt: h.createdAt })) : [], financeiroDisponivel: ver(sessao, "financeiro.movimentacoes"), limitacao: "Consulte ferramentas financeiras consentidas para títulos; custos e dados pessoais omitidos." };
    }
    const r = await pedidos.listarPedidos({ busca: d.busca as string, pagina: d.pagina as number, de: d.de as string | undefined, ate: d.ate as string | undefined });
    return { pagina: r.pagina, paginas: r.paginas, quantidadeTotal: r.quantidadeTotal, pedidos: r.pedidos.map(p => ({ id: p.id, numero: p.numero, versao: p.versao, cliente: p.cliente, status: p.status, operacional: p.operacional, previsaoData: p.previsaoData, previsaoJanela: p.previsaoJanela, fusoHorario: p.fusoHorario, total: p.total })) };
  },
  pedidos_criar_rascunho: async (d, a) => pedidos.criarRascunhoPedido(d, a.chave, a.sessao, "HUB", 1),
  pedidos_salvar_rascunho: async (d, a) => pedidos.salvarRascunhoPedido(d.id, d.versao, d.pedido, a.chave, a.sessao),
  pedidos_confirmar: async (d, a) => pedidos.confirmarPedido(d.id, d.versao, a.chave, a.sessao, d.condicaoFinanceira ? CondicaoFinanceiraMcp.parse(d.condicaoFinanceira) : undefined),
  pedidos_revisar: async (d, a) => pedidos.revisarPedido(d.id, d.versao, d.pedido, a.chave, a.sessao),
  pedidos_cancelar: async (d, a) => pedidos.cancelarPedido(d.id, d.versao, d.motivo, a.chave, a.sessao),
  pedidos_registrar_entrega: async (d, a) => pedidos.registrarEntregaPedido(d.id, d.versao, a.chave, a.sessao),
  pedidos_registrar_recebimento: async (d, a) => { await conferirLancamento(d, a.acesso); return pedidos.registrarRecebimentoPedido(d.pedidoId, d.tituloId, d.valor, d.contaId, d.data, a.chave, a.sessao); },
  pedidos_ajustar_vencimento: async (d, a) => { await conferirLancamento(d, a.acesso); return pedidos.ajustarVencimentoPedido(d.pedidoId, d.tituloId, d.vencimento, a.chave, a.sessao); },
  financeiro_criar_lancamento: async (d, a) => {
    if (a.acesso.restricoes.contas !== null || a.acesso.restricoes.lancamentos !== null) throw new ErroMcp("insufficient_scope", 403, "Esta conexão possui restrições incompatíveis com criar títulos novos.");
    return conferirResultado(await criarLancamentoAction(null, formularioLancamento(d)));
  },
  financeiro_atualizar_lancamento: async (d, a) => {
    const l = await conferirLancamento(d, a.acesso);
    if (l.updatedAt.toISOString() !== d.revisao) throw new ErroMcp("invalid_request", 409, "O lançamento mudou. Consulte novamente.");
    return conferirResultado(await atualizarLancamentoAction(l.id, formularioLancamento({descricao:l.descricao,tipo:l.tipo,valor:l.valor.toString(),categoriaId:l.categoriaId,competencia:l.dataCompetencia.toISOString().slice(0,10),vencimento:l.dataVencimento.toISOString().slice(0,10),fornecedorId:l.fornecedorId,formaPagamentoId:l.formaPagamentoId,observacoes:l.observacoes,...d})));
  },
  financeiro_baixar_lancamento: async (d, a) => {
    await conferirLancamento(d, a.acesso);
    await baixarLancamento({ lancamentoId: string(d, "id"), contaBancariaId: string(d, "contaId"), dataPagamento: new Date(`${d.data}T12:00:00`) });
    return { id: d.id, estado: "BAIXADO", transferenciaBancariaExecutada: false };
  },
  financeiro_estornar_baixa: async (d, a) => {
    await conferirLancamento(d, a.acesso);
    await estornarBaixaLancamento({ lancamentoId: string(d, "id"), desconciliacao: { sessao: a.sessao, motivo: string(d, "motivo") } });
    return { id: d.id, estado: "PENDENTE", transferenciaBancariaExecutada: false };
  },
};

export async function identidadeNegocio() {
  const s = await getSession();
  if (!s) throw new ErroMcp("invalid_token", 401, "Identidade não disponível.");
  return s;
}
export async function executarAdaptadorMcp(nome: NomeNegocioMcp, d: Record<string, unknown>, a: Ambiente) {
  try { return conferirResultado(await ADAPTADORES_MCP[nome](d, a)); }
  catch (erro) {
    if (erro instanceof ErroPermissao) throw new ErroMcp("insufficient_scope", 403, erro.message);
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new ErroMcp("invalid_request", 409, "Já existe um cadastro que impede esta operação. Consulte os registros e as regras do módulo antes de repetir.");
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") throw new ErroMcp("invalid_request", 404, "Registro inexistente ou indisponível para a operação.");
    throw erro;
  }
}
