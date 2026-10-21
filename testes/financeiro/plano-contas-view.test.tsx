// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { cleanup, render as renderBase, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
const render = (elemento: React.ReactNode) => renderBase(elemento, { wrapper: ({ children }) => <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{children}</ProvedorAcesso> });
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ criar: vi.fn().mockResolvedValue({ ok: true }), atualizar: vi.fn(), alternar: vi.fn().mockResolvedValue({ ok: true }), excluir: vi.fn().mockResolvedValue({ ok: true, transferidos: 0 }) }));
vi.mock("@/app/(protegido)/financeiro/plano-de-contas/actions", () => ({ criarCategoriaFinanceiraAction: sim.criar, atualizarCategoriaFinanceiraAction: sim.atualizar, alternarAtivoCategoriaFinanceiraAction: sim.alternar, excluirCategoriaFinanceiraAction: sim.excluir }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { GrupoCard } from "@/app/(protegido)/financeiro/plano-de-contas/grupo-card";
import { PlanoContasView } from "@/app/(protegido)/financeiro/plano-de-contas/plano-contas-view";
const base = { grupo: "DESPESAS_OPERACIONAIS" as const, ativo: true, excluidoEm: null, centroCustoId: null, centroCustoNome: null, quantidadeLancamentos: 0, quantidadeItensNota: 0, quantidadeItensFatura: 0, quantidadeRegrasCartao: 0, quantidadeSubcategorias: 0 };
const categorias = [{ ...base, id: "ga", paiId: null, nome: "GA" }, { ...base, id: "m", paiId: "ga", nome: "Marketing" }, { ...base, id: "s", paiId: "m", nome: "Serviços terceiros" }];
afterEach(cleanup);
it("distingue grupos de entrada e saída também nos botões", () => {
  const { rerender } = render(<GrupoCard grupo="RECEITA_BRUTA" categorias={[]} centrosCusto={[]} />);
  const entrada = screen.getByText("Receita Bruta").closest("[data-natureza-financeira]");
  expect(entrada?.getAttribute("data-natureza-financeira")).toBe("entrada");
  expect(entrada?.className).toContain("border-l-success");
  expect(screen.getByRole("button", { name: "Adicionar categoria em Receita Bruta" }).className).toContain("text-success");

  rerender(<GrupoCard grupo="DESPESAS_OPERACIONAIS" categorias={categorias} centrosCusto={[]} />);
  const saida = screen.getByText("Despesas Operacionais").closest("[data-natureza-financeira]");
  expect(saida?.getAttribute("data-natureza-financeira")).toBe("saida");
  expect(saida?.className).toContain("border-l-destructive");
  expect(screen.getByRole("button", { name: "Adicionar categoria em Despesas Operacionais" }).className).toContain("text-destructive");
});
it("expande os três níveis e não oferece criação de quarto nível", () => {
  render(<GrupoCard grupo="DESPESAS_OPERACIONAIS" categorias={categorias} centrosCusto={[]} />);
  expect(screen.queryByRole("button", { name: "Expandir GA › Marketing" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Expandir GA" }));
  fireEvent.click(screen.getByRole("button", { name: "Expandir GA › Marketing" }));
  expect(screen.getByRole("button", { name: "Editar GA › Marketing › Serviços terceiros" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Adicionar subcategoria em GA › Marketing › Serviços terceiros" })).toBeNull();
});
it("cria dentro do pai escolhido e informa seu contexto", async () => {
  render(<GrupoCard grupo="DESPESAS_OPERACIONAIS" categorias={categorias} centrosCusto={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Expandir GA" }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar subcategoria em GA › Marketing" }));
  expect(screen.getByText("Dentro de Marketing · Despesas Operacionais")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Campanhas" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.criar).toHaveBeenCalled());
  const form = sim.criar.mock.calls[0][1] as FormData;
  expect(form.get("paiId")).toBe("m"); expect(form.get("grupo")).toBe("DESPESAS_OPERACIONAIS");
});

it("permite mover uma subcategoria para outro grupo e escolher a nova categoria superior", async () => {
  sim.atualizar.mockResolvedValue({ ok: true });
  const usuario = userEvent.setup();
  const insumos = { ...base, id: "insumos", paiId: null, nome: "Insumos", grupo: "CMV" as const };
  render(<GrupoCard grupo="DESPESAS_OPERACIONAIS" categorias={categorias} todasCategorias={[...categorias, insumos]} centrosCusto={[]} />);
  await usuario.click(screen.getByRole("button", { name: "Expandir GA" }));
  await usuario.click(screen.getByRole("button", { name: "Editar GA › Marketing" }));
  expect(screen.getByRole("combobox", { name: "Grupo da DRE" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Categoria superior" })).toBeTruthy();

  await usuario.click(screen.getByRole("combobox", { name: "Grupo da DRE" }));
  await usuario.click(screen.getByRole("option", { name: "CMV — Custo da Mercadoria" }));
  expect(screen.getByRole("combobox", { name: "Categoria superior" }).textContent).toContain("Sem categoria superior");
  await usuario.click(screen.getByRole("combobox", { name: "Categoria superior" }));
  await usuario.click(screen.getByRole("option", { name: "Insumos" }));
  await usuario.click(screen.getByRole("button", { name: "Salvar" }));

  await waitFor(() => expect(sim.atualizar).toHaveBeenCalledWith("m", expect.objectContaining({ grupo: "CMV", paiId: "insumos" })));
});

it("filtra categorias ativas, inativas e excluídas", () => {
  const estados = [
    { ...base, id: "ativa", paiId: null, nome: "Categoria ativa" },
    { ...base, id: "inativa", paiId: null, nome: "Categoria inativa", ativo: false },
    { ...base, id: "excluida", paiId: null, nome: "Categoria excluída", ativo: false, excluidoEm: "2026-09-14T12:00:00.000Z" },
  ];
  render(<PlanoContasView categorias={estados} centrosCusto={[]} />);
  expect(screen.getByText("Categoria ativa")).toBeTruthy();
  expect(screen.queryByText("Categoria inativa")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Inativas (1)" }));
  expect(screen.getByText("Categoria inativa")).toBeTruthy();
  expect(screen.queryByText("Categoria ativa")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Excluídas (1)" }));
  expect(screen.getByText("Categoria excluída")).toBeTruthy();
  expect(screen.getByText("Excluída")).toBeTruthy();
});

it("oferece inativação ou transferência quando a categoria possui vínculos", () => {
  const comVinculos = { ...base, id: "ocupacao", paiId: null, nome: "Ocupação", quantidadeLancamentos: 2 };
  const destino = { ...base, id: "administrativo", paiId: null, nome: "Administrativo" };
  render(<GrupoCard grupo="DESPESAS_OPERACIONAIS" categorias={[comVinculos, destino]} centrosCusto={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Excluir Ocupação" }));
  expect(screen.getByText(/Esta categoria possui 2 movimentações financeiras.*0 itens de fatura e 0 regras de cartão/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Apenas inativar" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Excluir categoria" }) as HTMLButtonElement).disabled).toBe(true);
});

