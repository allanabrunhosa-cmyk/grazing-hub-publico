import { beforeEach, expect, it, vi } from "vitest";
import GruposFiscaisPage from "@/app/(protegido)/financeiro/fiscal/grupos/page";
import VinculosFiscaisPage from "@/app/(protegido)/financeiro/fiscal/vinculos/page";

const sim = vi.hoisted(() => ({ guarda: vi.fn(), acesso: vi.fn(), grupos: vi.fn(), produtos: vi.fn(), regime: vi.fn(), painel: vi.fn() }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regime-empresa", () => ({ obterRegimeFiscalEmpresaBrasilNfe: sim.regime }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.acesso }));
vi.mock("@/lib/tributacao/servico", () => ({ consultarPainelFiscal: sim.painel }));
vi.mock("@/app/(protegido)/financeiro/fiscal/cadastros-fiscais", () => ({ CadastrosFiscais: () => null, RegrasFiscaisVisiveis: () => null }));
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
  sim.painel.mockResolvedValue({ produtos: [], versoes: [], administrador: false });
});

it.each([["grupos", GruposFiscaisPage], ["vínculos", VinculosFiscaisPage]] as const)("página %s exige permissão histórica antes de ler os cadastros", async (_, pagina) => {
  await expect(pagina({})).rejects.toThrow("SEM_ACESSO");
  expect(sim.guarda).toHaveBeenCalledWith("vendas.fiscal");
  expect(sim.grupos).not.toHaveBeenCalled();
  expect(sim.produtos).not.toHaveBeenCalled();
  expect(sim.acesso).not.toHaveBeenCalled();
  expect(sim.regime).not.toHaveBeenCalled();
});

it("consulta conserva a guarda da fonte versionada e não concede administração", async () => {
  sim.guarda.mockResolvedValueOnce({ userId: "usuario-ficticio" });
  const elemento = await VinculosFiscaisPage({});
  expect(elemento.props.painel.administrador).toBe(false); expect(sim.painel).toHaveBeenCalledWith({ userId: "usuario-ficticio" });
});
it("grupos preserva a concessão histórica para editar somente sua identificação", async () => {
  sim.guarda.mockResolvedValueOnce({ userId: "usuario-ficticio" }); sim.acesso.mockResolvedValueOnce(true);
  const elemento = await GruposFiscaisPage(); const filhos = elemento.props.children;
  expect(filhos[0].props.editar).toBe(true); expect(filhos[0].props.crt).toBe(1);
  expect(filhos[1].props.painel.administrador).toBe(false);
});
