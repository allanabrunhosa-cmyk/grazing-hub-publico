import "server-only";
import { prisma } from "@/lib/prisma";
import * as insumos from "@/app/(protegido)/insumos/actions";
import { reordenarCategoriasPorcoesAction } from "@/app/(protegido)/porcoes/actions";
import { salvarTipoEmbalagem } from "@/lib/vendas/embalagens";
import { previaImportacao, aplicarImportacao } from "@/lib/vendas/importacao";
import { calcularEntrega, consultarEntregas, salvarEntregas } from "@/lib/vendas/entregas";
import { ConsultaMcp } from "./contratos-negocio";
import { EntregasSlotsMcp, EnderecoEntregaMcp, type NomeComplementarMcp } from "./registro-complementar";
import { ErroMcp } from "./politica";
import type { AdaptadorMcp } from "./negocio";
const id = (d: Record<string, unknown>) => d.id as string;
async function conferirCategoria(d: Record<string, unknown>) { const c = await prisma.categoria.findUnique({ where: { id: id(d) } }); if (!c || c.versaoOrdemPorcoes !== d.versao || d.nomeAnterior !== undefined && c.nome !== d.nomeAnterior) throw new ErroMcp("invalid_request", 409, "Categoria alterada. Consulte novamente."); }
export const ADAPTADORES_COMPLEMENTARES: Record<NomeComplementarMcp, AdaptadorMcp> = {
  insumos_categorias: async d => { const c = ConsultaMcp.parse(d), where = { ...(c.id ? { id: c.id } : {}), ...(c.busca ? { nome: { contains: c.busca, mode: "insensitive" as const } } : {}) }; const [r, n] = await Promise.all([prisma.categoria.findMany({ where, take: c.tamanho, skip: (c.pagina - 1) * c.tamanho, orderBy: [{ ordemPorcoes: "asc" }, { id: "asc" }] }), prisma.categoria.count({ where })]); return { registros: r.map(x => ({ id: x.id, nome: x.nome, ordem: x.ordemPorcoes, versao: x.versaoOrdemPorcoes })), total: n, pagina: c.pagina, tamanho: c.tamanho }; },
  insumos_categoria_criar: d => insumos.createCategoriaAction(d.nome as string),
  insumos_categoria_renomear: async d => { await conferirCategoria(d); return insumos.renameCategoriaAction(id(d), d.nome as string); },
  insumos_categoria_excluir: async d => { await conferirCategoria(d); return insumos.deleteCategoriaAction(id(d)); },
  centros_custo_consultar: async d => { const c = ConsultaMcp.parse(d), where = { ...(c.id ? { id: c.id } : {}), ...(c.busca ? { nome: { contains: c.busca, mode: "insensitive" as const } } : {}) }; const [r, n] = await Promise.all([prisma.centroCusto.findMany({ where, take: c.tamanho, skip: (c.pagina - 1) * c.tamanho, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.centroCusto.count({ where })]); return { registros: r, total: n, pagina: c.pagina, tamanho: c.tamanho }; },
  centros_custo_criar: d => insumos.createCentroCustoAction(d.nome as string),
  porcoes_ordenar_categorias: d => reordenarCategoriasPorcoesAction(d.itens as { id: string; versao: number }[]),
  embalagens_consultar: async d => { const c = ConsultaMcp.parse(d), where = { ...(c.id ? { id: c.id } : {}), ...(c.busca ? { nome: { contains: c.busca, mode: "insensitive" as const } } : {}), ...(c.ativo === undefined ? {} : { ativo: c.ativo }) }; const [r, n] = await Promise.all([prisma.tipoEmbalagemVenda.findMany({ where, take: c.tamanho, skip: (c.pagina - 1) * c.tamanho, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.tipoEmbalagemVenda.count({ where })]); return { registros: r, total: n, pagina: c.pagina, tamanho: c.tamanho }; },
  embalagens_criar: (d, a) => salvarTipoEmbalagem({ ...d, id: "", versao: 0 }, a.sessao),
  embalagens_atualizar: (d, a) => salvarTipoEmbalagem(d, a.sessao),
  catalogo_importar: async (d, a) => { const conteudo = d.conteudo as string; const previa = await previaImportacao(conteudo); if (previa.contagens.conflitos) throw new ErroMcp("invalid_request", 409, "O pacote tem conflitos. Revise a importação pelo HUB antes de solicitar novamente."); return aplicarImportacao(conteudo, previa.token, a.sessao); },
  entregas_consultar: async () => { const r = await consultarEntregas(); return { config: r.config, versao: r.versao, mapasProntos: r.mapasProntos, pendencias: r.pendencias, limitacao: "Credenciais omitidas; configuração comercial acessível somente com a permissão central de áreas de entrega." }; },
  entregas_atualizar_slots: async (d, a) => { const anterior = await consultarEntregas(); if (anterior.config.modelo !== "SLOTS") throw new ErroMcp("invalid_request", 409, "A configuração vigente não usa slots; conversão de modelo é realizada no HUB."); return salvarEntregas({ ...EntregasSlotsMcp.parse(d.config), ativo: anterior.config.ativo, modelo: "SLOTS", veiculo: null }, d.versao as number, a.sessao); },
  entregas_simular: async (d, a) => { if (d.clienteId && !await prisma.clienteVenda.findUnique({ where: { id: d.clienteId as string }, select: { id: true } })) throw new ErroMcp("invalid_request", 404, "Cliente não encontrado."); const r = await calcularEntrega({ atendimento: d.atendimento as "ENTREGA" | "RETIRADA", endereco: d.endereco ? EnderecoEntregaMcp.parse(d.endereco) : null, subtotalProdutos: d.subtotalProdutos as string, clienteId: d.clienteId as string | null, veiculoEntregaId: d.veiculoEntregaId as string | undefined, tiposEmbalagemIds: d.tiposEmbalagemIds as string[] | undefined, slotsOcupados: d.slotsOcupados as number | null | undefined }, a.sessao); return { memoria: r.memoria, recibo: r.recibo, versao: r.versao, calculadoEm: r.calculadoEm, validoAte: r.validoAte, selecaoVeiculo: r.selecaoVeiculo, limitacao: "Simulação não cria pedido nem executa cobrança; resultado indisponível é informado no estado da memória." }; },
};
