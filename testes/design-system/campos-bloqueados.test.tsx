// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemonstracaoPadrao } from "@/components/design-system/demonstracao-padrao";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";

afterEach(cleanup);
it("Central demonstra somente leitura copiável e focalizável, sem permitir edição", async () => {
  render(<DemonstracaoPadrao componente="campos" estado="somente-leitura" aplicado={false} />);
  const usuario = userEvent.setup(), campo = screen.getByLabelText("Nome do exemplo") as HTMLInputElement;
  expect(campo.readOnly).toBe(true); expect(campo.disabled).toBe(false);
  await usuario.tab(); expect(document.activeElement).toBe(campo);
  campo.select(); expect(campo.selectionEnd).toBe(campo.value.length);
  await usuario.type(campo, "Alteração"); expect(campo.value).toBe("Caixa de degustação");
  expect(screen.getByLabelText("Observação do exemplo")).toHaveProperty("readOnly", true);
});
it("bloqueios preservam valores, máscara e envio de somente leitura, excluindo desabilitados", async () => {
  const alterar = vi.fn();
  const { container } = render(<form><Input name="fixo" aria-label="Fixo" readOnly defaultValue="Confirmado" onChange={alterar} /><Textarea name="observacao" readOnly defaultValue="Texto confirmado" /><CurrencyInput name="total" aria-label="Total" value="149.90" readOnly onValueChange={alterar} /><Input name="indisponivel" aria-label="Indisponível" defaultValue="Reservado" disabled /><fieldset disabled><Input name="grupo" defaultValue="Valor do grupo" /></fieldset></form>);
  await userEvent.type(screen.getByLabelText("Total"), "500");
  expect(alterar).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Total")).toHaveProperty("value", "149,90");
  expect(Object.fromEntries(new FormData(container.querySelector("form")!))).toEqual({ fixo: "Confirmado", observacao: "Texto confirmado", total: "149.90" });
});
