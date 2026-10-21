import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
afterEach(() => vi.unstubAllEnvs());
it("somente endpoints exatos MCP usam OAuth; gestão continua com login e hosts dedicados negam", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const caminho of ["/api/mcp", "/oauth/token", "/oauth/autorizar", "/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource/api/mcp"]) {
    const hub = await middleware(new NextRequest(`https://grazinghub.com.br${caminho}`, { headers: { host: "grazinghub.com.br" } }));
    expect(hub.headers.get("x-middleware-next")).toBe("1"); expect(hub.headers.get("cache-control")).toBe("no-store");
    for (const host of ["pedidos.grazinghub.com.br", "validades.grazinghub.com.br"]) expect((await middleware(new NextRequest(`https://${host}${caminho}`, { headers: { host } }))).status).toBe(404);
  }
  for (const caminho of ["/api/mcp/admin", "/configuracoes/integracoes/mcp"]) expect((await middleware(new NextRequest(`https://grazinghub.com.br${caminho}`, { headers: { host: "grazinghub.com.br" } }))).headers.get("location")).toBe("https://grazinghub.com.br/login");
});
