import "server-only";
import { ErroIfood, objeto } from "./dominio";

export class FalhaHttpIfood extends ErroIfood {
  constructor(public status: number, public esperaMs = 30000) {
    super(status === 401 || status === 403 ? "Autorização iFood indisponível. Confira o vínculo da loja." : status === 429 ? "Limite do iFood atingido; nova tentativa agendada." : status === 0 ? "Resposta iFood incerta; confira a reconciliação." : "O iFood não concluiu a solicitação. Confira a integração.");
  }
}
export function esperaResposta(h: Headers, agora = Date.now()) {
  const retry = h.get("retry-after"), reset = h.get("x-ratelimit-reset");
  const valor = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - agora) : Number(reset ?? 30) * 1000;
  return Number.isFinite(valor) ? Math.max(1000, valor) : 30000;
}
/** Destino fixo, sem redirects e sem log de headers/corpos privados. Retentativa é responsabilidade da fila. */
export async function chamarIfood(caminho: string, op: { token?: string; metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown; formulario?: Record<string, string>; merchant?: string } = {}) {
  let resposta: Response;
  try {
    resposta = await fetch("https://merchant-api.ifood.com.br" + caminho, {
      method: op.metodo ?? "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json", ...(op.token ? { Authorization: `Bearer ${op.token}` } : {}), ...(op.merchant ? { "x-polling-merchants": op.merchant } : {}), ...(op.formulario ? { "Content-Type": "application/x-www-form-urlencoded" } : op.corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: op.formulario ? new URLSearchParams(op.formulario) : op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
    });
  } catch { throw new FalhaHttpIfood(0); }
  if (!resposta.ok) throw new FalhaHttpIfood(resposta.status, esperaResposta(resposta.headers));
  if (resposta.status === 204 || resposta.status === 202) return { status: resposta.status, dados: null };
  try { return { status: resposta.status, dados: await resposta.json() as unknown }; }
  catch { throw new FalhaHttpIfood(0); }
}
export function lerToken(v: unknown) {
  const d = objeto(v);
  if (typeof d.accessToken !== "string" || !d.accessToken || typeof d.expiresIn !== "number" || !Number.isSafeInteger(d.expiresIn) || d.expiresIn <= 0) throw new ErroIfood("Token retornado fora do contrato.");
  return { token: d.accessToken, refresh: typeof d.refreshToken === "string" ? d.refreshToken : null, expiraEm: new Date(Date.now() + d.expiresIn * 1000) };
}
