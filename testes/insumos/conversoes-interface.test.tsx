// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConversoesCampos } from "@/app/(protegido)/insumos/conversoes-campos";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { contagemTeste } from "../inventario/dados";

const simulados = vi.hoisted(() => ({ salvar: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/app/(protegido)/inventario/contagem/actions", () => ({ salvarItemContagemAction: simulados.salvar, finalizarContagemAction: vi.fn(), excluirContagemAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

it("edita e remove fatores no payload do cadastro", () => {
  const { container } = render(<form><ConversoesCampos unidadePrincipal="KG" conversoes={[{ unidade: "FD", fator: 10 }]} desabilitado={false} /></form>);
  fireEvent.change(screen.getByLabelText("Fator da conversão 1"), { target: { value: "12,5" } });
  expect(JSON.parse(new FormData(container.querySelector("form")!).get("conversoes") as string)).toEqual([{ unidade: "FD", fator: "12,5" }]);
  fireEvent.click(screen.getByRole("button", { name: "Remover conversão 1" }));
  expect(new FormData(container.querySelector("form")!).get("conversoes")).toBe("[]");
});

it("mostra equivalência sem converter novamente o valor salvo da contagem", async () => {
  render(<ContagemForm contagem={{ ...contagemTeste, itens: [{ ...contagemTeste.itens[1], unidade: "KG", quantidadeContada: null, conversoes: [{ unidade: "FD", fator: 10 }] }] }} />);
  expect(screen.getByText("1 fd = 10 kg")).toBeTruthy();
  const campo = screen.getByLabelText("Quantidade contada de Açúcar");
  fireEvent.change(campo, { target: { value: "20" } });
  expect(screen.getByText("Equivale a 2 fd")).toBeTruthy();
  fireEvent.blur(campo);
  expect(simulados.salvar).not.toHaveBeenCalled();
  fireEvent.keyDown(campo, { key: "Enter" });
  await waitFor(() => expect(simulados.salvar).toHaveBeenCalledWith("acucar", 20));
});
