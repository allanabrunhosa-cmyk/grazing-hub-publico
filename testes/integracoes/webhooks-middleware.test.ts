import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
afterEach(() => vi.unstubAllEnvs());
it("somente o POST exato dos webhooks dispensa login, apenas no host do HUB", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const pedir = (host: string, caminho: string, method = "POST") => middleware(new NextRequest(`https://${host}${caminho}`, { method, headers: { host } }));
  for (const caminho of ["/api/integracoes/asaas/webhook", "/api/integracoes/site/webhook"]) {
    const hub = await pedir("grazinghub.com.br", caminho);
    expect(hub.headers.get("x-middleware-next")).toBe("1"); expect(hub.headers.get("cache-control")).toBe("no-store");
    // Leitura sem sessão continua indo para o login; hosts dedicados não expõem a rota.
    expect((await pedir("grazinghub.com.br", caminho, "GET")).headers.get("location")).toBe("https://grazinghub.com.br/login");
    for (const host of ["pedidos.grazinghub.com.br", "validades.grazinghub.com.br"]) expect((await pedir(host, caminho)).status).toBe(404);
  }
  for (const caminho of ["/api/integracoes/asaas/webhook/extra", "/api/integracoes/asaas", "/api/integracoes/outro/webhook"]) expect((await pedir("grazinghub.com.br", caminho)).headers.get("location")).toBe("https://grazinghub.com.br/login");
});
