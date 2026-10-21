import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import * as servicos from "@/lib/vendas/persistencia";
import { salvarFormaPagamentoVenda } from "@/lib/vendas/persistencia-formas-pagamento";
import { salvarCanalVenda } from "@/lib/vendas/canais";
import { consultarHorariosPedidos, salvarHorariosPedidos } from "@/lib/vendas/pedidos-horarios";
import { precosOpcoes } from "@/lib/vendas/complementos";
import { validarComponentes } from "@/lib/vendas/dominio";
import * as cartoes from "@/app/(protegido)/financeiro/bancario/cartoes-actions";
import * as perdas from "@/app/(protegido)/inventario/perdas/categorias-actions";
import { CartaoMcp, CategoriaComercialMcp, FormaPagamentoMcp, GrupoComercialMcp, type NomeCadastrosMcp } from "./registro-cadastros";
import { ConsultaMcp } from "./contratos-negocio";
import { ErroMcp } from "./politica";
import type { AdaptadorMcp } from "./negocio";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { custoComposicaoProduto, percentualCmv } from "@/lib/vendas/cmv";
const id = (d: Record<string, unknown>) => d.id as string;
const versao = (d: Record<string, unknown>) => d.versao as number;
const ativos = (d: Record<string, unknown>) => d.ativo as boolean;
const semReferencia = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => !["id", "versao", "revisao"].includes(k)));
const form = (d: Record<string, unknown>) => { const f = new FormData(); for (const [k, v] of Object.entries(d)) if (v != null) f.set(k, String(v)); return f; };
function consulta(d: Record<string, unknown>) { const c = ConsultaMcp.parse(d); return { c, where: { ...(c.id ? { id: c.id } : {}), ...(c.busca ? { nome: { contains: c.busca, mode: "insensitive" as const } } : {}), ...(c.ativo === undefined ? {} : { ativo: c.ativo }) }, take: c.tamanho, skip: (c.pagina - 1) * c.tamanho }; }
function pagina(c: ReturnType<typeof consulta>["c"], registros: unknown[], total: number) { return { registros, total, pagina: c.pagina, tamanho: c.tamanho }; }
const exigirCartao: AdaptadorMcp = async (d, a) => { if (a.acesso.restricoes.contas !== null || a.acesso.restricoes.lancamentos !== null) throw new ErroMcp("insufficient_scope", 403, "Operação de cartões exige conexão financeira sem restrição de registros."); if (d.id) { const r = await prisma.cartaoCredito.findUnique({ where: { id: id(d) } }); if (!r || r.updatedAt.toISOString() !== d.revisao) throw new ErroMcp("invalid_request", 409, "Cartão alterado. Consulte novamente."); } };
export const ADAPTADORES_CADASTROS: Record<NomeCadastrosMcp, AdaptadorMcp> = {
  produtos_custos: async (d, a) => { if (a.acesso.restricoes.contas !== null || a.acesso.restricoes.lancamentos !== null) throw new ErroMcp("insufficient_scope", 403, "CMV integral exige conexão sem restrições financeiras de registros."); const volumes = await Promise.all([prisma.produtoVenda.count(), prisma.insumo.count({ where: { excluidoEm: null } }), prisma.grupoComplementoVenda.count(), prisma.categoriaVenda.count()]); if (volumes.some(n=>n>5000)) throw new ErroMcp("volume_excedido", 422, "Base excede 5.000 registros por cadastro; consulte CMV pela interface."); const base = await consultarProdutos(); const p = base.produtos.find(p=>p.id===id(d)); if (!p) throw new ErroMcp("invalid_request", 404, "Produto não encontrado."); const custo = custoComposicaoProduto(p, base.insumos); const cmv = percentualCmv(custo, p.preco); return { id: p.id, versao: p.versao, preco: p.preco, custoUnitario: custo === null ? null : String(custo), percentualCmv: cmv === null ? null : String(cmv), informacaoDisponivel: custo !== null, limitacao: "CMV da composição fixa, conforme o mesmo serviço da tela. Ausência de custo/rendimento não é zero; escolhas variáveis são calculadas pelo simulador." }; },
  clientes_disponibilidade: (d, a) => servicos.alterarStatusCadastroVenda("CLIENTE", id(d), versao(d), ativos(d), a.sessao),
  produtos_composicao: async d => { const p = await prisma.produtoVenda.findUnique({ where: { id: id(d) }, select: { id: true, nome: true, versao: true, preco: true, unidade: true, modoPreparo: true, componentes: { take: 101, select: { id: true, insumoId: true, quantidade: true, unidade: true, observacaoPorcao: true, porcao: true, exibirFicha: true } }, grupos: { take: 101, select: { grupoId: true, usarPadrao: true, minimo: true, maximo: true, opcoesExcluidas: true, ajustesOpcoes: true } } } }); if (!p) throw new ErroMcp("invalid_request", 404, "Produto não encontrado."); if (p.componentes.length > 100 || p.grupos.length > 100) throw new ErroMcp("volume_excedido", 422, "Ficha excede 100 componentes ou grupos; consulte pela interface."); return { ...p, limitacao: "Custos e margens omitidos; ajustes locais são dados comerciais, sem autorização." }; },
  produtos_excluir: (d, a) => servicos.excluirCadastroVenda("PRODUTO", id(d), versao(d), a.sessao),
  catalogo_categorias: async d => { const { c, where, take, skip } = consulta(d); const [r, n] = await Promise.all([prisma.categoriaVenda.findMany({ where, take, skip, orderBy: [{ ordem: "asc" }, { id: "asc" }] }), prisma.categoriaVenda.count({ where })]); return pagina(c, r, n); },
  catalogo_categoria_criar: (d, a) => servicos.salvarCategoria({ ...CategoriaComercialMcp.parse(d), id: "", versao: 0 }, a.sessao).then(id => ({ id })),
  catalogo_categoria_atualizar: async (d, a) => { const atual=await prisma.categoriaVenda.findUniqueOrThrow({where:{id:id(d)}}); return {id:await servicos.salvarCategoria({nome:atual.nome,ativo:atual.ativo,...d},a.sessao)}; },
  catalogo_categoria_disponibilidade: (d, a) => servicos.alterarStatusCadastroVenda("CATEGORIA", id(d), versao(d), ativos(d), a.sessao),
  catalogo_categoria_excluir: (d, a) => servicos.excluirCadastroVenda("CATEGORIA", id(d), versao(d), a.sessao),
  catalogo_ordenar_categorias: (d, a) => servicos.reordenarCategorias(d.itens, a.sessao),
  catalogo_ordenar_produtos: (d, a) => servicos.reordenarProdutos(d.categoriaId as string, d.itens, a.sessao),
  complementos_categorias: async d => { const { c, where, take, skip } = consulta(d); const [r, n] = await Promise.all([prisma.categoriaGrupoComplementoVenda.findMany({ where, take, skip, orderBy: [{ ordem: "asc" }, { id: "asc" }] }), prisma.categoriaGrupoComplementoVenda.count({ where })]); return pagina(c, r, n); },
  complementos_categoria_criar: (d, a) => servicos.salvarCategoriaGrupo({ ...CategoriaComercialMcp.parse(d), id: "", versao: 0 }, a.sessao).then(id => ({ id })),
  complementos_categoria_atualizar: async (d, a) => { const atual=await prisma.categoriaGrupoComplementoVenda.findUniqueOrThrow({where:{id:id(d)}}); return {id:await servicos.salvarCategoriaGrupo({nome:atual.nome,ativo:atual.ativo,...d},a.sessao)}; },
  complementos_categoria_disponibilidade: (d, a) => servicos.alterarStatusCadastroVenda("CATEGORIA_GRUPO", id(d), versao(d), ativos(d), a.sessao),
  complementos_categoria_excluir: (d, a) => servicos.excluirCadastroVenda("CATEGORIA_GRUPO", id(d), versao(d), a.sessao),
  complementos_consultar: async d => { const { c, where, take, skip } = consulta(d); const [grupos, n] = await Promise.all([prisma.grupoComplementoVenda.findMany({ where, take, skip, include: { opcoes: { take: 101, orderBy: [{ ordem: "asc" }, { id: "asc" }] } }, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.grupoComplementoVenda.count({ where })]); if (grupos.some(g => g.opcoes.length > 100)) throw new ErroMcp("volume_excedido", 422, "Grupo excede 100 opções; consulte pela interface."); const produtos = await prisma.produtoVenda.findMany({ where: { id: { in: grupos.flatMap(g => g.opcoes.flatMap(o => o.produtoId ? [o.produtoId] : [])) } }, select: { id: true, preco: true } }); return pagina(c, grupos.map(g => ({ ...g, opcoes: precosOpcoes(g.opcoes.map(o => ({ ...o, preco: o.preco.toString(), quantidade: o.quantidade.toString(), composicao: o.composicao == null ? null : validarComponentes(o.composicao) })), produtos.map(p => ({ id: p.id, preco: p.preco.toString() }))) })), n); },
  complementos_criar: (d, a) => servicos.salvarGrupo({ ...GrupoComercialMcp.parse(d), id: "", versao: 0 }, a.sessao).then(id => ({ id })),
  complementos_atualizar: async (d, a) => {
    const atual=await prisma.grupoComplementoVenda.findUniqueOrThrow({where:{id:id(d)},include:{opcoes:{orderBy:{ordem:"asc"}}}});
    return {id:await servicos.salvarGrupo({...atual,opcoes:atual.opcoes.map(o=>({...o,preco:o.preco.toString(),quantidade:o.quantidade.toString()})),...d},a.sessao)};
  },
  complementos_disponibilidade: (d, a) => servicos.alterarStatusCadastroVenda("GRUPO", id(d), versao(d), ativos(d), a.sessao),
  complementos_excluir: (d, a) => servicos.excluirCadastroVenda("GRUPO", id(d), versao(d), a.sessao),
  fiscal_produto_consultar: async d => { const p = await prisma.produtoVenda.findUnique({ where: { id: id(d) }, select: { id: true, nome: true, versao: true, fiscal: true, fiscalRevisado: true, grupoFiscalId: true } }); if (!p) throw new ErroMcp("invalid_request", 404, "Produto não encontrado."); return p; },
  fiscal_produto_atualizar: async (d, a) => { const atual=await prisma.produtoVenda.findUniqueOrThrow({where:{id:id(d)}});
    return servicos.salvarFiscalProduto(id(d),versao(d),{...(atual.fiscal as object),...(d.fiscal as object)},d.revisado as boolean,a.sessao,Object.hasOwn(d,"grupoFiscalId") ? d.grupoFiscalId as string|null : atual.grupoFiscalId);
  },
  fiscal_grupos_consultar: async d => { const { c, where, take, skip } = consulta(d); const [r, n] = await Promise.all([prisma.grupoFiscalVenda.findMany({ where, take, skip, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.grupoFiscalVenda.count({ where })]); return pagina(c, r, n); },
  fiscal_grupo_criar: (d, a) => servicos.salvarGrupoFiscal({ id: "", versao: 0, nome: d.nome as string, ativo: ativos(d), fiscal: d.fiscal }, a.sessao).then(id => ({ id })),
  fiscal_grupo_atualizar: async (d, a) => { const atual=await prisma.grupoFiscalVenda.findUniqueOrThrow({where:{id:id(d)}}); return {id:await servicos.salvarGrupoFiscal({ id:id(d),versao:versao(d),nome:(d.nome as string|undefined) ?? atual.nome,ativo:(d.ativo as boolean|undefined) ?? atual.ativo,fiscal:{...(atual.fiscal as object),...(d.fiscal as object|undefined)},atualizarVinculados:d.atualizarVinculados as boolean},a.sessao)}; },
  fiscal_grupo_disponibilidade: (d, a) => servicos.alterarStatusCadastroVenda("GRUPO_FISCAL", id(d), versao(d), ativos(d), a.sessao),
  fiscal_grupo_excluir: (d, a) => servicos.excluirCadastroVenda("GRUPO_FISCAL", id(d), versao(d), a.sessao),
  pagamento_formas_consultar: async d => { const { c, where, take, skip } = consulta(d); const [r, n] = await Promise.all([prisma.formaPagamentoVenda.findMany({ where, take, skip, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.formaPagamentoVenda.count({ where })]); return pagina(c, r, n); },
  pagamento_forma_criar: async (d, a) => ({ id: await salvarFormaPagamentoVenda({ ...FormaPagamentoMcp.parse(d), id: "", versao: 0 }, a.sessao) }),
  pagamento_forma_atualizar: async (d, a) => {
    const atual = await prisma.formaPagamentoVenda.findUniqueOrThrow({ where: { id: id(d) } });
    return { id: await salvarFormaPagamentoVenda({ ...atual, taxaPercentual: atual.taxaPercentual.toString(), taxaFixa: atual.taxaFixa.toString(), ...d }, a.sessao) };
  },
  pagamento_forma_disponibilidade: (d, a) => servicos.alterarStatusCadastroVenda("FORMA_PAGAMENTO", id(d), versao(d), ativos(d), a.sessao),
  canais_consultar: async d => { const { c, where, take, skip } = consulta(d); if (c.ativo !== undefined) throw new ErroMcp("invalid_request", 422, "Canal comercial não possui estado ativo; integração externa é administrada no HUB."); const [r, n] = await Promise.all([prisma.canalVenda.findMany({ where: where as Prisma.CanalVendaWhereInput, take, skip, orderBy: [{ ordem: "asc" }, { id: "asc" }] }), prisma.canalVenda.count({ where: where as Prisma.CanalVendaWhereInput })]); return pagina(c, r, n); },
  canais_criar: (d, a) => salvarCanalVenda({ nome: d.nome as string, categoriaReceitaId: d.categoriaReceitaId as string, chave: a.chave }, a.sessao),
  canais_atualizar: (d, a) => salvarCanalVenda({ id: id(d), versao: versao(d), nome: d.nome as string, categoriaReceitaId: d.categoriaReceitaId as string, chave: a.chave }, a.sessao),
  horarios_consultar: () => consultarHorariosPedidos(),
  horarios_atualizar: (d, a) => salvarHorariosPedidos(d.horarios, versao(d), a.sessao, a.operacaoId),
  cartoes_consultar: async (d, a) => { await exigirCartao({}, a); const { c, where, take, skip } = consulta(d); const [r, n] = await Promise.all([prisma.cartaoCredito.findMany({ where, take, skip, select: { id: true, nome: true, contaBancariaId: true, diaFechamento: true, diaVencimento: true, toleranciaDias: true, ativo: true, updatedAt: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.cartaoCredito.count({ where })]); return pagina(c, r, n); },
  cartoes_criar: async (d, a) => { await exigirCartao({}, a); const r = await cartoes.salvarCartaoAction(null, form(CartaoMcp.parse(d))); if ("erro" in r) return r; return { id: (await prisma.cartaoCredito.findUniqueOrThrow({ where: { nome: d.nome as string } })).id }; },
  cartoes_atualizar: async (d, a) => {
    await exigirCartao(d, a);
    const atual = await prisma.cartaoCredito.findUniqueOrThrow({ where: { id: id(d) } });
    // O formulário nativo salva estes campos em conjunto quando recebe "final".
    // Completar omissões com o cadastro atual evita apagar dados não consultáveis pelo MCP.
    return cartoes.salvarCartaoAction(id(d), form({ final: atual.final ?? "", emissor: atual.emissor ?? "", bandeira: atual.bandeira ?? "", limite: atual.limite?.toString() ?? "", toleranciaDias: atual.toleranciaDias, observacoes: atual.observacoes ?? "", ...CartaoMcp.parse(semReferencia(d)), versao: d.revisao }));
  },
  cartoes_disponibilidade: async (d, a) => { await exigirCartao(d, a); return cartoes.alternarCartaoAction(id(d), ativos(d)); },
  perdas_categorias: async d => { const { c, where, take, skip } = consulta(d); const [r, n] = await Promise.all([prisma.categoriaPerda.findMany({ where, take, skip, select: { id: true, nome: true, ativo: true, codigoLegado: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] }), prisma.categoriaPerda.count({ where })]); return pagina(c, r, n); },
  perdas_categoria_criar: d => perdas.adicionarCategoriaPerdaAction(d.nome as string),
  perdas_categoria_disponibilidade: d => perdas.alterarCategoriaPerdaAction(id(d), ativos(d)),
  perdas_categoria_excluir: d => perdas.removerCategoriaPerdaAction(id(d)),
};
