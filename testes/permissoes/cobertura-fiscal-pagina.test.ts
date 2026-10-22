import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), consultar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("@/lib/tributacao/servico", () => ({ consultarPainelFiscal: sim.consultar }));
vi.mock("@/app/(protegido)/vendas/fiscal/cobertura/painel-fiscal", () => ({ PainelEstruturaFiscal: () => null }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import CoberturaFiscalPage from "@/app/(protegido)/financeiro/fiscal/cobertura/page";
beforeEach(() => { vi.resetAllMocks(); sim.guarda.mockResolvedValue({ userId: "usuario-sintetico" }); sim.consultar.mockResolvedValue({ produtos: [], versoes: [] }); });
it("nega acesso antes de consultar regras ou classificações", async () => {
  sim.guarda.mockRejectedValue(new Error("SEM_ACESSO"));
  await expect(CoberturaFiscalPage()).rejects.toThrow("SEM_ACESSO");
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal");
  expect(sim.consultar).not.toHaveBeenCalled();
});
it("redireciona a cobertura antiga para a ficha canônica sem ler ou alterar dados", async () => {
  await expect(CoberturaFiscalPage()).rejects.toThrow("REDIRECT:/financeiro/fiscal/vinculos");
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal");
  expect(sim.consultar).not.toHaveBeenCalled();
});
