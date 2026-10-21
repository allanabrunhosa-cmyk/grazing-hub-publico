import { z } from "zod";
import { UnidadeMedida, MotivoPerda, TipoEstoque, TipoProdutoGlobal } from "@/generated/prisma/browser";
import { ConsultaMcp, DataMcp, DinheiroMcp, IdMcp, TextoMcp, VersaoMcp } from "./contratos-negocio";
export const UnidadeMcp = z.enum(UnidadeMedida);
export const QuantidadeEstoqueMcp = z.string().regex(/^\d{1,9}(\.\d{1,6})?$/);
export const QuantidadeCadastroMcp = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/);
export const CustoMcp = z.string().regex(/^\d{1,8}(\.\d{1,4})?$/);
export const RevisaoMcp = z.object({ id: IdMcp, revisao: z.iso.datetime() }).strict();
export const FornecedorMcp = z.object({ nome: z.string().min(1).max(160), razaoSocial: z.string().max(200).nullable().default(null), cnpj: z.string().regex(/^\d{14}$|^$/).default(""),
  email: z.email().max(254).nullable().default(null), site: z.url().max(300).nullable().default(null), contatoNome: z.string().max(160).nullable().default(null), telefone: z.string().max(30).nullable().default(null),
  prazoPagamentoDias: z.number().int().min(0).max(3650).nullable().default(null), prazoEntregaDias: z.number().int().min(0).max(3650).nullable().default(null), observacoes: TextoMcp.nullable().default(null),
  canaisPedido: z.array(IdMcp).max(30).default([]), formasPagamento: z.array(IdMcp).max(30).default([]), ativo: z.boolean().default(true) }).strict();
export const BeneficiarioMcp = z.object({ nome: z.string().min(1).max(160), documento: z.string().regex(/^\d{11}$|^\d{14}$|^$/).default(""), telefone: z.string().max(30).nullable().default(null), formaPagamentoId: IdMcp.nullable().default(null), ativo: z.boolean().default(true) }).strict();
export const InsumoMcp = z.object({ nome: z.string().min(1).max(160), especificacao: z.string().max(300).nullable().default(null), tipo: z.enum(TipoProdutoGlobal), unidade: UnidadeMcp,
  categoriaId: IdMcp.nullable().default(null), categoriaFinanceiraId: IdMcp.nullable().optional(), tipoEstoque: z.enum(TipoEstoque).nullable().default(null), centroCustoId: IdMcp.nullable().default(null),
  marcasHomologadas: z.array(z.string().min(1).max(100)).max(30).default([]), codigoEan: z.string().regex(/^\d{1,14}$|^$/).default(""), observacoes: TextoMcp.nullable().default(null),
  estoqueMinimo: QuantidadeCadastroMcp.default("0"), estoqueMaximo: QuantidadeCadastroMcp.nullable().default(null), custoMedio: CustoMcp.optional(), fornecedorPrincipalId: IdMcp.nullable().default(null), fornecedorIds: z.array(IdMcp).max(100).default([]),
  rendimentoQuantidade: QuantidadeCadastroMcp.nullable().default(null), rendimentoUnidade: UnidadeMcp.nullable().default(null), modoPreparo: z.array(TextoMcp).max(30).default([]), tempoPreparoMinutos: z.number().int().min(0).max(999999).nullable().default(null),
  conversoes: z.array(z.object({ unidade: UnidadeMcp, fator: QuantidadeEstoqueMcp }).strict()).max(19).default([]),
  componentes: z.array(z.object({ componenteId: IdMcp, quantidade: QuantidadeEstoqueMcp, observacaoPorcao: z.string().max(160).nullable().optional() }).strict()).max(100).default([]), ativo: z.boolean().default(true) }).strict();
export const PorcaoMcp = z.object({ insumoId: IdMcp, nome: z.string().min(1).max(120), quantidade: z.string().regex(/^\d{1,9}(\.\d{1,9})?$/), unidade: UnidadeMcp, quantidadeMedida: z.string().regex(/^\d{1,9}(\.\d{1,9})?$/).optional(), unidadeMedida: z.string().min(1).max(100).optional() }).strict();
export const CompraMcp = z.object({ fornecedorId: IdMcp.nullable(), fornecedorAvulso: z.string().max(200).nullable().optional(), usoConsumo: z.boolean().default(false), previsaoEntrega: DataMcp.nullable(), observacoes: TextoMcp.nullable(),
  itens: z.array(z.object({ pedidoItemOriginalId: IdMcp.optional(), insumoId: IdMcp.nullable(), descricao: z.string().max(300).optional(), quantidade: QuantidadeCadastroMcp, unidadeCompra: UnidadeMcp, precoUnitario: CustoMcp.nullable(), conversao: z.object({ fator: QuantidadeEstoqueMcp, unidadePrincipal: UnidadeMcp }).strict().nullable().optional() }).strict()).min(1).max(100) }).strict();
export const ReceberCompraMcp = z.object({ id: IdMcp, revisao: z.iso.datetime(), dataRecebimento: DataMcp,
  itens: z.array(z.object({ pedidoItemId: IdMcp.nullable(), insumoId: IdMcp.nullable(), quantidadeRecebida: QuantidadeCadastroMcp, lote: z.string().max(100).nullable(), validade: DataMcp.nullable(), qualidadeOk: z.boolean() }).strict()).min(1).max(100) }).strict();
export const PerdaMcp = z.object({ insumoId: IdMcp, localId: IdMcp, motivo: z.enum(MotivoPerda), categoriaPerdaId: IdMcp.nullable().optional(), motivoPersonalizado: z.string().max(200).nullable().optional(), quantidade: QuantidadeEstoqueMcp, observacao: TextoMcp.nullable().default(null), data: DataMcp }).strict();
export const EntradaEstoqueMcp = z.object({ tipo: z.enum(["COMPRA_SIMPLES", "OUTRO_MOTIVO"]), itens: z.array(z.object({ insumoId: IdMcp, localId: IdMcp, quantidade: QuantidadeEstoqueMcp, fatorConversao: QuantidadeEstoqueMcp.optional(), valorProdutos: DinheiroMcp }).strict()).min(1).max(100),
  fornecedorId: IdMcp.nullable(), frete: DinheiroMcp.default("0"), desconto: DinheiroMcp.default("0"), custosAdicionais: z.array(z.object({ descricao: z.string().min(1).max(200), valor: DinheiroMcp }).strict()).max(30).default([]), data: DataMcp,
  dataVencimento: DataMcp.nullable(), pago: z.boolean().default(false), dataPagamento: DataMcp.nullable(), contaBancariaId: IdMcp.nullable(), observacao: TextoMcp.nullable().default(null),
  formaPagamento: z.enum(["BOLETO", "PIX", "CARTAO"]).optional(), cartaoCreditoId: IdMcp.nullable().optional(), dataCompra: DataMcp.nullable().optional(), parcelaCartao: z.number().int().min(1).max(120).optional() }).strict();
export const ContagemInicioMcp = z.object({ localId: IdMcp, escopo: z.discriminatedUnion("tipo", [z.object({ tipo: z.literal("TODOS") }).strict(), z.object({ tipo: z.literal("ITENS"), insumoIds: z.array(IdMcp).min(1).max(100) }).strict(), z.object({ tipo: z.literal("CATEGORIA"), categoriaIds: z.array(IdMcp).min(1).max(100) }).strict()]) }).strict();
export const ProducaoMcp = z.object({ preparacaoId: IdMcp, revisao: z.iso.datetime(), localId: IdMcp, quantidade: QuantidadeEstoqueMcp, data: DataMcp, motivo: TextoMcp.min(3), ingredientes: z.array(z.object({ insumoId: IdMcp, quantidade: QuantidadeEstoqueMcp }).strict()).min(1).max(100) }).strict();
export const ConsultaEstoqueMcp = ConsultaMcp.extend({ insumoId: IdMcp.optional(), localId: IdMcp.optional(), de: DataMcp.optional(), ate: DataMcp.optional() }).refine(d => !d.de || !d.ate || d.de <= d.ate, { message: "Período inválido." });
export const ReferenciaPorcaoMcp = z.object({ id: IdMcp, versao: VersaoMcp }).strict();
