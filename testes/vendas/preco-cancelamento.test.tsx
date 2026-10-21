// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrecoProduto } from "@/app/(protegido)/vendas/produtos/preco-produto";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
const sim = vi.hoisted(() => ({ salvar: vi.fn(), atualizar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.atualizar }) }));
vi.mock("@/app/(protegido)/vendas/actions", () => ({ alterarPrecoProdutoVendaAction: sim.salvar }));
const produto = { id: "p", versao: 1, nome: "Produto sintético", preco: "100", grupos: [] } as unknown as ProdutoEntrada;
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("acompanha revisão de outra tela sem sobrescrever edição pendente", async () => {
  sim.salvar.mockResolvedValue({ ok: true, versao: 4 });
  const tela = render(<PrecoProduto produto={produto} editar custo={null} />);
  tela.rerender(<PrecoProduto produto={{ ...produto, versao: 2 }} editar custo={null} />);
  fireEvent.change(screen.getByLabelText("Preço de Produto sintético"), { target: { value: "12000" } });
  tela.rerender(<PrecoProduto produto={{ ...produto, versao: 3 }} editar custo={null} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar preço de Produto sintético" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith("p", 2, "120.00"));
});
it("cancela preço com Escape sem executar ação ou expandir", async () => {
  const expandir = vi.fn(); render(<div onClick={expandir}><PrecoProduto produto={produto} editar custo={null} /></div>);
  const usuario = userEvent.setup();
  fireEvent.change(screen.getByLabelText("Preço de Produto sintético"), { target: { value: "12000" } });
  screen.getByLabelText("Preço de Produto sintético").focus();
  await usuario.keyboard("{Escape}");
  expect(screen.getByLabelText("Preço de Produto sintético")).toHaveProperty("value", "100,00");
  expect(sim.salvar).not.toHaveBeenCalled(); expect(expandir).not.toHaveBeenCalled();
});
it("mantém erro/preço em falha e confirma com Enter", async () => {
  sim.salvar.mockResolvedValueOnce({ erro: "Conflito controlado" }).mockResolvedValueOnce({ ok: true, versao: 2 });
  render(<PrecoProduto produto={produto} editar custo={null} />);
  const usuario = userEvent.setup(); const campo = screen.getByLabelText("Preço de Produto sintético");
  fireEvent.change(campo, { target: { value: "12000" } });
  await usuario.click(screen.getByRole("button", { name: "Confirmar preço de Produto sintético" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Conflito controlado");
  await usuario.click(campo); await usuario.keyboard("{Enter}");
  await waitFor(() => expect(sim.atualizar).toHaveBeenCalledOnce());
  expect(screen.queryByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancelar preço de Produto sintético" })).toBeNull();
  expect(sim.salvar).toHaveBeenCalledTimes(2);
});
it("mostra somente o check durante a edição e cancela ao sair para outro campo", async () => {
  render(<><PrecoProduto produto={produto} editar custo={null} /><button>Fora do preço</button></>);
  expect(screen.queryByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeNull();
  const usuario = userEvent.setup(), campo = screen.getByLabelText("Preço de Produto sintético");
  await usuario.click(campo);
  fireEvent.change(campo, { target: { value: "12000" } });
  expect(screen.getByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cancelar preço de Produto sintético" })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Fora do preço" }));
  expect(campo).toHaveProperty("value", "100,00");
  expect(screen.queryByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeNull();
  expect(sim.salvar).not.toHaveBeenCalled();
});
it("mover o foco do preço para o check permite confirmar sem cancelar", async () => {
  sim.salvar.mockResolvedValue({ ok: true, versao: 2 });
  render(<PrecoProduto produto={produto} editar custo={null} />);
  const usuario = userEvent.setup(), campo = screen.getByLabelText("Preço de Produto sintético");
  await usuario.click(campo); fireEvent.change(campo, { target: { value: "13900" } });
  await usuario.click(screen.getByRole("button", { name: "Confirmar preço de Produto sintético" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith("p", 1, "139.00"));
  expect(campo).toHaveProperty("value", "139,00");
});

it("redigitar o mesmo preço ou voltar ao valor salvo retira o check sem gravação", () => {
  render(<PrecoProduto produto={produto} editar custo={null} />);
  const campo = screen.getByLabelText("Preço de Produto sintético");
  fireEvent.change(campo, { target: { value: "10000" } });
  expect(screen.queryByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeNull();
  fireEvent.change(campo, { target: { value: "12000" } });
  expect(screen.getByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeTruthy();
  fireEvent.change(campo, { target: { value: "10000" } });
  expect(screen.queryByRole("button", { name: "Confirmar preço de Produto sintético" })).toBeNull();
  expect(sim.salvar).not.toHaveBeenCalled();
});
