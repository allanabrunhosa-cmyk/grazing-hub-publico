// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const simulados = vi.hoisted(() => ({ consultar: vi.fn(), excluir: vi.fn(), fechar: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ obterResumoExclusaoLancamentoAction: simulados.consultar, excluirLancamentoAction: simulados.excluir }));
import { ExcluirLancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog";
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  simulados.consultar.mockResolvedValue({ descricao: "Aluguel (2/5)", grupo: "RECORRENCIA", pendentes: 4, realizados: 1 });
  simulados.excluir.mockResolvedValue({ ok: true, quantidade: 4 });
});
it.each([["Apenas esta movimentação", "APENAS_ESTA"], ["Todas as pendentes deste grupo (4)", "GRUPO_PENDENTE"]])("exige escolha antes de excluir: %s", async (opcao, escopo) => {
  render(<ExcluirLancamentoDialog lancamentoId="parcela" aoFechar={simulados.fechar} />);
  const radio = await screen.findByRole("radio", { name: new RegExp(opcao.replace(/[()]/g, "\\$&")) });
  const confirmar = screen.getByRole("button", { name: "Confirmar exclusão" });
  expect((confirmar as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByRole("radio").every((elemento) => !(elemento as HTMLInputElement).checked)).toBe(true);
  expect(simulados.excluir).not.toHaveBeenCalled();
  fireEvent.click(radio);
  fireEvent.click(confirmar);
  await waitFor(() => expect(simulados.excluir).toHaveBeenCalledWith("parcela", escopo));
  expect(simulados.fechar).toHaveBeenCalledOnce();
});
it("voltar não exclui nada", async () => {
  render(<ExcluirLancamentoDialog lancamentoId="parcela" aoFechar={simulados.fechar} />);
  await screen.findAllByRole("radio");
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(simulados.excluir).not.toHaveBeenCalled();
});
it("exibe falha de consulta e bloqueia exclusão", async () => {
  simulados.consultar.mockResolvedValue({ erro: "Falha de consulta" });
  render(<ExcluirLancamentoDialog lancamentoId="parcela" aoFechar={simulados.fechar} />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha de consulta");
  expect((screen.getByRole("button", { name: "Confirmar exclusão" }) as HTMLButtonElement).disabled).toBe(true);
});

it("lista itens e data original e exige motivo para cancelar a compra inteira", async () => {
 const compra = { chaveOrigem: "NOTA:nota", descricao: "NF-e fictícia", token: "a".repeat(64), quantidadeLancamentos: 4, valor: "445.00", cancelada: false,
 itens: [{ id: "insumo", descricao: "Produto fictício", quantidade: "2.5", unidade: "KG", local: "Câmara de teste", data: "2026-09-11T15:00:00Z", movimentoId: "entrada" }] };
 simulados.consultar.mockResolvedValue({ descricao: compra.descricao, grupo: null, pendentes: 4, realizados: 0, compra });
 render(<ExcluirLancamentoDialog lancamentoId="parcela" aoFechar={simulados.fechar} />);
 await screen.findByText("Produto fictício"); expect(screen.getByText(/11\/09\/2026/)).toBeTruthy(); expect(screen.queryByRole("radio")).toBeNull();
 const confirmar = screen.getByRole("button", { name: "Confirmar cancelamento integral" }); expect((confirmar as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText(/Motivo do cancelamento/), { target: { value: "Cancelamento fictício de compra" } }); fireEvent.click(confirmar);
 await waitFor(() => expect(simulados.excluir).toHaveBeenCalledWith("parcela", "COMPRA_INTEGRAL", { token: compra.token, motivo: "Cancelamento fictício de compra" }));
});
