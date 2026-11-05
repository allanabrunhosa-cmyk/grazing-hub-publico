import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), permissao: vi.fn(), notas: vi.fn(), alterar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: mocks.permissao }));
vi.mock("@/lib/prisma", () => ({ prisma: { notaFiscalServico: { findMany: mocks.notas } } }));
vi.mock("@/lib/nfse/situacao", () => ({ decidirNfse: mocks.alterar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { GET } from "@/app/api/nfse/exportar-xml/route";
import { POST } from "@/app/api/nfse/situacao/route";
beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ nome: "Teste" }); mocks.permissao.mockResolvedValue(true); });
describe("permissões e respostas das rotas NFS", () => {
  it("exige sessão e permissão antes de consultar ou alterar", async () => {
    mocks.sessao.mockResolvedValue(null);
    expect((await GET(new Request("https://teste/api/nfse/exportar-xml"))).status).toBe(401);
    expect((await POST(new Request("https://teste/api/nfse/situacao", { method: "POST" }))).status).toBe(401);
    mocks.sessao.mockResolvedValue({ nome: "Teste" }); mocks.permissao.mockResolvedValue(false);
    expect((await GET(new Request("https://teste/api/nfse/exportar-xml"))).status).toBe(403);
    expect((await POST(new Request("https://teste/api/nfse/situacao", { method: "POST" }))).status).toBe(403);
    expect(mocks.notas).not.toHaveBeenCalled(); expect(mocks.alterar).not.toHaveBeenCalled();
  });
  it("entrega o XML original com download e sem cache", async () => {
    const xml = '<NFSe assinado="sim">\r\n  Serviços &amp; Cia\r\n</NFSe>';
    mocks.notas.mockResolvedValue([{ id: "nota", numero: "42", xml }]);
    const resposta = await GET(new Request("https://teste/api/nfse/exportar-xml?id=nota"));
    expect(await resposta.text()).toBe(xml);
    expect(resposta.headers.get("content-disposition")).toContain('filename="nfse-42-nota.xml"');
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.notas.mock.calls[0][0].where).toMatchObject({
      dataEmissao: {},
      OR: [{ dataEmissao: { gte: new Date("2026-09-10") } }, { importadaManualmente: true }],
    });
  });
  it("recusa período inválido antes de consultar o banco", async () => {
    expect((await GET(new Request("https://teste/api/nfse/exportar-xml?de=2026-02-30"))).status).toBe(400);
    expect(mocks.notas).not.toHaveBeenCalled();
  });
  it("exporta período antigo somente dentro do recorte visível ou da exceção manual", async () => {
    mocks.notas.mockResolvedValue([]);
    await GET(new Request("https://teste/api/nfse/exportar-xml?de=2026-09-01&ate=2026-09-04"));
    expect(mocks.notas.mock.calls[0][0].where).toMatchObject({
      dataEmissao: { gte: new Date("2026-09-01"), lt: new Date("2026-09-05") },
      OR: [{ dataEmissao: { gte: new Date("2026-09-10") } }, { importadaManualmente: true }],
    });
  });
});

describe("vencimento opcional na decisão NFS-e", () => {
  function requisicao(dados: Record<string, unknown>) {
    return new Request("https://teste/api/nfse/situacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nfseId: "nota", decisao: "ACEITAR", ...dados }) });
  }

  it("transmite vencimento válido e a autoria da sessão", async () => {
    mocks.alterar.mockResolvedValue({ ok: true });
    expect((await POST(requisicao({ dataVencimento: "2026-10-20", autorNome: "Autor forjado" }))).status).toBe(200);
    expect(mocks.alterar).toHaveBeenCalledWith({ nfseId: "nota", decisao: "ACEITAR", dataVencimento: "2026-10-20", autorNome: "Teste" });
  });

  it("conserva o aceite sem vencimento", async () => {
    mocks.alterar.mockResolvedValue({ ok: true });
    expect((await POST(requisicao({}))).status).toBe(200);
    expect(mocks.alterar).toHaveBeenCalledWith({ nfseId: "nota", decisao: "ACEITAR", autorNome: "Teste" });
  });

  it.each(["2026-02-30", "2201-01-01", "2026-11-02T12:00:00Z", 20261102, {}])("recusa vencimento inválido antes do serviço (%s)", async dataVencimento => {
    expect((await POST(requisicao({ dataVencimento }))).status).toBe(400);
    expect(mocks.alterar).not.toHaveBeenCalled();
  });

  it("não aceita vencimento em uma recusa", async () => {
    expect((await POST(requisicao({ decisao: "RECUSAR", dataVencimento: "2026-10-20" }))).status).toBe(400);
    expect(mocks.alterar).not.toHaveBeenCalled();
  });

  it("retorna conflito sem anunciar sucesso após decisão concorrente", async () => {
    mocks.alterar.mockResolvedValue({ erro: "A situação mudou." });
    const resposta = await POST(requisicao({ dataVencimento: "2026-10-20" }));
    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toEqual({ erro: "A situação mudou." });
  });
});
