import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ErroCadastroVenda } from "@/lib/vendas/dominio";
const sim = vi.hoisted(() => ({ sessao: vi.fn(), permissao: vi.fn(), consultar: vi.fn(), banco: {} }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: sim.permissao }));
vi.mock("@/lib/prisma", () => ({ prisma: sim.banco }));
vi.mock("@/lib/vendas/clientes-unicidade", () => ({ consultarConflitosIdentidadeCliente: sim.consultar }));
import { POST } from "@/app/api/vendas/clientes/identidade/route";
const entrada = { contexto: "CLIENTES", clienteId: "", email: "pessoa@example.invalid", documento: null, tipo: "PF" };
type OpcoesRequisicao = { host?: string; origem?: string; dados?: unknown; corpo?: string; cabecalhos?: Record<string, string> };
function requisicao({ host = "grazinghub.com.br", origem = `https://${host}`, dados = entrada, corpo, cabecalhos = {} }: OpcoesRequisicao = {}) {
  const headers = new Headers({ host, origin: origem, "Content-Type": "application/json", "sec-fetch-site": "same-origin" });
  for (const [nome, valor] of Object.entries(cabecalhos)) headers.set(nome, valor);
  return new Request(`https://${host}/api/vendas/clientes/identidade`, { method: "POST", headers, body: corpo ?? JSON.stringify(dados) });
}
beforeEach(() => { vi.stubEnv("NODE_ENV", "production"); vi.resetAllMocks(); sim.sessao.mockResolvedValue({ userId: "sintetico" }); sim.permissao.mockResolvedValue(true); sim.consultar.mockResolvedValue({ email: true, documento: false }); });
afterEach(() => vi.unstubAllEnvs());
describe("consulta privada de identidade do cliente", () => {
  it.each([["grazinghub.com.br", "CLIENTES", "vendas.clientes"], ["grazinghub.com.br", "PEDIDOS", "vendas.pedidos"], ["pedidos.grazinghub.com.br", "PEDIDOS", "vendas.pedidos"]])("autoriza %s / %s e retorna somente flags", async (host, contexto, recurso) => {
    const r = await POST(requisicao({ host, dados: { ...entrada, contexto } }));
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ email: true, documento: false });
    expect(sim.permissao).toHaveBeenCalledExactlyOnceWith(recurso);
    expect(sim.consultar).toHaveBeenCalledExactlyOnceWith(sim.banco, { ...entrada, contexto });
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("recusa sessão ausente antes de ler cadastros", async () => {
    sim.sessao.mockResolvedValue(null);
    expect((await POST(requisicao())).status).toBe(401);
    expect(sim.permissao).not.toHaveBeenCalled(); expect(sim.consultar).not.toHaveBeenCalled();
  });
  it("recusa permissão ausente sem consultar o banco", async () => {
    sim.permissao.mockResolvedValue(false);
    expect((await POST(requisicao())).status).toBe(403); expect(sim.consultar).not.toHaveBeenCalled();
  });
  it.each<OpcoesRequisicao>([{ origem: "https://invasor.example" }, { origem: "" }, { cabecalhos: { "sec-fetch-site": "cross-site" } }, { cabecalhos: { "x-forwarded-host": "invasor.example" } }, { host: "validades.grazinghub.com.br" }, { host: "desconhecido.example" }, { host: "pedidos.grazinghub.com.br", dados: entrada }])("recusa origem, host ou contexto fora do acesso permitido: %s", async opcoes => {
    expect((await POST(requisicao(opcoes))).status).toBe(403); expect(sim.consultar).not.toHaveBeenCalled();
  });
  it.each([{ corpo: "{" }, { dados: [] }, { dados: null }, { dados: { ...entrada, contexto: "OUTRO" } }, { cabecalhos: { "content-type": "text/plain" } }, { cabecalhos: { "content-type": "application/jsonp" } }, { cabecalhos: { "content-type": "application/json, text/plain" } }])("recusa JSON/corpo inválido: %s", async opcoes => {
    expect((await POST(requisicao(opcoes))).status).toBe(400); expect(sim.consultar).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([{}, { "content-length": "1" }, { "content-length": "2049" }])("limita corpo a 2 KB mesmo sem tamanho declarado ou com declaração falsa: %s", async cabecalhos => {
    expect((await POST(requisicao({ dados: { ...entrada, email: "x".repeat(2049) }, cabecalhos }))).status).toBe(413); expect(sim.consultar).not.toHaveBeenCalled();
  });
  it.each([[new ErroCadastroVenda("Falha com dados privados"), 400], [new Error("Banco com informação privada"), 503]] as const)("não expõe erro interno na resposta HTTP%s", async (erro, status) => {
    sim.consultar.mockRejectedValue(erro);
    const r = await POST(requisicao()); expect(r.status).toBe(status);
    expect(JSON.stringify(await r.json())).not.toMatch(/privad|Banco/);
  });
});
