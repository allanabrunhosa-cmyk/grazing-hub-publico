import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  sessao: vi.fn(),
  podeAcessar: vi.fn(),
  importar: vi.fn(),
  revalidar: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: dependencias.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: dependencias.podeAcessar }));
vi.mock("@/lib/nfse/servico", () => ({ importarNfsePorChave: dependencias.importar }));
vi.mock("next/cache", () => ({ revalidatePath: dependencias.revalidar }));

import { POST } from "@/app/api/nfse/importar-chave/route";

beforeEach(() => {
  vi.resetAllMocks();
  dependencias.sessao.mockResolvedValue({ nome: "Administrador" });
  dependencias.podeAcessar.mockResolvedValue(true);
  dependencias.importar.mockResolvedValue({ nova: true });
});

describe("rota de importação de NFS-e pela chave", () => {
  it("exige sessão e permissão", async () => {
    dependencias.sessao.mockResolvedValue(null);
    expect((await POST(new Request("http://localhost", { method: "POST" }))).status).toBe(401);
    dependencias.sessao.mockResolvedValue({ nome: "Usuário" });
    dependencias.podeAcessar.mockResolvedValue(false);
    expect((await POST(new Request("http://localhost", { method: "POST" }))).status).toBe(403);
    expect(dependencias.importar).not.toHaveBeenCalled();
  });

  it("envia a chave ao serviço e revalida o manifesto", async () => {
    const chave = "12345678901234567890123456789012345678901234567890";
    const resposta = await POST(new Request("http://localhost/api/nfse/importar-chave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave }),
    }));
    expect(resposta.status).toBe(200);
    expect(dependencias.importar).toHaveBeenCalledWith(chave, "Administrador");
    expect(dependencias.revalidar).toHaveBeenCalledWith("/financeiro/manifesto-nfs");
    await expect(resposta.json()).resolves.toEqual({ mensagem: "NFS-e localizada e importada com sucesso." });
  });

  it("propaga erro de consulta sem gravar no manifesto", async () => {
    dependencias.importar.mockResolvedValue({ erro: "Chave não encontrada." });
    const resposta = await POST(new Request("http://localhost/api/nfse/importar-chave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: "123" }),
    }));
    expect(resposta.status).toBe(400);
    await expect(resposta.json()).resolves.toEqual({ erro: "Chave não encontrada." });
    expect(dependencias.revalidar).not.toHaveBeenCalled();
  });
});
