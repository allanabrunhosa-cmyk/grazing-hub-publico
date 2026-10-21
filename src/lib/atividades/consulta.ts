import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession, type SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, SECOES } from "@/lib/permissoes/catalogo";
import type { AtividadeUsuario, Prisma } from "@/generated/prisma/client";
import { alteracoesPermitidas } from "./privacidade";
import { criarCursor, lerCursor, validarFiltros, ErroConsultaAtividades } from "./filtros";
import type { AtividadeRow, DetalheAtividade, FiltrosAtividades, PaginaAtividades } from "./types";

const pode = (s: SessaoAtual, r: string) => s.admin || permissaoEfetiva(s.permissoes, s.excecoes, r, "visualizar");
export async function exigirConsultaAtividades() {
  const sessao = await getSession();
  if (!sessao) throw new ErroConsultaAtividades(401, "Sua sessão expirou. Entre novamente.");
  if (!pode(sessao, "configuracoes.usuarios") || !pode(sessao, "configuracoes.usuarios.atividades")) throw new ErroConsultaAtividades(403, "Seu acesso não permite consultar atividades.");
  return sessao;
}
function recursos(s: SessaoAtual) {
  return SECOES.filter(r => pode(s, r.id) && (s.admin || !r.administradorApenas)).map(r => r.id);
}
function row(r: Pick<AtividadeUsuario, "id" | "ocorridoEm" | "autorNome" | "atorTipo" | "atorReferencia" | "origem" | "modulo" | "acao" | "entidade" | "resumo" | "resultado">): AtividadeRow {
  return { id: r.id, data: r.ocorridoEm.toISOString(), autor: r.autorNome ?? r.atorReferencia ?? (r.atorTipo === "USUARIO" ? "Usuário histórico" : "Sistema"),
    atorTipo: r.atorTipo, origem: r.origem, modulo: r.modulo, acao: r.acao, entidade: r.entidade, resumo: r.resumo, resultado: r.resultado };
}
const selecao = { id: true, ocorridoEm: true, autorNome: true, atorTipo: true, atorReferencia: true, origem: true, modulo: true, acao: true, entidade: true, resumo: true, resultado: true } as const;
/** Somente a página selecionada: sem JOIN de payloads, count integral, OFFSET ou N+1. */
export async function consultarAtividades(input: FiltrosAtividades): Promise<PaginaAtividades> {
  const sessao = await exigirConsultaAtividades();
  const { filtros: f, inicio, fim, hash } = validarFiltros(input);
  const cursor = input.cursor ? lerCursor(input.cursor, hash) : null;
  const limite = cursor ? BigInt(cursor.limite) : (await prisma.atividadeUsuario.findFirst({ orderBy: { sequencia: "desc" }, select: { sequencia: true } }))?.sequencia ?? BigInt(0);
  const identidade = f.perspectiva === "cadastro" ? { usuarioAfetadoId: f.usuarioId } : { autorId: f.usuarioId, atorTipo: "USUARIO" };
  const base: Prisma.AtividadeUsuarioWhereInput = { ...identidade, recurso: { in: recursos(sessao) }, sequencia: { lte: limite } };
  const where: Prisma.AtividadeUsuarioWhereInput = { ...base, ocorridoEm: { gte: inicio, lt: fim },
    ...(f.modulo ? { modulo: f.modulo } : {}), ...(f.acao ? { acao: f.acao } : {}),
    ...(f.resultado ? { resultado: f.resultado } : {}), ...(f.origem ? { origem: f.origem } : {}),
    ...(cursor ? { OR: [{ ocorridoEm: { lt: new Date(cursor.data) } }, { ocorridoEm: new Date(cursor.data), id: { lt: cursor.id } }] } : {}),
  };
  const [registros, primeiro] = await Promise.all([
    prisma.atividadeUsuario.findMany({ where, orderBy: [{ ocorridoEm: "desc" }, { id: "desc" }], take: 51, select: selecao }),
    input.cursor ? Promise.resolve(null) : prisma.atividadeUsuario.findFirst({ where: base, orderBy: [{ ocorridoEm: "asc" }, { id: "asc" }], select: { ocorridoEm: true } }),
  ]);
  const eventos = registros.slice(0, 50), ultimo = eventos.at(-1);
  return { eventos: eventos.map(row), inicioCobertura: primeiro?.ocorridoEm.toISOString() ?? null,
    proximoCursor: registros.length > 50 && ultimo ? criarCursor({ data: ultimo.ocorridoEm.toISOString(), id: ultimo.id, limite: limite.toString(), filtros: hash }) : null };
}
async function referencia(r: AtividadeUsuario): Promise<{ antes?: unknown; depois?: unknown } | null> {
  if (!r.fonteTabela || !r.fonteId) return { antes: r.antes, depois: r.depois };
  const where = { id: r.fonteId };
  // Lista fechada. Uma tabela/id gravada nunca se transforma em SQL fornecido pelo cliente.
  switch (r.fonteTabela) {
    case "HistoricoAcesso": return prisma.historicoAcesso.findUnique({ where, select: { antes: true, depois: true } });
    case "HistoricoCadastroVenda": return prisma.historicoCadastroVenda.findUnique({ where, select: { antes: true, depois: true } });
    case "HistoricoPedidoVenda": return prisma.historicoPedidoVenda.findUnique({ where, select: { antes: true, depois: true } });
    case "HistoricoCartao": return prisma.historicoCartao.findUnique({ where, select: { antes: true, depois: true } });
    case "HistoricoPorcaoInsumo": return prisma.historicoPorcaoInsumo.findUnique({ where, select: { antes: true, depois: true } });
    case "HistoricoOrdemCategoriasPorcoes": { const v = await prisma.historicoOrdemCategoriasPorcoes.findUnique({ where, select: { id: true } }); return v ? {} : null; }
    case "EventoEstruturaFiscal": {
      // Metadados imutáveis da versão; nunca ler dados, fontes ou justificativas.
      const v = await prisma.eventoEstruturaFiscal.findUnique({ where, select: { versao: { select: { tipo: true, versao: true, vigenciaInicio: true } } } });
      return v ? { depois: { tipo: v.versao.tipo, versao: v.versao.versao, vigenciaInicio: v.versao.vigenciaInicio.toISOString().slice(0, 10) } } : null;
    }
    case "HistoricoFinanceiroPedido": {
      const v = await prisma.historicoFinanceiroPedido.findUnique({ where, select: { tipo: true, detalhes: true } });
      if (!v) return null;
      if (v.tipo === "VENCIMENTO_AJUSTADO" && v.detalhes && typeof v.detalhes === "object" && !Array.isArray(v.detalhes)) {
        return { antes: { dataVencimento: v.detalhes.anterior }, depois: { dataVencimento: v.detalhes.novo } };
      }
      return { depois: v.detalhes };
    }
    case "HistoricoConciliacao": { const v = await prisma.historicoConciliacao.findUnique({ where, select: { detalhes: true } }); return v ? { depois: v.detalhes } : null; }
    case "MovimentacaoEstoque": { const v = await prisma.movimentacaoEstoque.findUnique({ where, select: { tipo: true, quantidade: true, localId: true } }); return v ? { depois: { ...v, quantidade: v.quantidade.toString() } } : null; }
    case "Insumo": { const v = await prisma.insumo.findUnique({ where, select: { excluidoEm: true } }); return v ? {} : null; }
    case "EventoAuditoriaEtiqueta": { const v = await prisma.eventoAuditoriaEtiqueta.findUnique({ where, select: { id: true } }); return v ? {} : null; }
    case "PedidoCompraHistorico": { const v = await prisma.pedidoCompraHistorico.findUnique({ where, select: { statusAnterior: true, statusNovo: true } }); return v ? { antes: { status: v.statusAnterior }, depois: { status: v.statusNovo } } : null; }
    case "McpEvento": { const v = await prisma.mcpEvento.findUnique({ where, select: { id: true } }); return v ? {} : null; }
    case "TentativaEtiqueta": { const v = await prisma.tentativaEtiqueta.findUnique({ where, select: { id: true } }); return v ? {} : null; }
    case "Perda": { const v = await prisma.perda.findUnique({ where, select: { quantidade: true, localId: true } }); return v ? { depois: { quantidade: v.quantidade.toString(), localId: v.localId } } : null; }
    case "PerdaExclusao": { const v = await prisma.perdaExclusao.findUnique({ where, select: { quantidade: true } }); return v ? { antes: { quantidade: v.quantidade.toString() } } : null; }
    // Demais fontes têm resumos e resultado; não expõem snapshots específicos sem contrato.
    default: return null;
  }
}
async function linkEntidade(r: AtividadeUsuario, sessao: SessaoAtual): Promise<string | null> {
  const id = r.entidadeId;
  if (!id || !pode(sessao, r.recurso)) return null;
  const where = { id };
  if (r.entidade === "VersaoEstruturaFiscal" && pode(sessao, "vendas.fiscal") && await prisma.versaoEstruturaFiscal.findUnique({ where, select: { id: true } })) return "/vendas/fiscal/cobertura";
  if (["PedidoVenda", "PEDIDO", "Pedido"].includes(r.entidade) && pode(sessao, "vendas.pedidos") && await prisma.pedidoVenda.findUnique({ where, select: { id: true } })) return "/vendas/pedidos/" + encodeURIComponent(id);
  if (["PedidoCompra", "COMPRA", "Pedido de compra"].includes(r.entidade) && pode(sessao, "compras") && await prisma.pedidoCompra.findUnique({ where, select: { id: true } })) return "/compras?entidade=" + encodeURIComponent(id);
  if (["PRODUTO", "PRECO_PRODUTO", "SITUACAO_PRODUTO", "ProdutoVenda"].includes(r.entidade) && pode(sessao, "vendas.produtos") && await prisma.produtoVenda.findUnique({ where, select: { id: true } })) return "/vendas/produtos?entidade=" + encodeURIComponent(id);
  if (["CLIENTE", "SITUACAO_CLIENTE", "ClienteVenda"].includes(r.entidade) && pode(sessao, "vendas.clientes") && await prisma.clienteVenda.findUnique({ where, select: { id: true } })) return "/vendas/clientes?entidade=" + encodeURIComponent(id);
  if (r.entidade === "Insumo" && pode(sessao, "insumos") && await prisma.insumo.findFirst({ where: { ...where, excluidoEm: null }, select: { id: true } })) return "/insumos?entidade=" + encodeURIComponent(id);
  if (["Fornecedor", "Beneficiario"].includes(r.entidade) && pode(sessao, "fornecedores") && await prisma.fornecedor.findUnique({ where, select: { id: true } })) return "/fornecedores?entidade=" + encodeURIComponent(id);
  if (r.entidade === "FaturaCartao" && pode(sessao, "financeiro.faturas") && await prisma.faturaCartao.findUnique({ where, select: { id: true } })) return "/financeiro/cartoes/faturas/" + encodeURIComponent(id);
  if (["LancamentoFinanceiro", "LANCAMENTO_FINANCEIRO"].includes(r.entidade) && pode(sessao, "financeiro.movimentacoes") && await prisma.lancamentoFinanceiro.findFirst({ where: { ...where, status: { not: "CANCELADO" }, pedidoQuitadoCredito: false }, select: { id: true } })) return "/financeiro/movimentacoes?entidade=" + encodeURIComponent(id);
  if (["InventarioContagem", "Contagem"].includes(r.entidade) && pode(sessao, "inventario.contagem") && await prisma.inventarioContagem.findUnique({ where, select: { id: true } })) return "/inventario/contagem/" + encodeURIComponent(id);
  return null;
}
export async function consultarDetalheAtividade(usuarioId: string, eventoId: string): Promise<DetalheAtividade> {
  const sessao = await exigirConsultaAtividades();
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(usuarioId) || !/^[a-zA-Z0-9_-]{1,160}$/.test(eventoId)) throw new ErroConsultaAtividades(400, "Referência inválida.");
  const r = await prisma.atividadeUsuario.findFirst({ where: { id: eventoId, recurso: { in: recursos(sessao) },
    OR: [{ autorId: usuarioId, atorTipo: "USUARIO" }, { usuarioAfetadoId: usuarioId }] } });
  if (!r) throw new ErroConsultaAtividades(404, "Atividade não disponível para este acesso.");
  const [fonte, link] = await Promise.all([referencia(r), linkEntidade(r, sessao)]);
  const financeiros = pode(sessao, "financeiro.movimentacoes") && (r.modulo === "financeiro" || pode(sessao, "financeiro.custos"));
  return { evento: row(r), alteracoes: alteracoesPermitidas(fonte?.antes, fonte?.depois, financeiros), link, referenciaDisponivel: fonte !== null };
}
