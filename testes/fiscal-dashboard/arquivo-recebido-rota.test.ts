import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sessao: vi.fn(), pode: vi.fn(), nota: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: m.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: m.pode }));
vi.mock("@/lib/prisma", () => ({ prisma: { notaFiscalRecebida: { findUnique: m.nota } } }));
import { GET } from "@/app/api/notas-fiscais/[id]/xml/route";
const chave = "1".repeat(44);
const xml = '<?xml version="1.0" encoding="UTF-8"?>\r\n<nfeProc><NFe><infNFe>Documento sintético &amp; íntegro</infNFe></NFe></nfeProc>';
const requisicao = () => new Request("https://hub.exemplo/api/notas-fiscais/nota/xml");
const contexto = (id = "nota") => ({ params: Promise.resolve({ id }) });
beforeEach(() => { vi.resetAllMocks(); m.sessao.mockResolvedValue({ userId: "sintetico" }); m.pode.mockResolvedValue(true); m.nota.mockResolvedValue({ chaveAcesso: chave, tipo: "PROC_NFE", xml }); });

describe("XML recebido no Dashboard: download privado e somente local", () => {
  it("exige sessão antes da autorização e da leitura", async () => {
    m.sessao.mockResolvedValue(null);
    expect((await GET(requisicao(), contexto())).status).toBe(401);
    expect(m.pode).not.toHaveBeenCalled(); expect(m.nota).not.toHaveBeenCalled();
  });
  it.each(["financeiro.fiscal.painel", "notas"])("recusa sem permissão de visualizar %s antes do banco", async recurso => {
    m.pode.mockImplementation(async r => r !== recurso);
    expect((await GET(requisicao(), contexto())).status).toBe(403);
    expect(m.pode).toHaveBeenCalledWith(recurso, "visualizar"); expect(m.nota).not.toHaveBeenCalled();
  });
  it.each(["", "../segredo", "x".repeat(101), 'nota"\r\nX-Teste: sim'])("recusa ID inválido: %s", async id => {
    expect((await GET(requisicao(), contexto(id))).status).toBe(400);
    expect(m.nota).not.toHaveBeenCalled();
  });
  it.each([null, { chaveAcesso: chave, tipo: "RES_NFE", xml: "<resNFe/>" }, { chaveAcesso: chave, tipo: "PROC_NFE", xml: null }, { chaveAcesso: chave, tipo: "PROC_NFE", xml: "   " }, { chaveAcesso: chave, tipo: "PROC_NFE", xml: '<!DOCTYPE x SYSTEM "file:///privado"><nfeProc/>' }])("informa ausência de XML completo sem importar ou manifestar", async nota => {
    m.nota.mockResolvedValue(nota);
    const r = await GET(requisicao(), contexto());
    expect(r.status).toBe(404); expect(await r.json()).toEqual({ erro: "XML completo não disponível para esta nota." });
    expect(m.nota).toHaveBeenCalledTimes(1);
  });
  it("preserva o arquivo original e fornece cabeçalhos seguros de download", async () => {
    const r = await GET(requisicao(), contexto());
    expect(r.status).toBe(200); expect(await r.text()).toBe(xml);
    expect(r.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(r.headers.get("Content-Disposition")).toBe(`attachment; filename="nota-recebida-${chave}.xml"`);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(m.nota).toHaveBeenCalledWith({ where: { id: "nota" }, select: { tipo: true, xml: true, chaveAcesso: true } });
  });
  it("usa um nome seguro mesmo se a chave armazenada for inválida", async () => {
    m.nota.mockResolvedValue({ chaveAcesso: 'x"\r\nX-Teste: sim', tipo: "PROC_NFE", xml });
    const r = await GET(requisicao(), contexto());
    expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="nota-recebida-nota.xml"');
  });
  it("não expõe erros internos de leitura", async () => {
    m.nota.mockRejectedValue(Error("conexão privada"));
    const r = await GET(requisicao(), contexto());
    expect(r.status).toBe(500); expect(await r.json()).toEqual({ erro: "Não foi possível baixar a nota. Tente novamente." });
  });
});
