import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarNotasPelaApi, importarChavePelaApi, importarXmlPelaApi } from "@/lib/notas-fiscais/api-cliente";

function respostaJson(conteudo: object, ok = true) {
  return {
    ok,
    redirected: false,
    headers: { get: () => "application/json" },
    json: async () => conteudo,
  } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("API estável do Manifesto", () => {
  it("agenda a busca por uma rota que permanece válida entre deploys", async () => {
    const requisicao = vi.fn().mockResolvedValue(respostaJson({ agendada: true, mensagem: "Agendada" }));
    vi.stubGlobal("fetch", requisicao);

    await expect(buscarNotasPelaApi()).resolves.toEqual({ agendada: true, mensagem: "Agendada" });
    expect(requisicao).toHaveBeenCalledWith("/api/notas-fiscais/buscar", expect.objectContaining({ method: "POST" }));
  });

  it("envia o XML por multipart na rota estável", async () => {
    const requisicao = vi.fn().mockResolvedValue(respostaJson({ mensagem: "Importada" }));
    vi.stubGlobal("fetch", requisicao);
    const formulario = new FormData();
    formulario.set("arquivo", new Blob(["<xml/>"]), "nota.xml");

    await expect(importarXmlPelaApi(formulario)).resolves.toEqual({ mensagem: "Importada" });
    expect(requisicao).toHaveBeenCalledWith(
      "/api/notas-fiscais/importar-xml",
      expect.objectContaining({ method: "POST", body: formulario })
    );
  });

  it("consulta a chave pela rota estável", async () => {
    const requisicao = vi.fn().mockResolvedValue(respostaJson({ mensagem: "Importada" }));
    vi.stubGlobal("fetch", requisicao);

    await expect(importarChavePelaApi("chave-44")).resolves.toEqual({ mensagem: "Importada" });
    expect(requisicao).toHaveBeenCalledWith(
      "/api/notas-fiscais/importar-chave",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ chave: "chave-44" }) })
    );
  });

  it("identifica a nota ao preencher um resumo já recebido", async () => {
    const requisicao = vi.fn().mockResolvedValue(respostaJson({ ok: true }));
    vi.stubGlobal("fetch", requisicao);
    const formulario = new FormData();
    formulario.set("arquivo", new Blob(["<xml/>"]), "nota.xml");

    await expect(importarXmlPelaApi(formulario, "nota-1")).resolves.toEqual({ ok: true });
    expect(formulario.get("notaFiscalId")).toBe("nota-1");
  });

  it("transforma redirecionamento de sessão em erro compreensível", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      redirected: true,
      headers: { get: () => "text/html" },
    }));

    await expect(buscarNotasPelaApi()).resolves.toEqual({
      erro: "Sua sessão expirou. Atualize a página e entre novamente.",
    });
  });
});
