import { beforeEach, describe, expect, it, vi } from "vitest";

const sim = vi.hoisted(() => ({ sessao: vi.fn(), exigir: vi.fn(), pode: vi.fn(), consultar: vi.fn(), exportar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.exigir, podeAcessar: sim.pode }));
vi.mock("@/lib/vendas/bi-consultas", () => ({ consultarBiVendas: sim.consultar, exportarConsultaBiCsv: sim.exportar }));
import { consultarBiAction } from "@/app/(protegido)/vendas/bi/actions";
import { GET } from "@/app/api/vendas/bi/exportar/route";
import { entradaBiDaUrl } from "@/lib/vendas/bi-url";
import { ErroBi, normalizarFiltrosBi } from "@/lib/vendas/bi-filtros";

beforeEach(() => {
  vi.resetAllMocks(); sim.sessao.mockResolvedValue({ userId: "teste" });
  sim.pode.mockResolvedValue(false); sim.exportar.mockResolvedValue("\ufeffIndicador;Valor\r\nVendas;10,00");
});

describe("autorização do BI no servidor", () => {
  it("não consulta a fonte quando a permissão de BI foi negada", async () => {
    sim.exigir.mockRejectedValue(new Error("negado"));
    await expect(consultarBiAction({})).rejects.toThrow("negado");
    expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.pode).not.toHaveBeenCalled();
  });
  it("resolve custos, contatos, exportação e pedidos no servidor a cada consulta", async () => {
    sim.pode.mockImplementation(async (recurso: string) => recurso === "vendas.bi.custos");
    sim.consultar.mockResolvedValue({ indicadores: {} });
    await consultarBiAction({ de: "2026-01-01" });
    expect(sim.exigir).toHaveBeenCalledWith("vendas.bi");
    expect(sim.consultar).toHaveBeenCalledWith({ de: "2026-01-01" }, { contatos: false, custos: true, exportar: false, pedidos: false });
  });
  it("oculta falha interna e permite nova tentativa sem devolver dados sensíveis", async () => {
    sim.consultar.mockRejectedValue(new Error("credencial privada"));
    const resultado = await consultarBiAction({});
    expect(resultado).toEqual({ erro: "Não foi possível consultar o Dashboard. Tente novamente." });
    expect(JSON.stringify(resultado)).not.toContain("privada");
  });
  it("rejeita exportação sem sessão antes de consultar permissões ou dados", async () => {
    sim.sessao.mockResolvedValue(null);
    const resposta = await GET(new Request("https://grazinghub.com.br/api/vendas/bi/exportar"));
    expect(resposta.status).toBe(401); expect(sim.pode).not.toHaveBeenCalled(); expect(sim.exportar).not.toHaveBeenCalled();
  });
  it.each(["vendas.bi", "vendas.bi.exportar"])("exige também %s para exportar", async recursoNegado => {
    sim.pode.mockImplementation(async (recurso: string) => recurso !== recursoNegado);
    const resposta = await GET(new Request("https://grazinghub.com.br/api/vendas/bi/exportar"));
    expect(resposta.status).toBe(403); expect(sim.exportar).not.toHaveBeenCalled();
  });
  it("não concede contatos ou custos por acesso ao BI e exporta a seleção validada", async () => {
    sim.pode.mockImplementation(async (recurso: string) => ["vendas.bi", "vendas.bi.exportar"].includes(recurso));
    const resposta = await GET(new Request("https://grazinghub.com.br/api/vendas/bi/exportar?de=2026-01-01&ate=2026-09-30&aba=produtos&pagina=2&custos=true&contatos=true"));
    expect(resposta.status).toBe(200);
    expect(sim.exportar).toHaveBeenCalledWith({ de: "2026-01-01", ate: "2026-09-30", aba: "produtos", pagina: 2 }, { contatos: false, custos: false, pedidos: false, exportar: true });
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    expect(resposta.headers.get("content-disposition")).toContain("bi-de-vendas.csv");
    expect(await resposta.text()).toContain("Indicador;Valor");
  });
  it("devolve a restrição da aba protegida como falta de permissão", async () => {
    sim.pode.mockResolvedValue(true);
    sim.exportar.mockRejectedValue(new ErroBi("Seu acesso não permite consultar custos e margens.", 403));
    const resposta = await GET(new Request("https://grazinghub.com.br/api/vendas/bi/exportar?aba=rentabilidade"));
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ erro: "Seu acesso não permite consultar custos e margens." });
  });
});

it("URL aceita somente filtros públicos, rejeita arrays e converte booleanos explicitamente", () => {
  expect(entradaBiDaUrl({ de: ["2026-01-01", "2025-01-01"], contatos: "true", custos: "true", somenteConfirmados: "false", somenteSemRecompra: "1", diasSemRecompra: "90" })).toEqual({ somenteConfirmados: false, somenteSemRecompra: true, diasSemRecompra: 90 });
});

it("URL não converte notação numérica inválida antes de validar os filtros", async () => {
  for (const valor of ["1e2", "60.0", "0000000"]) {
    expect(() => normalizarFiltrosBi(entradaBiDaUrl({ diasSemRecompra: valor }))).toThrow("Há um filtro numérico inválido.");
  }
  expect(normalizarFiltrosBi(entradaBiDaUrl({ diasSemRecompra: "90", pagina: "2" }))).toMatchObject({ diasSemRecompra: 90, pagina: 2 });
  sim.pode.mockResolvedValue(true);
  const resposta = await GET(new Request("https://grazinghub.com.br/api/vendas/bi/exportar?diasSemRecompra=1e2"));
  expect(resposta.status).toBe(400);
  expect(sim.exportar).not.toHaveBeenCalled();
});
