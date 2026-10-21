import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CAMINHO_PEDIDOS, HOST_PEDIDOS, caminhoDedicadoPermitido, contextoDoHost } from "@/lib/hosts";
import { middleware } from "@/middleware";
import { createSessionToken, sessionCookieOptions } from "@/lib/session-token";

let token: string;
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", "chave-exclusiva-para-testes-sem-conta-real");
  token = await createSessionToken({ userId: "ficticio", nome: "Teste", email: "teste@example.invalid", admin: false });
});
afterEach(() => vi.unstubAllEnvs());

function requisicao(caminho: string, autenticado = true, extras: { method?: string; headers?: Record<string, string> } = {}, host = HOST_PEDIDOS) {
  return new NextRequest(`https://${host}${caminho}`, {
    ...extras,
    headers: { host, ...(autenticado ? { cookie: `grazing_hub_session=${token}` } : {}), ...extras.headers },
  });
}

describe("entrada dedicada do gestor de pedidos", () => {
  it("permite somente a consulta exata de identidade do cadastro, com sessão e origem próprias", async () => {
    const consulta = "/api/vendas/clientes/identidade";
    expect(caminhoDedicadoPermitido(consulta, "pedidos")).toBe(true);
    expect(caminhoDedicadoPermitido(consulta, "etiquetas")).toBe(false);
    expect((await middleware(requisicao(consulta, true, { method: "POST", headers: { origin: `https://${HOST_PEDIDOS}` } }))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(requisicao(consulta, false, { method: "POST", headers: { origin: `https://${HOST_PEDIDOS}` } }))).headers.get("location")).toBe(`https://${HOST_PEDIDOS}/login`);
    expect((await middleware(requisicao(consulta, true, { method: "POST", headers: { origin: "https://invasor.example" } }))).status).toBe(403);
    for (const caminho of ["/api/vendas/clientes", consulta + "/extra", "/api/vendas/clientes/outro"]) {
      expect(caminhoDedicadoPermitido(caminho, "pedidos")).toBe(false);
      expect((await middleware(requisicao(caminho))).status).toBe(404);
    }
  });
  it("permite somente a foto privada necessária ao detalhe mantendo a sessão", async () => {
    const foto = "/api/vendas/fotos/foto-ficticia_123";
    expect(caminhoDedicadoPermitido(foto, "pedidos")).toBe(true);
    expect((await middleware(requisicao(foto))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(requisicao(foto, false))).headers.get("location")).toBe(`https://${HOST_PEDIDOS}/login`);
    expect(caminhoDedicadoPermitido(foto, "etiquetas")).toBe(false);
    for (const caminho of ["/api/vendas/fotos", foto + "/extra", "/api/vendas/fotos/../privada", "/api/vendas/fotos/" + "a".repeat(101), "/api/vendas/produtos"]) {
      expect(caminhoDedicadoPermitido(caminho, "pedidos")).toBe(false);
      expect((await middleware(requisicao(caminho))).status).toBe(404);
    }
  });
  it("separa callback fiscal autenticado pelo adaptador dos arquivos protegidos por sessão", async () => {
    const arquivo = "/api/fiscal-saida/documento-ficticio/arquivo";
    expect((await middleware(requisicao(arquivo))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(requisicao(arquivo, false))).headers.get("location")).toContain("/login");
    const callback = "/api/fiscal-saida/retorno";
    expect((await middleware(requisicao(callback, false, { method: "POST" }))).status).toBe(404);
    expect((await middleware(requisicao(callback, false, { method: "POST" }, "grazinghub.com.br"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(requisicao("/api/fiscal-saida/qualquer", false, {}, "grazinghub.com.br"))).headers.get("location")).toContain("/login");
  });
  it("identifica Pedidos separadamente de Etiquetas e do HUB", () => {
    expect(contextoDoHost(new Headers({ host: HOST_PEDIDOS }))).toMatchObject({ identidade: "pedidos", dedicado: true, origem: `https://${HOST_PEDIDOS}` });
    expect(contextoDoHost(new Headers({ host: "validades.grazinghub.com.br" }))).toMatchObject({ identidade: "etiquetas" });
    expect(contextoDoHost(new Headers({ host: "grazinghub.com.br" }))).toMatchObject({ identidade: "hub", dedicado: false });
  });
  it("encaminha a raiz no mesmo host preservando a consulta, sem rewrite", async () => {
    const resposta = await middleware(requisicao("/?visao=lista&busca=Teste&status=PRONTO"));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe(`https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}?visao=lista&busca=Teste&status=PRONTO`);
    expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    expect(resposta.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it.each([CAMINHO_PEDIDOS, `${CAMINHO_PEDIDOS}/novo`, `${CAMINHO_PEDIDOS}/gestao`, `${CAMINHO_PEDIDOS}/prontidao`, `${CAMINHO_PEDIDOS}/pedido-ficticio`, `${CAMINHO_PEDIDOS}/pedido-ficticio/operacao`, `${CAMINHO_PEDIDOS}/pedido-ficticio/comanda`, "/sem-acesso"])("permite página necessária %s mantendo proteção da sessão", async caminho => {
    expect((await middleware(requisicao(caminho))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(requisicao(caminho, false))).headers.get("location")).toBe(`https://${HOST_PEDIDOS}/login`);
  });
  it.each(["/financeiro", "/compras", "/producao/etiquetas", "/perfil", "/configuracoes/design", "/vendas/clientes", "/vendas/pedidos/producao", "/vendas/pedidos/calendario", "/vendas/pedidos/novo/comanda", "/vendas/pedidos/gestao/comanda", "/vendas/pedidos/prontidao/operacao", "/vendas/pedidos/pedido-ficticio/outra-rota", "/vendas/pedidos/pedido-ficticio/operacao/extra", "/api/notas-fiscais"])("não expõe módulo ou rota fora da lista: %s", async caminho => {
    expect(caminhoDedicadoPermitido(caminho, "pedidos")).toBe(false);
    expect((await middleware(requisicao(caminho))).status).toBe(404);
  });
  it.each(["/login", "/login/recuperar", "/login/redefinir", "/icon", "/marca/grazing-table-co-monocromatica.png", "/_next/static/chunks/app.js"])("mantém acesso público necessário a %s", async caminho => {
    expect((await middleware(requisicao(caminho, false))).headers.get("x-middleware-next")).toBe("1");
  });
  it("preserva POST canônico com origem exata e método no encaminhamento da raiz", async () => {
    const extras = { method: "POST", headers: { origin: `https://${HOST_PEDIDOS}`, "next-action": "id-ficticio" } };
    const resposta = await middleware(requisicao("/", true, extras));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe(`https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}`);
    expect((await middleware(requisicao(CAMINHO_PEDIDOS, true, extras))).headers.get("x-middleware-next")).toBe("1");
  });
  it.each([undefined, "https://grazinghub.com.br", "https://invasor.example", `http://${HOST_PEDIDOS}`])("recusa POST com origem ausente/divergente: %s", async origin => {
    expect((await middleware(requisicao("/login", false, { method: "POST", headers: origin ? { origin } : {} }))).status).toBe(403);
  });
  it("rejeita encaminhamento de host divergente e token adulterado", async () => {
    expect((await middleware(requisicao("/", true, { headers: { "x-forwarded-host": "grazinghub.com.br" } }))).status).toBe(421);
    token += "invalido";
    expect((await middleware(requisicao(CAMINHO_PEDIDOS))).headers.get("location")).toBe(`https://${HOST_PEDIDOS}/login`);
  });
  it("aceita alias local somente fora de produção e mantém cookie host-only", () => {
    const cabecalhos = new Headers({ host: "pedidos.localhost:3000" });
    expect(contextoDoHost(cabecalhos, false)).toMatchObject({ identidade: "pedidos", dedicado: true, origem: "http://pedidos.localhost:3000" });
    expect(contextoDoHost(cabecalhos, true)).toBeNull();
    expect(sessionCookieOptions).not.toHaveProperty("domain");
  });
  it("não estende a exceção de autenticação do conector de Etiquetas para Pedidos", async () => {
    const caminho = "/api/etiquetas/conector/comunicacao";
    expect(caminhoDedicadoPermitido(caminho, "etiquetas")).toBe(true);
    expect(caminhoDedicadoPermitido(caminho, "pedidos")).toBe(false);
    expect((await middleware(requisicao(caminho, false, { method: "POST" }))).status).toBe(404);
    expect((await middleware(requisicao(caminho, false, { method: "POST" }, "validades.grazinghub.com.br"))).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("links de pedidos abrem a interface verde a partir do HUB", () => {
  const caminhos = [CAMINHO_PEDIDOS, `${CAMINHO_PEDIDOS}/novo`, `${CAMINHO_PEDIDOS}/gestao`, `${CAMINHO_PEDIDOS}/prontidao`, `${CAMINHO_PEDIDOS}/pedido-ficticio`, `${CAMINHO_PEDIDOS}/pedido-ficticio/operacao`, `${CAMINHO_PEDIDOS}/pedido-ficticio/comanda`];
  it.each(["grazinghub.com.br", "www.grazinghub.com.br"].flatMap(host => ["GET", "HEAD"].flatMap(method => caminhos.map(caminho => [host, method, caminho]))))("%s %s %s preserva caminho e filtros na origem fixa", async (host, method, caminho) => {
    const resposta = await middleware(requisicao(`${caminho}?busca=Teste&status=PRONTO`, true, { method, headers: { "x-forwarded-proto": "http" } }, host));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe(`https://${HOST_PEDIDOS}${caminho}?busca=Teste&status=PRONTO`);
    expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each([["producao", "quadros"], ["calendario", "calendario"]])("favorito legado %s abre modo %s mantendo demais parâmetros", async (caminho, modo) => {
    const resposta = await middleware(requisicao(`${CAMINHO_PEDIDOS}/${caminho}?busca=Teste&data=2026-09-30&modo=lista`, true, {}, "grazinghub.com.br"));
    const destino = new URL(resposta.headers.get("location")!);
    expect(destino.origin).toBe(`https://${HOST_PEDIDOS}`);
    expect(destino.pathname).toBe(CAMINHO_PEDIDOS);
    expect(Object.fromEntries(destino.searchParams)).toEqual({ busca: "Teste", data: "2026-09-30", modo });
  });
  it.each(caminhos)("POST legado conserva transporte no HUB em %s", async caminho => {
    const resposta = await middleware(requisicao(caminho, true, { method: "POST", headers: { origin: "https://grazinghub.com.br", "next-action": "id-ficticio" } }, "grazinghub.com.br"));
    expect(resposta.headers.get("location")).toBeNull();
    expect(resposta.headers.get("x-middleware-next")).toBe("1");
  });
  it("exige sessão antes de encaminhar e não amplia o prefixo para outros módulos", async () => {
    expect((await middleware(requisicao(`${CAMINHO_PEDIDOS}/novo`, false, {}, "grazinghub.com.br"))).headers.get("location")).toBe("https://grazinghub.com.br/login");
    expect((await middleware(requisicao("/vendas/clientes", true, {}, "grazinghub.com.br"))).headers.get("x-middleware-next")).toBe("1");
  });
});
