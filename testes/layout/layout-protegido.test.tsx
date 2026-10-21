// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { IdentidadeInterface } from "@/lib/hosts";
import ProtectedLayout from "@/app/(protegido)/layout";

const estado = vi.hoisted(() => ({
  identidade: "hub" as IdentidadeInterface,
  sessao: { admin: true, permissoes: {}, excecoes: {} } as { admin: boolean; permissoes: Record<string, never>; excecoes: Record<string, never> } | null,
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => estado.sessao) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((destino: string) => { throw new Error("REDIRECT:" + destino); }) }));
vi.mock("@/lib/contexto-interface", () => ({ identidadeDaInterface: async () => estado.identidade }));
vi.mock("@/lib/design-system/servico", () => ({ obterTemaPublicado: async () => ({ revisao: 7 }) }));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => <aside aria-label="Navegação do HUB" /> }));
vi.mock("@/components/layout/menu-etiquetas", () => ({ MenuEtiquetas: () => <aside aria-label="Navegação de Validades" /> }));
vi.mock("@/components/layout/header", () => ({ Header: ({ identidade }: { identidade: string }) => <header data-testid={"cabecalho-" + identidade}>Cabeçalho</header> }));
vi.mock("@/components/design-system/atualizacao-tema", () => ({ AtualizacaoTema: ({ revisao }: { revisao: number }) => <span data-testid="tema-revisao">{revisao}</span> }));

afterEach(() => {
  cleanup();
  estado.identidade = "hub";
  estado.sessao = { admin: true, permissoes: {}, excecoes: {} };
  vi.clearAllMocks();
});

it.each(["hub", "etiquetas", "pedidos"] as const)("layout %s conserva sessão, conteúdo e tema com a navegação correta", async identidade => {
  estado.identidade = identidade;
  render(await ProtectedLayout({ children: <p>Conteúdo fictício</p> }));
  const navegacao = screen.queryByRole("complementary");
  if (identidade === "pedidos") expect(navegacao).toBeNull();
  else expect(navegacao?.getAttribute("aria-label")).toBe(identidade === "hub" ? "Navegação do HUB" : "Navegação de Validades");
  expect(screen.getByTestId("cabecalho-" + identidade)).toBeDefined();
  expect(screen.getByRole("main").id).toBe("conteudo-principal");
  expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1");
  expect(screen.getByRole("link", { name: "Ir para o conteúdo" }).getAttribute("href")).toBe("#conteudo-principal");
  expect(screen.getByText("Conteúdo fictício")).toBeDefined();
  expect(screen.getByTestId("tema-revisao").textContent).toBe("7");
});

it("layout dedicado conserva redirecionamento para login sem sessão", async () => {
  estado.identidade = "pedidos";
  estado.sessao = null;
  await expect(ProtectedLayout({ children: <p>Conteúdo fictício</p> })).rejects.toThrow("REDIRECT:/login");
});
