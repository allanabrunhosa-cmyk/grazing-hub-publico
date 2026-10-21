import "server-only";
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ErroPedidoVenda } from "./pedidos-dominio";
function segredo() { if (!process.env.AUTH_SECRET) throw new ErroPedidoVenda("Assinatura de cálculos pendente de configuração."); return new TextEncoder().encode(process.env.AUTH_SECRET); }
export function assinaturaEntradas(v: unknown) {
  const ordenar = (x: unknown): unknown => Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,ordenar(v)])) : x;
  return createHash("sha256").update(JSON.stringify(ordenar(v))).digest("hex");
}
export async function assinarEntrega(dados: Record<string, unknown>, finalidade = "frete") { return new SignJWT(dados).setProtectedHeader({ alg: "HS256" }).setIssuer("grazing-entregas-v1").setAudience(finalidade).setIssuedAt().setExpirationTime("10m").sign(segredo()); }
export async function verificarEntrega(token: string, vinculo: string | string[], finalidade = "frete") {
  try { if (token.length > 12000) throw new Error(); const { payload } = await jwtVerify(token, segredo(), { issuer: "grazing-entregas-v1", audience: finalidade, algorithms: ["HS256"] }); if (!(Array.isArray(vinculo) ? vinculo : [vinculo]).includes(String(payload.vinculo))) throw new Error(); return payload; }
  catch { throw new ErroPedidoVenda("Cálculo vencido, alterado ou de outras entradas. Calcule novamente."); }
}
