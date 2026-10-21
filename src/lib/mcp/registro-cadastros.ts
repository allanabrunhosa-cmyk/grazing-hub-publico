import { z } from "zod";
import { funcao } from "./definicao";
import { camposAtualizacaoMcp, ComponenteMcp, ConsultaMcp, DataMcp, DinheiroMcp, IdMcp, QuantidadeMcp, ReferenciaMcp } from "./contratos-negocio";
import { CAMPOS_FISCAIS } from "@/lib/vendas/dominio";
export const CategoriaComercialMcp = z.object({ nome: z.string().min(1).max(120), ativo: z.boolean().default(true) }).strict();
export const CategoriaCatalogoMcp = CategoriaComercialMcp.extend({ escopo: z.enum(["PRODUTO", "COMPLEMENTO"]).optional(), cor: z.enum(["azul", "verde", "amarelo", "vermelho"]).optional() });
export const GrupoComercialMcp = CategoriaComercialMcp.extend({ tipo: z.enum(["COMPOSICAO", "EXTRAS", "COMPLEMENTAR"]), categoriaId: IdMcp.nullable().optional(), minimo: z.number().int().min(0).max(1000), maximo: z.number().int().min(0).max(1000).nullable(), repetir: z.boolean(), opcoes: z.array(z.object({ id: IdMcp.or(z.literal("")).default(""), nome: z.string().min(1).max(160), preco: DinheiroMcp, produtoId: IdMcp.nullable(), quantidade: QuantidadeMcp, ativo: z.boolean(), usarPrecoPadrao: z.boolean().optional(), composicao: z.array(ComponenteMcp).max(100).nullable().optional() }).strict()).max(100) });
export const FiscalComercialMcp = z.object(Object.fromEntries(CAMPOS_FISCAIS.map(k => [k, z.string().max(k === "observacoes" ? 1000 : 100).default("")] )) as Record<typeof CAMPOS_FISCAIS[number], z.ZodDefault<z.ZodString>>).strict();
export const FormaPagamentoMcp = CategoriaComercialMcp.extend({ tipo: z.enum(["BOLETO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "VOUCHER", "TRANSFERENCIA", "DINHEIRO", "OUTRO"]), taxaPercentual: z.string().regex(/^\d{1,3}(\.\d{1,6})?$/), taxaFixa: DinheiroMcp, prazoDias: z.number().int().min(0).max(3650), inicioPrazo: z.enum(["VENDA", "PAGAMENTO"]), contagemPrazo: z.enum(["CORRIDOS", "UTEIS"]), vencimentoFlexivel: z.boolean(), permiteParcelamento: z.boolean(), maximoParcelas: z.number().int().min(1).max(120), faixasTaxa: z.array(z.object({ de: z.number().int().min(1).max(120), ate: z.number().int().min(1).max(120), percentual: z.string().regex(/^\d{1,3}(\.\d{1,6})?$/), fixa: DinheiroMcp }).strict()).max(120), observacoes: z.string().max(1000) });
const faixa = z.object({ inicio: z.string().max(5), fim: z.string().max(5), texto: z.string().max(100) }).strict();
export const HorariosMcp = z.union([
  z.object({ grade: z.union([z.literal(30), z.literal(60)]), dias: z.array(z.object({ intervalos: z.array(faixa.omit({ texto: true })).max(6) }).strict()).length(7) }).strict(),
  z.object({ semana: z.array(z.object({ fechado: z.boolean(), horarios: z.array(faixa).max(100), copiadoDe: z.number().int().min(0).max(6).optional() }).strict()).length(7), desativadas: z.array(DataMcp).max(100), especiais: z.array(z.object({ data: DataMcp, horarios: z.array(faixa).max(100) }).strict()).max(100) }).strict(),
]);
export const CartaoMcp = z.object({ nome: z.string().min(1).max(120), contaBancariaId: IdMcp, diaFechamento: z.number().int().min(1).max(31), diaVencimento: z.number().int().min(1).max(31), final: z.string().regex(/^\d{4}$|^$/).optional(), emissor: z.string().max(120).optional(), bandeira: z.string().max(60).optional(), limite: DinheiroMcp.optional(), toleranciaDias: z.number().int().min(0).max(31).optional(), observacoes: z.string().max(1000).optional() }).strict();
const ref = ReferenciaMcp;
const categoriaAtualizacao = camposAtualizacaoMcp(CategoriaComercialMcp).extend(ref.shape).refine(d=>Object.keys(d).some(k=>!["id","versao"].includes(k)), "Informe um campo para atualizar.");
const categoriaCatalogoAtualizacao = camposAtualizacaoMcp(CategoriaCatalogoMcp).extend(ref.shape).refine(d=>Object.keys(d).some(k=>!["id","versao"].includes(k)), "Informe um campo para atualizar.");
const ordem = z.array(ref).min(1).max(100);
export const FUNCOES_CADASTROS_MCP = [
  funcao("clientes_disponibilidade", "Clientes", "Ativar ou inativar cliente preservando histórico", "vendas.clientes", "editar", ref.extend({ ativo: z.boolean() })),
  funcao("produtos_composicao", "Produtos", "Consultar ficha técnica comercial, complementos e preços, sem custos", "vendas.produtos", "visualizar", z.object({ id: IdMcp }).strict()),
  funcao("produtos_custos", "Produtos", "Consultar CMV da composição fixa pelos cálculos da tela; escolhas variáveis não compõem este resultado", "financeiro.custos", "visualizar", z.object({ id: IdMcp }).strict()),
  funcao("produtos_excluir", "Produtos", "Excluir produto sem vínculos impeditivos após revisão", "vendas.produtos", "excluir", ref, true),
  funcao("catalogo_categorias", "Catálogo", "Consultar categorias comerciais", "vendas.catalogo", "visualizar", ConsultaMcp),
  funcao("catalogo_categoria_criar", "Catálogo", "Cadastrar categoria comercial", "vendas.catalogo", "adicionar", CategoriaCatalogoMcp),
  funcao("catalogo_categoria_atualizar", "Catálogo", "Atualizar categoria comercial", "vendas.catalogo", "editar", categoriaCatalogoAtualizacao),
  funcao("catalogo_categoria_disponibilidade", "Catálogo", "Ativar ou inativar categoria comercial", "vendas.catalogo", "editar", ref.extend({ ativo: z.boolean() })),
  funcao("catalogo_categoria_excluir", "Catálogo", "Excluir categoria e seus vínculos comerciais permitidos", "vendas.catalogo", "excluir", ref, true),
  funcao("catalogo_ordenar_categorias", "Catálogo", "Ordenar categorias com versões atuais", "vendas.catalogo", "editar", z.object({ itens: ordem, escopo: z.enum(["PRODUTO", "COMPLEMENTO"]).optional() }).strict()),
  funcao("catalogo_ordenar_produtos", "Catálogo", "Ordenar produtos de uma categoria com versões atuais", "vendas.catalogo", "editar", z.object({ categoriaId: IdMcp, itens: ordem }).strict()),
  funcao("complementos_categorias", "Complementos", "Consultar categorias de grupos de complementos", "vendas.catalogo", "visualizar", ConsultaMcp),
  funcao("complementos_categoria_criar", "Complementos", "Cadastrar categoria de complementos", "vendas.catalogo", "adicionar", CategoriaComercialMcp),
  funcao("complementos_categoria_atualizar", "Complementos", "Atualizar categoria de complementos", "vendas.catalogo", "editar", categoriaAtualizacao),
  funcao("complementos_categoria_disponibilidade", "Complementos", "Alterar disponibilidade da categoria de complementos", "vendas.catalogo", "editar", ref.extend({ ativo: z.boolean() })),
  funcao("complementos_categoria_excluir", "Complementos", "Excluir categoria de complementos permitida", "vendas.catalogo", "excluir", ref, true),
  funcao("complementos_consultar", "Complementos", "Consultar grupos e opções de complementos", "vendas.catalogo", "visualizar", ConsultaMcp),
  funcao("complementos_criar", "Complementos", "Cadastrar grupo de complementos e composição", "vendas.catalogo", "adicionar", GrupoComercialMcp),
  funcao("complementos_atualizar", "Complementos", "Atualizar grupo de complementos preservando opções históricas", "vendas.catalogo", "editar", camposAtualizacaoMcp(GrupoComercialMcp).extend(ref.shape).refine(d=>Object.keys(d).some(k=>!["id","versao"].includes(k)), "Informe um campo para atualizar.")),
  funcao("complementos_disponibilidade", "Complementos", "Ativar ou inativar grupo de complementos", "vendas.catalogo", "editar", ref.extend({ ativo: z.boolean() })),
  funcao("complementos_excluir", "Complementos", "Excluir grupo de complementos permitido", "vendas.catalogo", "excluir", ref, true),
  funcao("fiscal_produto_consultar", "Cadastro fiscal", "Consultar cadastro fiscal local do produto sem comunicação fiscal", "vendas.fiscal", "visualizar", z.object({ id: IdMcp }).strict()),
  funcao("fiscal_produto_atualizar", "Cadastro fiscal", "Atualizar cadastro fiscal comercial sem emissão de documento", "vendas.fiscal", "editar", ref.extend({ fiscal: camposAtualizacaoMcp(FiscalComercialMcp), revisado: z.boolean(), grupoFiscalId: IdMcp.nullable().optional() })),
  funcao("fiscal_grupos_consultar", "Cadastro fiscal", "Consultar grupos fiscais locais", "vendas.fiscal", "visualizar", ConsultaMcp),
  funcao("fiscal_grupo_criar", "Cadastro fiscal", "Cadastrar grupo fiscal local sem emissão", "vendas.fiscal", "editar", CategoriaComercialMcp.extend({ fiscal: FiscalComercialMcp })),
  funcao("fiscal_grupo_atualizar", "Cadastro fiscal", "Atualizar grupo fiscal local e revisão explícita de vínculos", "vendas.fiscal", "editar", camposAtualizacaoMcp(CategoriaComercialMcp).extend(ref.shape).extend({ fiscal: camposAtualizacaoMcp(FiscalComercialMcp).optional(), atualizarVinculados: z.boolean().default(false) }).refine(d=>Object.keys(d).some(k=>!["id","versao","atualizarVinculados"].includes(k)), "Informe um campo para atualizar."), true),
  funcao("fiscal_grupo_disponibilidade", "Cadastro fiscal", "Ativar ou inativar grupo fiscal local", "vendas.fiscal", "editar", ref.extend({ ativo: z.boolean() })),
  funcao("fiscal_grupo_excluir", "Cadastro fiscal", "Excluir grupo fiscal local permitido", "vendas.fiscal", "excluir", ref, true),
  funcao("pagamento_formas_consultar", "Formas de pagamento", "Consultar condições comerciais e taxas das formas de pagamento", "vendas.formas-pagamento", "visualizar", ConsultaMcp),
  funcao("pagamento_forma_criar", "Formas de pagamento", "Cadastrar forma comercial sem ativar cobrança bancária", "vendas.formas-pagamento", "adicionar", FormaPagamentoMcp),
  funcao("pagamento_forma_atualizar", "Formas de pagamento", "Atualizar forma comercial e taxas", "vendas.formas-pagamento", "editar", camposAtualizacaoMcp(FormaPagamentoMcp).extend(ref.shape).refine(d=>Object.keys(d).some(k=>!["id","versao"].includes(k)), "Informe um campo para atualizar.")),
  funcao("pagamento_forma_disponibilidade", "Formas de pagamento", "Alterar disponibilidade da forma comercial", "vendas.formas-pagamento", "editar", ref.extend({ ativo: z.boolean() })),
  funcao("canais_consultar", "Canais comerciais", "Consultar cadastros comerciais de canais sem credenciais ou integração", "vendas.produtos", "visualizar", ConsultaMcp),
  funcao("canais_criar", "Canais comerciais", "Cadastrar identificação comercial do canal sem ativar integração", "vendas.produtos", "editar", z.object({ nome: z.string().min(1).max(60), categoriaReceitaId: IdMcp }).strict()),
  funcao("canais_atualizar", "Canais comerciais", "Atualizar identificação comercial sem reconfigurar o transporte externo", "vendas.produtos", "editar", ref.extend({ nome: z.string().min(1).max(60), categoriaReceitaId: IdMcp })),
  funcao("horarios_consultar", "Horários", "Consultar janelas de entrega e retirada do HUB", "vendas.horarios", "visualizar", z.object({}).strict()),
  funcao("horarios_atualizar", "Horários", "Atualizar janelas comerciais pelo validador compartilhado", "vendas.horarios", "editar", z.object({ versao: z.number().int().min(0), horarios: HorariosMcp }).strict(), true),
  funcao("cartoes_consultar", "Cartões", "Consultar cartões empresariais sem números ou responsáveis", "financeiro.bancario", "visualizar", ConsultaMcp),
  funcao("cartoes_criar", "Cartões", "Cadastrar cartão empresarial sem realizar transações bancárias", "financeiro.bancario", "adicionar", CartaoMcp),
  funcao("cartoes_atualizar", "Cartões", "Atualizar cartão empresarial versionado", "financeiro.bancario", "editar", CartaoMcp.extend({ id: IdMcp, revisao: z.iso.datetime() })),
  funcao("cartoes_disponibilidade", "Cartões", "Ativar ou inativar cadastro de cartão empresarial", "financeiro.bancario", "editar", z.object({ id: IdMcp, revisao: z.iso.datetime(), ativo: z.boolean() }).strict()),
  funcao("perdas_categorias", "Perdas", "Consultar categorias de perdas existentes", "inventario.perdas.categorias", "visualizar", ConsultaMcp),
  funcao("perdas_categoria_criar", "Perdas", "Cadastrar categoria de perdas", "inventario.perdas.categorias", "adicionar", z.object({ nome: z.string().min(3).max(80) }).strict()),
  funcao("perdas_categoria_disponibilidade", "Perdas", "Ativar ou inativar categoria de perdas", "inventario.perdas.categorias", "editar", z.object({ id: IdMcp, ativo: z.boolean() }).strict()),
  funcao("perdas_categoria_excluir", "Perdas", "Excluir categoria nunca utilizada em perdas", "inventario.perdas.categorias", "excluir", z.object({ id: IdMcp }).strict(), true),
] as const;
export type NomeCadastrosMcp = typeof FUNCOES_CADASTROS_MCP[number]["nome"];
