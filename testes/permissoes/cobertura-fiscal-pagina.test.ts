import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), consultar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("@/lib/tributacao/servico", () => ({ consultarPainelFiscal: sim.consultar }));
vi.mock("@/app/(protegido)/vendas/fiscal/cobertura/painel-fiscal", () => ({ PainelEstruturaFiscal: () => null }));
import CoberturaFiscalPage from "@/app/(protegido)/financeiro/fiscal/cobertura/page";
beforeEach(() => { vi.resetAllMocks(); sim.guarda.mockResolvedValue({ userId: "usuario-sintetico" }); sim.consultar.mockResolvedValue({ produtos: [], versoes: [] }); });
it("nega acesso antes de consultar regras ou classificações", async () => {
  sim.guarda.mockRejectedValue(new Error("SEM_ACESSO"));
  await expect(CoberturaFiscalPage({})).rejects.toThrow("SEM_ACESSO");
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal");
  expect(sim.consultar).not.toHaveBeenCalled();
});
it.each([["regras", "regras"], ["campo-desconhecido", "cobertura"], [undefined, "cobertura"]])("resolve aba %s sem outra leitura ou escrita", async (aba, esperado) => {
  const pagina = await CoberturaFiscalPage({ searchParams: Promise.resolve({ aba }) });
  expect(pagina.props.abaInicial).toBe(esperado);
  expect(sim.consultar).toHaveBeenCalledOnce();
  expect(sim.consultar).toHaveBeenCalledWith({ userId: "usuario-sintetico" });
});
