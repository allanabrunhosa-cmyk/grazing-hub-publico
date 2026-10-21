import { z } from "zod";
import { funcao } from "./definicao";
import { ConsultaMcp, DinheiroMcp, IdMcp, ReferenciaMcp } from "./contratos-negocio";
const nome = z.object({ nome: z.string().min(1).max(120) }).strict();
export const EnderecoEntregaMcp = z.object({ pais: z.string().max(80).default("Brasil"), cep: z.string().max(30), logradouro: z.string().max(200), numero: z.string().max(30), complemento: z.string().max(160), bairro: z.string().max(120), cidade: z.string().max(120), uf: z.string().max(2) }).strict();
const veiculo = z.object({ id: IdMcp, nome: z.string().min(1).max(80), perfil: z.enum(["CARRO", "MOTO"]), ativo: z.boolean(), slotsMinimos: z.number().int().min(0).max(999999).nullable(), slotsMaximos: z.number().int().min(0).max(999999).nullable() }).strict();
export const EntregasSlotsMcp = z.object({ origemTipo: z.enum(["LOJA", "PERSONALIZADA"]), origemNome: z.string().max(160).default(""), origem: EnderecoEntregaMcp, veiculos: z.array(veiculo).max(50), faixas: z.array(z.object({ id: IdMcp, limiteMetros: z.number().int().min(1).max(1000000), precos: z.record(IdMcp, DinheiroMcp) }).strict()).max(100) }).strict();
export const FUNCOES_COMPLEMENTARES_MCP = [
  funcao("insumos_categorias", "Insumos", "Consultar categorias dos insumos", "insumos", "visualizar", ConsultaMcp.omit({ ativo: true })),
  funcao("insumos_categoria_criar", "Insumos", "Cadastrar categoria de insumos sem duplicar nomes", "insumos", "adicionar", nome),
  funcao("insumos_categoria_renomear", "Insumos", "Renomear categoria de insumos", "insumos", "editar", nome.extend({ id: IdMcp, versao: z.number().int().min(1), nomeAnterior: z.string().min(1).max(120) })),
  funcao("insumos_categoria_excluir", "Insumos", "Excluir categoria sem vínculos impeditivos", "insumos", "excluir", ReferenciaMcp, true),
  funcao("centros_custo_consultar", "Centros de custo", "Consultar centros de custo cadastrados", "insumos", "visualizar", ConsultaMcp.omit({ ativo: true })),
  funcao("centros_custo_criar", "Centros de custo", "Cadastrar centro de custo sem duplicar nome", "insumos", "adicionar", nome),
  funcao("porcoes_ordenar_categorias", "Porções", "Ordenar a lista completa de categorias que possuem porções, com suas versões", "suprimentos.porcoes", "editar", z.object({ itens: z.array(ReferenciaMcp).min(1).max(100) }).strict()),
  funcao("embalagens_consultar", "Embalagens", "Consultar tipos de embalagem e disponibilidade", "vendas.catalogo", "visualizar", ConsultaMcp),
  funcao("embalagens_criar", "Embalagens", "Cadastrar tipo de embalagem comercial", "vendas.catalogo", "adicionar", nome.extend({ ativo: z.boolean().default(true) })),
  funcao("embalagens_atualizar", "Embalagens", "Atualizar tipo de embalagem preservando regras e vínculos", "vendas.catalogo", "editar", nome.extend(ReferenciaMcp.shape).extend({ ativo: z.boolean() })),
  funcao("catalogo_importar", "Importação comercial", "Importar pacote revisável de catálogo existente sem históricos financeiros ou ativação de canais", "vendas.importacao", "adicionar", z.object({ conteudo: z.string().min(1).max(12000) }).strict(), true),
  funcao("entregas_consultar", "Entregas", "Consultar regras comerciais de entrega sem credenciais", "vendas.area-entrega", "visualizar", z.object({}).strict()),
  funcao("entregas_atualizar_slots", "Entregas", "Atualizar configuração comercial de frete por slots sem mudar ativação, infraestrutura ou ambiente", "vendas.area-entrega", "editar", z.object({ versao: z.number().int().min(0), config: EntregasSlotsMcp }).strict(), true),
  { ...funcao("entregas_simular", "Entregas", "Simular frete pelo mesmo serviço da tela; pode consultar o provedor de mapas já configurado e consumir sua cota, sem pedido ou cobrança bancária", "vendas.area-entrega", "editar", z.object({ endereco: EnderecoEntregaMcp.nullable(), atendimento: z.enum(["ENTREGA", "RETIRADA"]), subtotalProdutos: DinheiroMcp, clienteId: IdMcp.nullable().default(null), veiculoEntregaId: IdMcp.nullable().optional(), tiposEmbalagemIds: z.array(IdMcp).max(100).optional(), slotsOcupados: z.number().int().min(0).max(999999).nullable().optional() }).strict()), externa: true, destrutiva: false },
] as const;
export type NomeComplementarMcp = typeof FUNCOES_COMPLEMENTARES_MCP[number]["nome"];
