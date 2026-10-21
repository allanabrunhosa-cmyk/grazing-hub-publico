import { HOST_PEDIDOS, type contextoDoHost } from "@/lib/hosts";

const ORIGEM_HUB_PUBLICA = "https://grazinghub.com.br";
const caminhoLocal = (v: string) => v.length <= 500 && v.startsWith("/") && !v.startsWith("//") && !/[\p{C}\\<>]/u.test(v);

/** Usa somente o contexto já validado pelo servidor. Não deriva destino de headers encaminhados. */
export function origemHubFiscalPedido(contexto: ReturnType<typeof contextoDoHost>): string | null {
  if (contexto?.identidade !== "pedidos") return null;
  if (contexto.host === HOST_PEDIDOS && contexto.origem === `https://${HOST_PEDIDOS}`) return ORIGEM_HUB_PUBLICA;
  const local = /^pedidos\.localhost(?::(\d{1,5}))?$/.exec(contexto.host);
  if (!local || contexto.origem !== `http://${contexto.host}`) return null;
  const porta = local[1] ? Number(local[1]) : null;
  if (porta !== null && (porta < 1 || porta > 65535)) return null;
  return `http://127.0.0.1${porta === null ? "" : `:${porta}`}`;
}

/** A origem é prop restrita do servidor; repetir a restrição evita destinos arbitrários no consumidor. */
export function destinoHubFiscalPedido(caminho: string, origem?: string | null): string | null {
  if (!caminhoLocal(caminho)) return null;
  if (origem === ORIGEM_HUB_PUBLICA) return `${origem}${caminho}`;
  const local = origem && /^http:\/\/(localhost|127\.0\.0\.1)(?::(\d{1,5}))?$/.exec(origem);
  if (local && (!local[2] || Number(local[2]) >= 1 && Number(local[2]) <= 65535)) return `${origem}${caminho}`;
  return caminho;
}
