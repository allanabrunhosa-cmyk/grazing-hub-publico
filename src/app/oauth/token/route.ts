import { randomUUID } from "node:crypto";
import { trocarCodigoOAuth } from "@/lib/mcp/oauth";
import { auditarMcp, lerCorpoLimitado, limitarMcp, limparRegistrosMcp, validarTransporteMcp } from "@/lib/mcp/servidor";
import { ErroMcp } from "@/lib/mcp/politica";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const correlacao = randomUUID();
  try {
    validarTransporteMcp(request);
    await limitarMcp("oauth:global", 120);
    await limparRegistrosMcp();
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new ErroMcp("invalid_request", 415, "Formato inválido.");
    const params = new URLSearchParams(await lerCorpoLimitado(request));
    if ([...params.keys()].some(k => params.getAll(k).length !== 1)) throw new ErroMcp("invalid_request", 400, "Parâmetro repetido.");
    const resposta = await trocarCodigoOAuth(Object.fromEntries(params));
    return Response.json(resposta.body, { status: resposta.status ?? 200, headers: { "Cache-Control": "no-store", Pragma: "no-cache", "X-Correlation-ID": correlacao } });
  } catch (error) {
    if (!(error instanceof ErroMcp && error.codigo === "rate_limit")) await auditarMcp({ correlacao, acao: "TOKEN_RECUSADO", resultado: "NEGADO" });
    return Response.json({ error: error instanceof ErroMcp ? error.codigo : "invalid_grant", error_description: "Não foi possível emitir a credencial. Reinicie a autorização no HUB." },
      { status: error instanceof ErroMcp ? error.status : 400, headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlacao } });
  }
}
