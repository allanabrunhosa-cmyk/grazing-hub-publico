import "server-only";
import type { AdaptadorFiscalSaida } from "./contrato";
import type { SessaoAtual } from "@/lib/session";
export const BLOQUEIO_PRODUCAO_FISCAL_SAIDA = "Produção fiscal bloqueada. Exige homologação comprovada e aprovação específica de ativação.";
export const BLOQUEIO_OPERACIONAL_BRASILNFE_M1 = "Transmissão automática, cancelamento e callback bloqueados. Homologação individual exige autorização específica.";
/** O fluxo manual resolve capacidade por sessão, documento e habilitação durável.
 * Salvar credenciais ou validar conexão não habilita a fila. Processadores sem
 * contexto permanecem bloqueados. Simuladores pertencem somente aos testes. */
export function obterAdaptadorFiscalSaida(): AdaptadorFiscalSaida | null;
export function obterAdaptadorFiscalSaida(contexto: { sessao: SessaoAtual; documentoId: string }): Promise<AdaptadorFiscalSaida | null>;
export function obterAdaptadorFiscalSaida(contexto?: { sessao: SessaoAtual; documentoId: string }): AdaptadorFiscalSaida | null | Promise<AdaptadorFiscalSaida | null> {
  // O executor sem sessão não ativa a emissão automática. O fluxo do pedido
  // resolve o adaptador real pelo registro durável, ambiente e documento.
  if (!contexto) return null;
  return import("./brasilnfe/operacional").then(m => m.obterAdaptadorOperacionalBrasilNfe(contexto.sessao, contexto.documentoId));
}
