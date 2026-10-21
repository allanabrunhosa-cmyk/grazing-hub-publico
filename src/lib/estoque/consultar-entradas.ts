import "server-only";
import { prisma } from "@/lib/prisma";
import { whereEntradaSimplesLegada } from "./entrada-avulsa-servidor";
import { movimentacaoNoPeriodo } from "./extrato";
import type { EntradaSnapshot } from "@/lib/inventario/entrada-avulsa-historico";
import { ErroCorrecaoEntrada } from "@/lib/inventario/entrada-avulsa-historico";
import { dataCalendarioValida } from "@/lib/financeiro/cartoes";

function valoresPesquisa(valor: unknown): string {
  if (valor == null) return "";
  if (Array.isArray(valor)) return valor.map(valoresPesquisa).join(" ");
  if (typeof valor === "object") return Object.values(valor).map(valoresPesquisa).join(" ");
  return String(valor);
}
export type FiltrosEntradas = { busca?: string; de?: string; ate?: string; insumoId?: string; responsavel?: string; pagina?: string };
export type EntradaListaRow = { fornecedor: string; itens: { nome: string; quantidade: string; unidade: string }[]; valorTotal: number; versao: number; id: string; identificador: string; data: string; criadoEm: string; responsavel: string; totalItens: number; situacao: string; tipo: string; produtos: string };
export async function listarEntradas(filtros: FiltrosEntradas) {
  if ([filtros.de, filtros.ate].some(d => d && !dataCalendarioValida(d)) || (filtros.de && filtros.ate && filtros.de > filtros.ate)) throw new ErroCorrecaoEntrada("Informe um período válido.");
  if ((filtros.busca?.length ?? 0) > 160 || (filtros.responsavel?.length ?? 0) > 160 || (filtros.insumoId?.length ?? 0) > 160) throw new ErroCorrecaoEntrada("Filtro de pesquisa inválido.");
  const consulta = await prisma.$transaction(async tx => {
    const [registros, compras, simples, numeros] = await Promise.all([
      tx.entradaAvulsaRegistro.findMany({ orderBy: [{ dataEntrada: "desc" }, { id: "desc" }], include: { versoes: { orderBy: { versao: "desc" }, take: 1, select: { antes: true } }, movimentos: { select: { estornoCompra: { select: { id: true } } } } } }),
      tx.entradaAvulsaCompra.findMany({ where: { registro: null }, include: { fornecedor: { select: { nome: true } }, criadoPor: { select: { nome: true } }, movimentacoes: { select: { local: { select: { nome: true } }, quantidade: true, insumoId: true, insumo: { select: { nome: true, unidade: true } }, estornoCompra: { select: { id: true } } } } } }),
      tx.movimentacaoEstoque.findMany({ where: { AND: [whereEntradaSimplesLegada, { registroAvulsoLegado: null }] }, include: { local: { select: { nome: true } }, criadoPor: { select: { nome: true } }, insumo: { select: { nome: true, unidade: true } } } }),
      tx.$queryRaw<{ origem: string; numero: number }[]>`SELECT origem, numero FROM "NumeroEntradaAvulsaLegada"`,
    ]);
    const numerosPorOrigem = new Map(numeros.map(n => [n.origem, String(n.numero)]));
    const identificar = (id: string) => { const numero = numerosPorOrigem.get(id); if (!numero) throw new Error("Numeração de entrada indisponível."); return numero; };
    const rows = [
      ...registros.map(r => { const atual = r.snapshot as EntradaSnapshot; const s = atual.cancelada ? (r.versoes[0]?.antes as EntradaSnapshot ?? atual) : atual;
        return { id: r.id, identificador: String(r.numero), data: r.dataEntrada.toISOString(), criadoEm: r.createdAt.toISOString(), responsavel: r.criadoPorNome, conteudo: valoresPesquisa(s),
          fornecedor: s.fornecedorNome ?? "—", itens: s.itens.map(i => ({ nome: i.nome, quantidade: String(i.quantidade), unidade: i.unidadeEntrada ?? i.unidade })), valorTotal: s.valorTotal, versao: r.versao,
          totalItens: s.itens.length, situacao: atual.cancelada ? "Excluída" : r.movimentos.some(m => m.estornoCompra) ? "Estornada" : r.versao > 1 ? "Corrigida" : "Registrada", tipo: r.tipo === "COMPRA_SIMPLES" ? "Completa" : "Simples", produtos: s.itens.map(i => i.nome).join(", "), ids: s.itens.map(i => i.insumoId) }; }),
      ...compras.map(c => ({ id: `compra:${c.id}`, identificador: identificar(`compra:${c.id}`), data: c.dataEntrada.toISOString(), criadoEm: c.createdAt.toISOString(), responsavel: c.criadoPor?.nome ?? "Não registrado", conteudo: [c.observacao, c.frete.toString(), c.desconto.toString(), valoresPesquisa(c.outrosCustos), ...c.movimentacoes.map(m => m.local.nome)].join(" "),
        fornecedor: c.fornecedor.nome, itens: c.movimentacoes.map(m => ({ nome: m.insumo.nome, quantidade: m.quantidade.toString(), unidade: m.insumo.unidade })), valorTotal: Number(c.valorTotal), versao: 0,
        totalItens: c.movimentacoes.length, situacao: c.movimentacoes.some(m => m.estornoCompra) ? "Estornada" : "Registrada", tipo: "Completa", produtos: c.movimentacoes.map(m => m.insumo.nome).join(", "), ids: c.movimentacoes.map(m => m.insumoId) })),
      ...simples.map(m => ({ id: `movimento:${m.id}`, identificador: identificar(`movimento:${m.id}`), data: m.createdAt.toISOString(), criadoEm: m.createdAt.toISOString(), responsavel: m.criadoPor?.nome ?? "Não registrado", conteudo: `${m.observacao ?? ""} ${m.local.nome}`,
        fornecedor: "—", itens: [{ nome: m.insumo.nome, quantidade: m.quantidade.toString(), unidade: m.insumo.unidade }], valorTotal: Number(m.valorTotal ?? 0), versao: 0,
        totalItens: 1, situacao: "Registrada", tipo: "Simples", produtos: m.insumo.nome, ids: [m.insumoId] })),
    ];
    const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const termos = normalizar((filtros.busca ?? "").trim()).split(/\s+/).filter(Boolean);
    const selecionadas = rows.filter(r => movimentacaoNoPeriodo(r.criadoEm, filtros.de ?? "", filtros.ate ?? "")
      && (!filtros.insumoId || r.ids.includes(filtros.insumoId)) && (!filtros.responsavel || r.responsavel === filtros.responsavel)
      && termos.every(termo => normalizar(`${r.identificador} ${r.id} ${r.produtos} ${r.fornecedor} ${r.responsavel} ${r.conteudo} ${r.tipo} ${r.situacao} ${r.itens.map(i => `${i.quantidade} ${Number(i.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 9 })} ${i.unidade}`).join(" ")} ${r.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ${new Date(r.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`).includes(termo)))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id.localeCompare(a.id));
    const paginas = Math.max(1, Math.ceil(selecionadas.length / 25));
    const pagina = Math.min(paginas, Math.max(1, Number.parseInt(filtros.pagina ?? "1", 10) || 1));
    const linhas: EntradaListaRow[] = selecionadas.slice((pagina - 1) * 25, pagina * 25).map(r => ({ id: r.id, identificador: r.identificador, data: r.data, criadoEm: r.criadoEm, responsavel: r.responsavel, totalItens: r.totalItens, situacao: r.situacao, tipo: r.tipo, produtos: r.produtos, fornecedor: r.fornecedor, itens: r.itens, valorTotal: r.valorTotal, versao: r.versao }));
    return { linhas, total: selecionadas.length, pagina, paginas,
      responsaveis: [...new Set(rows.map(r => r.responsavel))].sort() };
  }, { isolationLevel: "RepeatableRead" });
  return consulta;
}
