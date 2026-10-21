/** Smoke HTTP do build local. Não cria usuário, trabalho ou dados de negócio. */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken } from "@/lib/session-token";

describe.skipIf(process.env.ETIQUETAS_HTTP_TESTE !== "1")("Next de produção local, HTTP real sem mutações", () => {
  const principal = "grazinghub.com.br";
  const dedicado = "validades.grazinghub.com.br";
  beforeAll(() => {
    config({ quiet: true });
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Teste HTTP somente com banco local.");
  });
  // node:http preserva Host explicitamente, simulando passHostHeader do Traefik.
  const chamar = (host: string, caminho: string, opcoes: { method?: string; headers?: Record<string, string>; body?: string } = {}) => new Promise<Response>((resolver, rejeitar) => {
    const requisicao = request({ hostname: "localhost", port: 3107, path: caminho, method: opcoes.method ?? "GET", headers: { host, ...opcoes.headers } }, resposta => {
      const partes: Buffer[] = [];
      resposta.on("data", parte => partes.push(Buffer.from(parte)));
      resposta.on("end", () => resolver(new Response(Buffer.concat(partes), { status: resposta.statusCode, headers: Object.fromEntries(Object.entries(resposta.headers).filter(([, valor]) => valor !== undefined).map(([nome, valor]) => [nome, Array.isArray(valor) ? valor.join(", ") : valor!])) })));
    });
    requisicao.on("error", rejeitar);
    requisicao.setTimeout(10_000, () => requisicao.destroy(new Error("Timeout no Next local.")));
    requisicao.end(opcoes.body);
  });
  it.each([principal, dedicado])("conteúdo protegido e login existentes em %s", async host => {
    expect((await chamar(host, "/")).headers.get("location")).toBe(`https://${host}/login`);
    const login = await chamar(host, "/login");
    expect(login.status).toBe(200);
    const html = await login.text();
    expect(html).toContain(host === dedicado ? "Controle de validades" : "Bem-vindo de volta");
    expect(html.includes('data-identidade="etiquetas"')).toBe(host === dedicado);
    expect((await chamar(host, "/producao/etiquetas")).headers.get("location")).toBe(`https://${host}/login`);
  });
  it("serve o logo original antes do login sem liberar outros arquivos", async () => {
    const logo = await chamar(dedicado, "/logo-etiquetas.png");
    expect(logo.status).toBe(200);
    expect(logo.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await logo.arrayBuffer()).equals(await readFile("public/logo-etiquetas.png"))).toBe(true);
    const marca = await chamar(dedicado, "/marca/grazing-table-co-monocromatica.png");
    expect(marca.status).toBe(200);
    expect(marca.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await marca.arrayBuffer()).equals(await readFile("public/marca/grazing-table-co-monocromatica.png"))).toBe(true);
    expect((await chamar(dedicado, "/logo-inexistente.png")).status).toBe(404);
  });
  it("recusa host/origem e outros módulos antes de executar ações", async () => {
    expect((await chamar("invasor.example", "/")).status).toBe(421);
    expect((await chamar(dedicado, "/financeiro")).status).toBe(404);
    expect((await chamar(dedicado, "/login", { method: "POST", headers: { origin: "https://invasor.example" } })).status).toBe(403);
  });
  it("raiz autenticada encaminha à rota canônica preservando filtros e hostname", async () => {
    const token = await createSessionToken({ userId: `inexistente-${randomUUID()}`, nome: "Teste", email: "teste@example.invalid", admin: false });
    const resposta = await chamar(dedicado, "/?secao=validades&pagina=2", { headers: { cookie: `grazing_hub_session=${token}` } });
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe(`https://${dedicado}/producao/etiquetas?secao=validades&pagina=2`);
    expect(resposta.headers.get("cache-control")).toContain("no-store");
  });
  it.each(["/", "/producao/etiquetas"])("POST em %s chega à ação canônica e recusa usuário inexistente", async caminho => {
    // Token assinado apenas no localhost para ID aleatório inexistente, nunca uma pessoa real.
    const token = await createSessionToken({ userId: `inexistente-${randomUUID()}`, nome: "Teste", email: "teste@example.invalid", admin: true });
    const manifesto = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8"));
    const entrada = Object.entries(manifesto.node).find(([, valor]) => (valor as { exportedName: string }).exportedName === "prepararEtiquetaAction");
    if (!entrada) throw new Error("Execute npm run build antes do teste HTTP.");
    const opcoes = {
      method: "POST",
      headers: { origin: `https://${dedicado}`, "next-action": entrada[0], "content-type": "text/plain;charset=UTF-8", cookie: `grazing_hub_session=${token}` },
      body: "[{}]",
    };
    let resposta = await chamar(dedicado, caminho, opcoes);
    if (caminho === "/") {
      expect(resposta.status).toBe(307);
      expect(resposta.headers.get("location")).toBe(`https://${dedicado}/producao/etiquetas`);
      // Segue somente o destino explícito e mantém POST/corpo como exige HTTP 307.
      resposta = await chamar(dedicado, "/producao/etiquetas", opcoes);
    }
    expect([200, 303]).toContain(resposta.status);
    expect(resposta.headers.get("x-action-redirect")).toContain("/login");
  });
});
