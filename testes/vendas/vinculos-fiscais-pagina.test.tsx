import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), pode: vi.fn(), produtos: vi.fn(), grupos: vi.fn(), analises: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.pode }));
vi.mock("@/lib/prisma", () => ({ prisma: { produtoVenda: { findMany: sim.produtos }, grupoFiscalVenda: { findMany: sim.grupos }, versaoEstruturaFiscal: { findMany: sim.analises } } }));
vi.mock("@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client", () => ({ VinculosFiscais: () => null }));
import Pagina from "@/app/(protegido)/financeiro/fiscal/vinculos/page";
beforeEach(() => { vi.resetAllMocks(); sim.produtos.mockResolvedValue([]); sim.grupos.mockResolvedValue([]); sim.analises.mockResolvedValue([]); });
it("autoriza fiscal antes de consultar qualquer cadastro", async () => {
  sim.guarda.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(Pagina()).rejects.toThrow("Sem acesso");
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal"); expect(sim.produtos).not.toHaveBeenCalled(); expect(sim.grupos).not.toHaveBeenCalled();
});
it("consulta somente a análise vinculada ativa e projeta autoria validada da versão", async () => {
  sim.produtos.mockResolvedValue([{ id: "p", fiscal: { ncmClassificacaoVersaoId: "v" }, categorias: [] }]);
  sim.analises.mockResolvedValue([{ id: "v", chave: "p", dados: { produtoId: "p", ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { confianca: "ALTA" } }, versao: 2, vigenciaInicio: new Date("2026-10-12T00:00:00Z"), criadoPorNome: "Administrador de teste", createdAt: new Date("2026-10-12T12:00:00Z") }]);
  const pagina = await Pagina();
  expect(sim.analises.mock.calls[0][0].where).toEqual(expect.objectContaining({ id: { in: ["v"] }, tipo: "CLASSIFICACAO", status: "ATIVO", vigenciaInicio: { lte: expect.any(Date) } }));
  expect(pagina.props.produtos[0].analiseFiscal.versao.autor).toBe("Administrador de teste");
  expect(pagina.props.produtos[0].analiseFiscal.ncmAplicabilidade).toBe("NAO_APLICAVEL");
});
it("não associa a um produto a análise pertencente a outro registro", async () => {
  sim.produtos.mockResolvedValue([{ id: "p", fiscal: { ncmClassificacaoVersaoId: "v" }, categorias: [] }]);
  sim.analises.mockResolvedValue([{ id: "v", chave: "outro", dados: { analiseNcm: { confianca: "ALTA" } } }]);
  const pagina = await Pagina(); expect(pagina.props.produtos[0].analiseFiscal).toBeUndefined();
});
it("consulta fiscal não exige dados comerciais e passa a permissão de edição", async () => {
  sim.pode.mockResolvedValue(false); const pagina = await Pagina();
  expect(pagina.props.editar).toBe(false); expect(sim.pode).toHaveBeenCalledWith("vendas.fiscal", "editar");
  const consulta = sim.produtos.mock.calls[0][0]; expect(consulta.select.fiscal).toBe(true); expect(consulta.select.classificacoes).toBe(true);
  expect(consulta.select.precos).toBeUndefined(); expect(consulta.select.componentes).toBeUndefined(); expect(consulta.where).toBeUndefined();
  expect(consulta.select.fotoUrl).toBe(true); expect(consulta.select.categorias.select.categoria.select).toEqual({ id: true, nome: true, ativo: true });
});
it("projeta categorias para a linha sem enviar vínculos completos", async () => {
  sim.produtos.mockResolvedValue([{ id: "p", fiscal: {}, categorias: [{ categoria: { id: "c", nome: "Tábuas", ativo: true } }] }]);
  const pagina = await Pagina(); expect(pagina.props.produtos[0].categorias).toEqual([{ id: "c", nome: "Tábuas", ativo: true }]);
});
