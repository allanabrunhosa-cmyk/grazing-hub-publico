import "server-only";
import { ErroAsaas, objeto, texto, type AmbienteAsaas } from "./dominio";

const BASES: Record<AmbienteAsaas, string> = { SANDBOX: "https://api-sandbox.asaas.com/v3", PRODUCAO: "https://api.asaas.com/v3" };

export class FalhaHttpAsaas extends ErroAsaas {
  /** status 0: sem resposta confiável; o efeito no Asaas é desconhecido. */
  constructor(public status: number, detalhe = "") {
    super(status === 401 || status === 403 ? "O Asaas recusou a chave de API. Confira a configuração no servidor."
      : status === 429 ? "Limite de requisições do Asaas atingido; tente novamente em instantes."
      : status === 0 || status >= 500 ? "O Asaas não respondeu de forma conclusiva."
      : detalhe || "O Asaas não aceitou a solicitação.");
  }
  get incerta() { return this.status === 0 || this.status >= 500; }
}
export function chaveApi(ambiente: AmbienteAsaas) {
  const chave = process.env[`ASAAS_${ambiente}_API_KEY`];
  if (!chave) throw new ErroAsaas("Configure a chave de API do Asaas no servidor.");
  return chave;
}
/** Destino fixo, sem redirects e sem registrar headers ou corpos. Retentativa é decisão de quem chama. */
export async function chamarAsaas(ambiente: AmbienteAsaas, caminho: string, op: { metodo?: "GET" | "POST" | "DELETE"; corpo?: unknown; consulta?: Record<string, string> } = {}) {
  const url = new URL(BASES[ambiente] + caminho);
  for (const [k, v] of Object.entries(op.consulta ?? {})) url.searchParams.set(k, v);
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: op.metodo ?? "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", "User-Agent": "GrazingHub/1.0", access_token: chaveApi(ambiente), ...(op.corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      // GET com corpo é recusado pelo Asaas (403).
      body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
    });
  } catch (e) {
    if (e instanceof ErroAsaas) throw e;
    throw new FalhaHttpAsaas(0);
  }
  let dados: unknown = null;
  try { dados = await resposta.json(); } catch { if (resposta.ok) throw new FalhaHttpAsaas(0); }
  if (!resposta.ok) {
    let detalhe = "";
    try { const erros = objeto(dados).errors; if (Array.isArray(erros) && erros[0]) detalhe = texto(objeto(erros[0]).description, 200); } catch { /* corpo de erro fora do contrato */ }
    throw new FalhaHttpAsaas(resposta.status, detalhe);
  }
  return dados;
}
