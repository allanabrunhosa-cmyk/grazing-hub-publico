import { beforeEach, expect, it, vi } from "vitest";
import GruposFiscaisPage from "@/app/(protegido)/financeiro/fiscal/grupos/page";
import VinculosFiscaisPage from "@/app/(protegido)/financeiro/fiscal/vinculos/page";

const sim = vi.hoisted(() => ({ guarda: vi.fn(), acesso: vi.fn(), grupos: vi.fn(), produtos: vi.fn(), regime: vi.fn() }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regime-empresa", () => ({ obterRegimeFiscalEmpresaBrasilNfe: sim.regime }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.acesso }));
vi.mock("@/lib/prisma", () => ({ prisma: { grupoFiscalVenda: { findMany: sim.grupos }, produtoVenda: { findMany: sim.produtos } } }));
vi.mock("@/app/(protegido)/vendas/fiscal/grupos-fiscais-client", () => ({ GruposFiscais: () => null }));
vi.mock("@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client", () => ({ VinculosFiscais: () => null }));
beforeEach(() => {
  vi.resetAllMocks();
  sim.guarda.mockRejectedValue(new Error("SEM_ACESSO"));
  sim.acesso.mockResolvedValue(false);
  sim.grupos.mockResolvedValue([]);
  sim.produtos.mockResolvedValue([]);
  sim.regime.mockResolvedValue({ crt: 1 });
});

it.each([["grupos", GruposFiscaisPage], ["vínculos", VinculosFiscaisPage]] as const)("página %s exige permissão histórica antes de ler os cadastros", async (_, pagina) => {
  await expect(pagina()).rejects.toThrow("SEM_ACESSO");
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal");
  expect(sim.grupos).not.toHaveBeenCalled();
  expect(sim.produtos).not.toHaveBeenCalled();
  expect(sim.acesso).not.toHaveBeenCalled();
  expect(sim.regime).not.toHaveBeenCalled();
});

it.each([["grupos", GruposFiscaisPage], ["vínculos", VinculosFiscaisPage]] as const)("página %s não transforma consulta em edição", async (_, pagina) => {
  sim.guarda.mockResolvedValueOnce({ userId: "usuario-ficticio" });
  const elemento = await pagina();
  expect(sim.acesso).toHaveBeenCalledWith("vendas.fiscal", "editar");
  expect(elemento.props.editar).toBe(false);
  expect(sim.grupos).toHaveBeenCalledOnce();
  if (pagina === GruposFiscaisPage) { expect(sim.regime).toHaveBeenCalledOnce(); expect(elemento.props.crt).toBe(1); }
});

it.each([["grupos", GruposFiscaisPage], ["vínculos", VinculosFiscaisPage]] as const)("página %s conserva a concessão de edição histórica", async (_, pagina) => {
  sim.guarda.mockResolvedValueOnce({ userId: "usuario-ficticio" });
  sim.acesso.mockResolvedValueOnce(true);
  expect((await pagina()).props.editar).toBe(true);
});
