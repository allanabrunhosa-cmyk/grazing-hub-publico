import { z } from "zod";

export const IdMcp = z.string().min(1).max(100).regex(/^[a-zA-Z0-9:_-]+$/);
export const VersaoMcp = z.number().int().min(1).max(2147483647);
export const TextoMcp = z.string().max(1000);
export const DinheiroMcp = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
export const QuantidadeMcp = z.string().regex(/^\d{1,10}(\.\d{1,6})?$/);
export const DataMcp = z.iso.date().refine(s => s >= "2000-01-01" && s <= "2200-12-31");
export const ConsultaMcp = z.object({ busca: z.string().max(100).default(""), id: IdMcp.optional(), ativo: z.boolean().optional(), pagina: z.number().int().min(1).max(1000).default(1), tamanho: z.number().int().min(1).max(100).default(50) }).strict();
const endereco = z.object({ pais: z.string().max(80).default("Brasil"), cep: z.string().max(30), logradouro: z.string().max(200), numero: z.string().max(30), complemento: z.string().max(160), bairro: z.string().max(120), cidade: z.string().max(120), uf: z.string().max(120) }).strict();
export const ClienteMcp = z.object({ id: IdMcp.optional(), versao: VersaoMcp.optional(), nome: z.string().min(1).max(160), tipo: z.enum(["PF", "PJ"]),
  primeiroNome: z.string().max(80).nullable().optional(), sobrenome: z.string().max(80).nullable().optional(),
  razaoSocial: z.string().max(160).nullable().optional(), inscricaoEstadual: z.string().max(30).nullable().optional(), dataNascimento: DataMcp.nullable().optional(),
  documento: z.string().regex(/^\d{11}$|^\d{14}$|^$/).nullable().default(null), email: z.email().max(254).nullable().default(null), telefone: z.string().max(30).nullable().default(null),
  contato: z.string().max(160).nullable().default(null), observacoes: TextoMcp.nullable().default(null),
  enderecos: z.array(endereco.extend({ nome: z.string().max(80), destinatario: z.string().max(160) })).max(20).default([]), ativo: z.boolean().default(true),
  nomeContato: z.string().max(80).nullable().optional(), sobrenomeContato: z.string().max(80).nullable().optional(),
  entregaPadrao: z.object({ destinatario: z.object({ nome: z.string().max(160), primeiroNome: z.string().max(80).optional(), sobrenome: z.string().max(80).optional(), contato: z.string().max(30) }).strict(), endereco }).strict().nullable().optional(),
  regrasPagamento: z.object({ formasPagamentoIds: z.array(IdMcp).max(100).nullable(), boletoDiasAposEntrega: z.number().int().min(0).max(3650).nullable(), limiteCreditoAberto: DinheiroMcp.nullable() }).strict().optional(),
}).strict();
// Atualização altera somente campos explicitamente enviados. Defaults de criação
// não podem apagar documentos, contatos ou endereços ocultos na consulta.
export function camposAtualizacaoMcp(schema: z.ZodObject) {
  return z.object(Object.fromEntries(Object.entries(schema.shape).filter(([k]) => !["id", "versao", "revisao"].includes(k)).map(([k, campo]) => [k, ((campo instanceof z.ZodDefault ? campo.removeDefault() : campo) as z.ZodType).optional()]))).strict();
}
export const ClienteAtualizacaoMcp = camposAtualizacaoMcp(ClienteMcp).extend({ id: IdMcp, versao: VersaoMcp }).refine(d => Object.keys(d).some(k => !["id", "versao"].includes(k)), "Informe ao menos um campo para atualizar.");
export const PorcaoComposicaoMcp = z.object({ quantidadeMedida: z.string().regex(/^\d{1,9}(\.\d{1,9})?$/), unidadeMedida: z.string().max(100), quantidadeInsumo: z.string().regex(/^\d{1,9}(\.\d{1,9})?$/), unidadeInsumo: z.string().min(1).max(20), numeroPorcoes: z.string().regex(/^\d{1,9}(\.\d{1,9})?$/) }).strict();
export const ComponenteMcp = z.object({ insumoId: IdMcp, quantidade: QuantidadeMcp, unidade: z.string().min(1).max(20), observacaoPorcao: z.string().max(160).nullable().optional(), porcao: PorcaoComposicaoMcp.nullable().optional(), exibirFicha: z.boolean().optional() }).strict();
const ajusteOpcao = z.object({ opcaoId: IdMcp, preco: DinheiroMcp.optional(), composicao: z.array(ComponenteMcp).max(100).nullable().optional(), ativo: z.boolean().optional() }).strict();
export const ProdutoMcp = z.object({ id: IdMcp.optional(), versao: VersaoMcp.optional(), nome: z.string().min(1).max(160), especificacao: z.string().max(160).nullable().default(null), descricao: TextoMcp.nullable().default(null),
  tipo: z.enum(["PADRAO", "PERSONALIZADO", "REVENDA"]), codigo: z.string().max(80).nullable().default(null), unidade: z.string().min(1).max(20),
  fotoUrl: z.string().regex(/^\/api\/vendas\/fotos\/[a-zA-Z0-9_-]+$/).nullable().default(null), observacoes: TextoMcp.nullable().default(null), modoPreparo: TextoMcp.nullable().default(null), ativo: z.boolean().default(true),
  categorias: z.array(IdMcp).max(100).default([]), grupos: z.array(z.object({ grupoId: IdMcp, usarPadrao: z.boolean(), minimo: z.number().int().min(0), maximo: z.number().int().min(0).nullable(), opcoesExcluidas: z.array(IdMcp).max(100).optional(), ajustesOpcoes: z.array(ajusteOpcao).max(100).optional() }).strict()).max(50).default([]),
  novoVinculoComplemento: z.object({ grupoId: IdMcp, preco: DinheiroMcp }).strict().nullable().optional(),
  pausasComplementos: z.array(z.object({ opcaoId: IdMcp, ativo: z.boolean(), grupos: z.array(z.object({ id: IdMcp, versao: VersaoMcp }).strict()).max(100) }).strict()).max(100).optional(),
  preco: DinheiroMcp, componentes: z.array(ComponenteMcp).max(100).default([]), tempoPreparoMinutos: z.number().int().min(0).max(10080).nullable().optional(), tipoEmbalagemId: IdMcp.nullable().optional(), slotsEntrega: z.number().int().min(0).max(1000).nullable().optional(),
  classificacoes: z.array(z.enum(["PRINCIPAL", "COMPLEMENTO"])).length(1).optional(),
}).strict();
export const ProdutoAtualizacaoMcp = camposAtualizacaoMcp(ProdutoMcp).extend({ id: IdMcp, versao: VersaoMcp }).refine(d => Object.keys(d).some(k => !["id", "versao"].includes(k)), "Informe ao menos um campo para atualizar.");
export const PedidoMcp = z.object({ clienteId: IdMcp.nullable(), canalId: IdMcp.nullable(), atendimento: z.enum(["ENTREGA", "RETIRADA"]).nullable(), prazo: z.enum(["IMEDIATO", "AGENDADO"]).nullable(),
  veiculoEntregaId: IdMcp.nullable().optional(),
  entrega: z.object({ metodo: z.enum(["AUTOMATICO", "MANUAL"]), recibo: z.string().max(12000), motivo: TextoMcp, excecaoCobertura: z.boolean(), motivoCobertura: TextoMcp }).strict().nullable().optional(),
  referenciaOrigem: z.string().max(100).nullable().optional(), referenciaEstabelecimento: z.string().max(100).nullable().optional(), referenciaPedido: z.string().max(100).nullable().optional(),
  previsaoData: DataMcp.nullable(), previsaoJanela: z.string().max(80).nullable(),
  destinatario: z.object({ nome: z.string().max(160), contato: z.string().max(100) }).strict().nullable(), endereco: endereco.nullable(), cobranca: endereco.nullable().optional(),
  observacoes: TextoMcp.default(""), desconto: DinheiroMcp.default("0.00"), frete: DinheiroMcp.default("0.00"), outrosCustos: DinheiroMcp.optional(),
  pagamentoInformado: z.object({ formaId: IdMcp, parcelas: z.number().int().min(1).max(120), vencimentos: z.array(DataMcp).max(120) }).strict().nullable().optional(),
  itens: z.array(z.object({ itemOrigemId: IdMcp.optional(), produtoId: IdMcp, quantidade: QuantidadeMcp, observacoes: TextoMcp.optional(), escolhas: z.record(IdMcp, z.number().int().min(0).max(1000)), precoManual: DinheiroMcp.nullable(), tipoEmbalagemId: IdMcp.nullable().optional(), complementoAvulso: z.object({ produtoOrigemId: IdMcp, grupoId: IdMcp, opcaoId: IdMcp }).strict().optional() }).strict()).min(1).max(100),
}).strict();
export const ReferenciaMcp = z.object({ id: IdMcp, versao: VersaoMcp }).strict();
export const LancamentoMcp = z.object({ descricao: z.string().min(1).max(500), tipo: z.enum(["RECEITA", "DESPESA"]), valor: DinheiroMcp, categoriaId: IdMcp, competencia: DataMcp, vencimento: DataMcp, fornecedorId: IdMcp.nullable().optional(), formaPagamentoId: IdMcp.nullable().optional(), observacoes: TextoMcp.optional() }).strict();
export const LancamentoCriacaoMcp = LancamentoMcp.extend({ frequencia: z.enum(["DIARIO", "SEMANAL", "QUINZENAL", "MENSAL"]).default("MENSAL"), parcelasVencimento: z.array(DataMcp).max(100).default([]) });
// Data da primeira solicitação em UTC + identificador estável. O prazo permite
// limpar recibos sem que uma chave antiga seja tratada novamente como criação.
export const ChaveMcp = z.string().min(27).max(100).regex(/^20\d{2}-\d{2}-\d{2}_[a-zA-Z0-9_-]{16,80}$/);
export function contratoEscrita(dados: z.ZodType, confirmacao: boolean) {
  const preparar = z.object({ etapa: z.literal("PREPARAR"), chave: ChaveMcp, dados }).strict();
  return confirmacao ? z.discriminatedUnion("etapa", [preparar, z.object({ etapa: z.literal("EXECUTAR"), chave: ChaveMcp, propostaId: z.string().uuid() }).strict()])
    : z.object({ chave: ChaveMcp, dados }).strict();
}
