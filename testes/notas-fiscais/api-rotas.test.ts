import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  sessao: vi.fn(),
  podeAcessar: vi.fn(),
  agendar: vi.fn(),
  importar: vi.fn(),
  importarNaNota: vi.fn(),
  importarChave: vi.fn(),
  revalidar: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: dependencias.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: dependencias.podeAcessar }));
vi.mock("@/lib/sefaz/busca-agendada", () => ({ agendarBusca: dependencias.agendar }));
vi.mock("@/lib/sefaz/importar-xml-avulso", () => ({
  importarXmlAvulso: dependencias.importar,
  importarXmlNaNota: dependencias.importarNaNota,
}));
vi.mock("@/lib/sefaz/importar-chave", () => ({ importarPelaChave: dependencias.importarChave }));
vi.mock("next/cache", () => ({ revalidatePath: dependencias.revalidar }));

import { POST as buscar } from "@/app/api/notas-fiscais/buscar/route";
import { POST as importar } from "@/app/api/notas-fiscais/importar-xml/route";
import { POST as importarChave } from "@/app/api/notas-fiscais/importar-chave/route";

beforeEach(() => {
  vi.resetAllMocks();
  dependencias.sessao.mockResolvedValue({ userId: "admin" });
  dependencias.podeAcessar.mockResolvedValue(true);
  dependencias.agendar.mockResolvedValue({ agendada: true, mensagem: "Agendada" });
  dependencias.importar.mockResolvedValue({ mensagem: "Importada" });
  dependencias.importarNaNota.mockResolvedValue({ ok: true });
  dependencias.importarChave.mockResolvedValue({ mensagem: "Importada pela chave" });
});

describe("rotas estáveis do Manifesto", () => {
  it("exige sessão e permissão para agendar a busca", async () => {
    dependencias.sessao.mockResolvedValue(null);
    const semSessao = await buscar();
    expect(semSessao.status).toBe(401);
    expect(dependencias.agendar).not.toHaveBeenCalled();

    dependencias.sessao.mockResolvedValue({ userId: "usuario" });
    dependencias.podeAcessar.mockResolvedValue(false);
    const semPermissao = await buscar();
    expect(semPermissao.status).toBe(403);
    expect(dependencias.agendar).not.toHaveBeenCalled();
  });

  it("agenda a busca sem depender do identificador de uma Server Action", async () => {
    const resposta = await buscar();
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ agendada: true, mensagem: "Agendada" });
    expect(dependencias.agendar).toHaveBeenCalledTimes(1);
  });

  it("valida as duas permissões e entrega o multipart à importação", async () => {
    const formulario = new FormData();
    formulario.set("arquivo", new Blob(["<xml/>"]), "nota.xml");
    const requisicao = new Request("http://localhost/api/notas-fiscais/importar-xml", {
      method: "POST",
      body: formulario,
    });

    const resposta = await importar(requisicao);
    expect(resposta.status).toBe(200);
    expect(dependencias.podeAcessar).toHaveBeenNthCalledWith(1, "notas", "editar");
    expect(dependencias.podeAcessar).toHaveBeenNthCalledWith(2, "notas", "adicionar");
    expect(dependencias.importar).toHaveBeenCalledWith(expect.any(FormData));
    expect(dependencias.revalidar).toHaveBeenCalledWith("/notas-fiscais");
  });

  it("usa somente a permissão de edição ao preencher uma nota já recebida", async () => {
    const formulario = new FormData();
    formulario.set("arquivo", new Blob(["<xml/>"]), "nota.xml");
    formulario.set("notaFiscalId", "nota-1");
    const requisicao = new Request("http://localhost/api/notas-fiscais/importar-xml", {
      method: "POST",
      body: formulario,
    });

    const resposta = await importar(requisicao);
    expect(resposta.status).toBe(200);
    expect(dependencias.podeAcessar).toHaveBeenCalledOnce();
    expect(dependencias.podeAcessar).toHaveBeenCalledWith("notas", "editar");
    expect(dependencias.importarNaNota).toHaveBeenCalledWith("nota-1", expect.any(FormData));
    expect(dependencias.importar).not.toHaveBeenCalled();
  });

  it("valida permissões e importa uma chave normalizada pela rota estável", async () => {
    const chave = "35260900608242000162550010004751441031899761";
    const resposta = await importarChave(new Request("http://localhost/api/notas-fiscais/importar-chave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave }),
    }));

    expect(resposta.status).toBe(200);
    expect(dependencias.podeAcessar).toHaveBeenCalledWith("notas", "adicionar");
    expect(dependencias.podeAcessar).toHaveBeenCalledWith("notas", "editar");
    expect(dependencias.importarChave).toHaveBeenCalledWith(chave);
    expect(dependencias.revalidar).toHaveBeenCalledWith("/notas-fiscais");
  });

  it("rejeita uma chave inválida antes de consultar a SEFAZ", async () => {
    const resposta = await importarChave(new Request("http://localhost/api/notas-fiscais/importar-chave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: "123" }),
    }));

    expect(resposta.status).toBe(400);
    expect(dependencias.importarChave).not.toHaveBeenCalled();
  });
});
