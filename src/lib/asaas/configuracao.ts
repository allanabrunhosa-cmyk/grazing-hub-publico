import "server-only";
import type { AmbienteAsaas } from "./dominio";

/** Sem ASAAS_AMBIENTE=PRODUCAO explícito, tudo aponta para o sandbox. */
export function ambienteAsaas(): AmbienteAsaas {
  return process.env.ASAAS_AMBIENTE === "PRODUCAO" ? "PRODUCAO" : "SANDBOX";
}
/** Produção exige a própria autorização, como as demais integrações do HUB. */
export function asaasAtivo() {
  const ambiente = ambienteAsaas();
  return process.env.ASAAS_ATIVO === "1" && !!process.env[`ASAAS_${ambiente}_API_KEY`] && (ambiente === "SANDBOX" || process.env.ASAAS_PRODUCAO_AUTORIZADA === "1");
}
/** O Asaas exige 32–255 caracteres sem espaços; nunca reutilizar a chave de API. */
export function tokenWebhookAsaas() {
  const token = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  return /^\S{32,255}$/.test(token) && !token.startsWith("$aact_") ? token : null;
}
export const notificarClienteAsaas = () => process.env.ASAAS_NOTIFICAR_CLIENTE === "1";
export function estadoConfiguracaoAsaas() {
  const ambiente = ambienteAsaas();
  return {
    ambiente, ativo: asaasAtivo(), ligado: process.env.ASAAS_ATIVO === "1",
    chave: !!process.env[`ASAAS_${ambiente}_API_KEY`], webhook: !!tokenWebhookAsaas(),
    producaoAutorizada: process.env.ASAAS_PRODUCAO_AUTORIZADA === "1",
  };
}
