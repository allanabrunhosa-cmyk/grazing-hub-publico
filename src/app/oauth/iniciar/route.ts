import { prisma } from "@/lib/prisma";
import { validarPedidoOAuth } from "@/lib/mcp/oauth";
import { enderecosMcp, exigirMcpAtivo, limitarMcp, limparRegistrosMcp } from "@/lib/mcp/servidor";
import { ErroMcp } from "@/lib/mcp/politica";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    await exigirMcpAtivo(); await limitarMcp("oauth:solicitacoes", 60); await limparRegistrosMcp();
    const url = new URL(request.url);
    if (url.search.length > 49152 || [...url.searchParams.keys()].some(k => url.searchParams.getAll(k).length !== 1)) throw new ErroMcp("invalid_request", 400, "Solicitação inválida.");
    const { parametros } = await validarPedidoOAuth(Object.fromEntries(url.searchParams));
    const nova = await prisma.mcpSolicitacaoOAuth.create({ data: { parametros, expiraEm: new Date(Date.now() + 600_000) } });
    return new Response(null, { status: 302, headers: { ...headers, Location: `${enderecosMcp().emissor}/oauth/autorizar?solicitacao=${nova.id}` } });
  } catch (e) { return Response.json({ error: e instanceof ErroMcp ? e.codigo : "invalid_request", mensagem: "Confira cliente, redirecionamento exato, escopos, resource e PKCE S256." }, { status: e instanceof ErroMcp ? e.status : 400, headers }); }
}
