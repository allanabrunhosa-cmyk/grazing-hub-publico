import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), pode: vi.fn(), obter: vi.fn(), corrigir: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: mocks.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: mocks.pode }));
vi.mock("@/lib/nfse/correcao", () => ({ obterCorrecaoNfse: mocks.obter, corrigirNfse: mocks.corrigir }));
vi.mock("@/lib/nfse/servico", () => ({ lancarNfse: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
import { GET, PATCH } from "@/app/api/nfse/lancar/route";
beforeEach(() => {
  vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ userId: "autor", nome: "Autor validado" }); mocks.pode.mockResolvedValue(true);
  mocks.obter.mockResolvedValue({ versao: "v", parcelas: [] }); mocks.corrigir.mockResolvedValue({ ok: true });
});
describe("rotas de correção NFS-e", () => {
  it("exige sessão e permissões antes de ler e alterar", async () => {
    mocks.sessao.mockResolvedValue(null);
    expect((await GET(new Request("https://teste/api/nfse/lancar?nfseId=nota"))).status).toBe(401);
    expect((await PATCH(new Request("https://teste/api/nfse/lancar", { method: "PATCH" }))).status).toBe(401);
    mocks.sessao.mockResolvedValue({ userId: "autor" }); mocks.pode.mockResolvedValue(false);
    expect((await GET(new Request("https://teste/api/nfse/lancar?nfseId=nota"))).status).toBe(403);
    expect((await PATCH(new Request("https://teste/api/nfse/lancar", { method: "PATCH" }))).status).toBe(403);
    expect(mocks.obter).not.toHaveBeenCalled(); expect(mocks.corrigir).not.toHaveBeenCalled();
  });
  it("retorna contexto privado sem cache", async () => {
    const res = await GET(new Request("https://teste/api/nfse/lancar?nfseId=nota"));
    expect(res.status).toBe(200); expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.obter).toHaveBeenCalledWith("nota", { userId: "autor", nome: "Autor validado" });
  });
  it("passa identidade da sessão e invalida consultas depois da correção", async () => {
    const corpo = { nfseId: "nota", motivo: "Correção justificada de teste", versao: "v", parcelas: [] };
    const res = await PATCH(new Request("https://teste/api/nfse/lancar", { method: "PATCH", body: JSON.stringify(corpo) }));
    expect(res.status).toBe(200); expect(mocks.corrigir).toHaveBeenCalledWith(corpo, { userId: "autor", nome: "Autor validado" });
    expect(mocks.revalidar).toHaveBeenCalledWith("/financeiro/manifesto-nfs");
  });
  it("recusa JSON inválido e devolve falha de negócio sem invalidar consultas", async () => {
    const malformado = await PATCH(new Request("https://teste/api/nfse/lancar", { method: "PATCH", body: "null" }));
    expect(malformado.status).toBe(400); expect(mocks.corrigir).not.toHaveBeenCalled();
    mocks.corrigir.mockResolvedValue({ erro: "A NFS-e mudou. Reabra." });
    const resposta = await PATCH(new Request("https://teste/api/nfse/lancar", { method: "PATCH", body: "{}" }));
    expect(resposta.status).toBe(400); expect(await resposta.json()).toEqual({ erro: "A NFS-e mudou. Reabra." });
    expect(mocks.revalidar).not.toHaveBeenCalled();
  });
});
