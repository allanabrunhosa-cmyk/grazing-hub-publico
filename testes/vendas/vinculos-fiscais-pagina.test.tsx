vi.mock("@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client", () => ({ VinculosFiscais: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: { produtoVenda: { findMany: sim.consulta }, grupoFiscalVenda: { findMany: sim.consulta } } }));
import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), acesso: vi.fn(), consulta: vi.fn(), painel: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.acesso }));
vi.mock("@/lib/tributacao/servico", () => ({ consultarPainelFiscal: sim.painel }));
vi.mock("@/app/(protegido)/financeiro/fiscal/cadastros-fiscais", () => ({ CadastrosFiscais: () => null }));
import Pagina from "@/app/(protegido)/financeiro/fiscal/vinculos/page";
beforeEach(() => { vi.resetAllMocks(); sim.acesso.mockResolvedValue(false); sim.consulta.mockResolvedValue([]); sim.guarda.mockResolvedValue({ userId: "autor-sintetico" }); sim.painel.mockResolvedValue({ produtos: [], versoes: [], administrador: false }); });
it("autoriza fiscal antes de consultar a fonte canônica", async () => {
  sim.guarda.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(Pagina({})).rejects.toThrow("Sem acesso"); expect(sim.painel).not.toHaveBeenCalled();
});
it("passa exatamente o painel versionado autorizado, sem montar outro cadastro", async () => {
  const painel = { produtos: [{ id: "p-ficticio" }], versoes: [{ id: "v-ficticia" }], administrador: false }; sim.painel.mockResolvedValue(painel);
  const pagina = await Pagina({ searchParams: Promise.resolve({ produto: "p-ficticio" }) });
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal"); expect(sim.painel).toHaveBeenCalledWith({ userId: "autor-sintetico" }, { tabelas: false, evidenciasEntrada: false });
  expect(pagina.props.produtos).toEqual([]); expect(pagina.props.produtoInicial).toBe("p-ficticio");
});
