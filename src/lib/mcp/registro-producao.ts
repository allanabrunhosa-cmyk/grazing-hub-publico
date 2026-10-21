import { z } from "zod";
import { funcao } from "./definicao";
import { ConsultaMcp, DataMcp, IdMcp, VersaoMcp } from "./contratos-negocio";
import { QuantidadeCadastroMcp } from "./contratos-suprimentos";
const imprimir = z.object({ trabalhoId: IdMcp, pontoId: IdMcp }).strict();
export const EtiquetaMcp = z.object({ insumoId: IdMcp, conservacao: z.enum(["SECO", "REFRIGERADO", "CONGELADO", "APOS_ABERTO"]), quantidade: QuantidadeCadastroMcp, lote: z.string().max(80).default(""), marcaFornecedor: z.string().max(100).optional(), sif: z.string().regex(/^\d{1,20}$|^$/).optional(), validadeOriginal: DataMcp.optional(), tamanho: z.enum(["MM_60X40", "MM_60X60"]), mostrarHora: z.boolean().default(true), copias: z.number().int().min(1).max(100) }).strict();
export const FUNCOES_PRODUCAO_MCP = [
  funcao("etiquetas_consultar", "Validades", "Consultar trabalhos de validade com critérios da tela e paginação", "producao", "visualizar", ConsultaMcp.omit({ ativo: true }).extend({ validade: z.enum(["todas", "vencidas", "proximas", "vigentes"]).default("todas"), insumoId: IdMcp.optional() })),
  funcao("etiquetas_configuracao_produto", "Validades", "Consultar prazos configurados para um produto sem alterar trabalhos existentes", "producao.validades", "visualizar", z.object({ insumoId: IdMcp }).strict()),
  funcao("etiquetas_configurar_produto", "Validades", "Configurar prazos futuros do produto com versão; trabalhos já emitidos conservam sua fotografia", "producao.validades", "editar", z.object({ insumoId: IdMcp, versao: VersaoMcp, etiquetaHabilitada: z.boolean(), validadeSecoDias: z.string().regex(/^\d{1,4}$|^$/), validadeRefrigeradoDias: z.string().regex(/^\d{1,4}$|^$/), validadeCongeladoDias: z.string().regex(/^\d{1,4}$|^$/) }).strict(), true),
  funcao("etiquetas_preparar", "Validades", "Preparar trabalho real de etiqueta sem enviar à impressora", "producao", "adicionar", EtiquetaMcp),
  { ...funcao("etiquetas_imprimir", "Validades", "Enviar etiqueta preparada à fila do ponto ativo; enfileirado não comprova impressão física", "producao.imprimir", "adicionar", imprimir, true), externa: true, previaTransacional: true, destrutiva: false },
  { ...funcao("etiquetas_reimprimir", "Validades", "Reimprimir etiqueta com fotografia original pela fila existente", "producao.imprimir", "adicionar", imprimir, true), externa: true, previaTransacional: true, destrutiva: false },
  funcao("etiquetas_conferir_impressao", "Validades", "Declarar conferência humana da saída física de uma etiqueta já enviada ou exportada", "producao.imprimir", "adicionar", z.object({ trabalhoId: IdMcp }).strict(), true),
  funcao("etiquetas_pontos_consultar", "Validades", "Consultar estado operacional dos pontos e filas sem credenciais ou rede", "producao", "visualizar", ConsultaMcp),
] as const;
export type NomeProducaoMcp = typeof FUNCOES_PRODUCAO_MCP[number]["nome"];
