import { z } from "zod";
import { funcao } from "./definicao";
import { ConsultaMcp, DataMcp, DinheiroMcp, IdMcp, ReferenciaMcp } from "./contratos-negocio";
const alvo = ReferenciaMcp;
const negociar = alvo.extend({ motivo: z.string().min(1).max(1000) });
const externa = <N extends string>(nome: N, titulo: string, recurso: string, dados: z.ZodType) => ({ ...funcao(nome, "iFood", titulo, recurso, "editar", dados, true), externa: true, previaTransacional: true });
export const FUNCOES_CANAIS_FISCAL_MCP = [
  funcao("ifood_pedido_consultar", "iFood", "Consultar estado e ações válidas de pedido iFood sem dados pessoais", "vendas.pedidos", "visualizar", z.object({ id: IdMcp }).strict()),
  { ...funcao("ifood_motivos_cancelamento", "iFood", "Consultar motivos oficiais disponíveis; pode renovar a credencial técnica vigente, sem solicitar cancelamento", "vendas.pedidos.cancelar", "editar", z.object({ id: IdMcp }).strict()), externa: true, destrutiva: false },
  funcao("ifood_registrar_conferencia", "iFood", "Registrar conferência humana de resultado externo incerto sem reenviar nem confirmar resultado fictício", "vendas.pedidos.revisar", "editar", z.object({ id: IdMcp, acaoId: IdMcp, situacao: z.enum(["SEM_EVIDENCIA", "SUPORTE_ACIONADO", "DIVERGENCIA"]), referencia: z.string().min(1).max(80).regex(/^[A-Za-z0-9/_#.-]+$/) }).strict(), true),
  externa("ifood_confirmar", "Solicitar confirmação real no iFood pela fila vigente", "vendas.pedidos.confirmar", alvo),
  externa("ifood_iniciar_preparo", "Solicitar início de preparo ao iFood", "vendas.pedidos.producao", alvo),
  externa("ifood_marcar_pronto", "Solicitar estado pronto para retirada ao iFood", "vendas.pedidos.producao", alvo),
  externa("ifood_despachar", "Solicitar expedição ao iFood sem registrar pagamento", "vendas.pedidos.revisar", alvo),
  externa("ifood_cancelar", "Solicitar cancelamento ao iFood com código oficial e justificativa", "vendas.pedidos.cancelar", negociar.extend({ codigo: z.string().regex(/^\d{1,10}$/) })),
  externa("ifood_conferir_entrega", "Enviar código de entrega ao iFood pela fila vigente", "vendas.pedidos.revisar", alvo.extend({ codigo: z.string().regex(/^\d{4}$/) })),
  externa("ifood_aceitar_negociacao", "Solicitar aceite de negociação vigente no iFood", "vendas.pedidos.cancelar", negociar.extend({ codigo: z.string().max(100).optional() })),
  externa("ifood_rejeitar_negociacao", "Solicitar rejeição de negociação vigente no iFood", "vendas.pedidos.cancelar", negociar.extend({ codigo: z.string().max(100).optional() })),
  externa("ifood_alternativa_negociacao", "Solicitar alternativa financeira ou de prazo disponível na negociação iFood", "vendas.pedidos.cancelar", negociar.extend({ alternativaId: z.string().uuid(), codigo: z.string().regex(/^[A-Z_]{1,100}$/).optional(), valor: DinheiroMcp.optional(), minutos: z.string().regex(/^\d{1,4}$/).optional() })),
  funcao("notas_recebidas_consultar", "Manifesto NF-e", "Consultar notas já existentes no HUB sem SEFAZ ou emissão", "notas", "visualizar", ConsultaMcp.omit({ busca: true, ativo: true }).extend({ de: DataMcp.optional(), ate: DataMcp.optional() }).refine(d => !d.de || !d.ate || d.de <= d.ate)),
  funcao("nfse_consultar", "Manifesto NFS-e", "Consultar notas de serviço já existentes sem emissão ou consulta externa", "financeiro.nfse", "visualizar", ConsultaMcp.omit({ busca: true, ativo: true }).extend({ de: DataMcp.optional(), ate: DataMcp.optional() }).refine(d => !d.de || !d.ate || d.de <= d.ate)),
] as const;
export type NomeCanaisFiscalMcp = typeof FUNCOES_CANAIS_FISCAL_MCP[number]["nome"];
