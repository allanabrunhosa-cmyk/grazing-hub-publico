import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { caminhoDedicadoPermitido, contextoDoHost } from "@/lib/hosts";
import { middleware } from "@/middleware";
import { createSessionToken, sessionCookieOptions } from "@/lib/session-token";

let token: string;
const dedicado = "validades.grazinghub.com.br";
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", "chave-exclusiva-para-testes-sem-conta-real");
  token = await createSessionToken({ userId: "ficticio", nome: "Teste", email: "teste@example.invalid", admin: false });
});
afterEach(() => vi.unstubAllEnvs());

function pedido(host = dedicado, caminho = "/", autenticado = true, extras: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`https://${host}${caminho}`, {
    ...extras, headers: { host, ...(autenticado ? { cookie: `grazing_hub_session=${token}` } : {}), ...extras.headers },
  });
}

describe("entrada dedicada com sessão e lógica compartilhadas", () => {
  it.each(["grazinghub.com.br", "www.grazinghub.com.br"])("preserva o roteamento de %s", async host => {
    const resposta = await middleware(pedido(host, "/financeiro"));
    expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
    expect(resposta.headers.get("x-middleware-next")).toBe("1");
  });
  it("encaminha à rota canônica no mesmo host, preservando filtros sem rewrite", async () => {
    const resposta = await middleware(pedido(dedicado, "/?pagina=2&secao=validades&prazos=1"));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe(`https://${dedicado}/producao/etiquetas?pagina=2&secao=validades&prazos=1`);
    expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  });
  it("não permite que query ou protocolo encaminhado mudem a origem do destino", async () => {
    const resposta = await middleware(pedido(dedicado, "/?next=https://invasor.example", true, { headers: { "x-forwarded-proto": "http" } }));
    expect(new URL(resposta.headers.get("location")!).origin).toBe(`https://${dedicado}`);
  });
  it.each([dedicado, "grazinghub.com.br"])("protege conteúdo sem sessão em %s", async host => {
    const resposta = await middleware(pedido(host, "/producao/etiquetas", false));
    expect(resposta.headers.get("location")).toBe(`https://${host}/login`);
  });
  it("rejeita token adulterado e mantém login disponível ao token revogado", async () => {
    token += "invalido";
    expect((await middleware(pedido())).headers.get("location")).toBe(`https://${dedicado}/login`);
    expect((await middleware(pedido(dedicado, "/login"))).headers.get("x-middleware-next")).toBe("1");
  });
  it.each(["/login", "/login/recuperar", "/login/redefinir", "/browser-print/BrowserPrint.min.js", "/marca/grazing-table-co-monocromatica.png", "/_next/static/chunks/app.js"])("preserva recurso necessário %s", async caminho => {
    expect((await middleware(pedido(dedicado, caminho, false))).status).toBe(200);
  });
  it.each(["/financeiro", "/compras", "/api/notas-fiscais", "/configuracoes/usuarios", "/login-falso", "/financeiro.png"])("não expõe outros módulos no subdomínio: %s", async caminho => {
    expect((await middleware(pedido(dedicado, caminho))).status).toBe(404);
  });
  it("mantém o caminho antigo em ambos os hosts", async () => {
    for (const host of [dedicado, "grazinghub.com.br"]) {
      expect((await middleware(pedido(host, "/producao/etiquetas"))).headers.get("x-middleware-next")).toBe("1");
    }
  });
  it("preserva método de POST legado na raiz e deixa ação canônica passar", async () => {
    const extras = { method: "POST", headers: { origin: `https://${dedicado}`, "next-action": "id-ficticio" } };
    const raiz = await middleware(pedido(dedicado, "/", true, extras));
    expect(raiz.status).toBe(307);
    expect(raiz.headers.get("location")).toBe(`https://${dedicado}/producao/etiquetas`);
    expect((await middleware(pedido(dedicado, "/producao/etiquetas", true, extras))).headers.get("x-middleware-next")).toBe("1");
  });
  it("encaminha favoritos do host anterior ao novo endereço com os filtros", async () => {
    const resposta = await middleware(pedido("etiquetas.grazinghub.com.br", "/producao/etiquetas?secao=validades&pagina=2", false));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe(`https://${dedicado}/producao/etiquetas?secao=validades&pagina=2`);
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  });
  it("preserva conectores e POSTs do host anterior com sua própria origem", async () => {
    const antigo = "etiquetas.grazinghub.com.br";
    const conector = await middleware(pedido(antigo, "/api/etiquetas/conector/comunicacao", false, { method: "POST" }));
    expect(conector.headers.get("x-middleware-next")).toBe("1");
    const acao = await middleware(pedido(antigo, "/producao/etiquetas", true, { method: "POST", headers: { origin: `https://${antigo}` } }));
    expect(acao.headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(pedido(dedicado, "/login", false, { method: "POST", headers: { origin: `https://${antigo}` } }))).status).toBe(403);
  });
  it.each([undefined, "https://invasor.example", "https://grazinghub.com.br", `http://${dedicado}`, `https://${dedicado}.example`])("bloqueia POST de origem divergente/ausente: %s", async origem => {
    expect((await middleware(pedido(dedicado, "/login", false, { method: "POST", headers: origem ? { origin: origem } : {} }))).status).toBe(403);
  });
  it("não compartilha cookie com todos os subdomínios nem muda sua proteção", () => {
    expect(sessionCookieOptions).not.toHaveProperty("domain");
    expect(sessionCookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
  it("admite somente a API dedicada do conector sem cookie de pessoa", async () => {
    const caminho = "/api/etiquetas/conector/comunicacao";
    expect((await middleware(pedido(dedicado, caminho, false, { method: "POST" }))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(pedido(dedicado, "/api/etiquetas/outra", false))).status).toBe(404);
    expect((await middleware(pedido("grazinghub.com.br", caminho, false))).headers.get("location")).toBe("https://grazinghub.com.br/login");
  });
});

describe("host explícito, sem confiar em encaminhamento do cliente", () => {
  it.each(["invasor.example", "grazinghub.com.br.example", "grazinghub.com.br:444", "localhost:3000", "179.199.142.19"])("recusa host inesperado em produção: %s", async host => {
    expect((await middleware(pedido(host))).status).toBe(421);
  });
  it.each(["invasor.example", "grazinghub.com.br", `${dedicado}, invasor.example`])("recusa X-Forwarded-Host divergente: %s", async host => {
    expect((await middleware(pedido(dedicado, "/", true, { headers: { "x-forwarded-host": host } }))).status).toBe(421);
  });
  it("aceita encaminhamento consistente e usa protocolo fixo nos redirects", async () => {
    expect((await middleware(pedido(dedicado, "/", false, { headers: { "x-forwarded-host": dedicado, "x-forwarded-proto": "http" } }))).headers.get("location")).toBe(`https://${dedicado}/login`);
  });
  it("permite aliases locais somente fora de produção", () => {
    const cabecalhos = new Headers({ host: "validades.localhost:3000" });
    expect(contextoDoHost(cabecalhos, false)).toMatchObject({ dedicado: true });
    expect(contextoDoHost(cabecalhos, true)).toBeNull();
    expect(contextoDoHost(new Headers())).toBeNull();
    expect(caminhoDedicadoPermitido("/sem-acesso")).toBe(true);
  });
});

describe("foto do catálogo de Validades", () => {
 it("permite apenas o caminho de foto e continua exigindo sessão de pessoa", async()=>{
  const foto="/api/etiquetas/produtos/item-ficticio/foto";
  expect(caminhoDedicadoPermitido(foto)).toBe(true);
  expect((await middleware(pedido(dedicado,foto,false))).headers.get("location")).toBe(`https://${dedicado}/login`);
  expect((await middleware(pedido(dedicado,foto,true))).headers.get("x-middleware-next")).toBe("1");
  expect((await middleware(pedido(dedicado,foto,true,{method:"POST",headers:{origin:"https://invasor.example"}}))).status).toBe(403);
 });
 it.each(["/api/etiquetas/produtos/","/api/etiquetas/produtos/item/segredo","/api/etiquetas/produtos/item/foto/extra","/api/insumos/item/foto"])("não amplia acesso a %s",caminho=>{
  expect(caminhoDedicadoPermitido(caminho)).toBe(false);
 });
});
