// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyInput } from "@/components/ui/currency-input";

afterEach(cleanup);

it("digita centavos sem vírgula, formata milhares e envia valor decimal ao formulário", async () => {
  const usuario = userEvent.setup();
  const { container } = render(<form><CurrencyInput aria-label="Valor" name="valor" required /></form>);
  const campo = screen.getByRole("textbox", { name: "Valor" }) as HTMLInputElement;
  expect(within(campo.parentElement!).getByText("R$")).toBeTruthy();
  await usuario.type(campo, "123456");
  expect(campo.value).toBe("1.234,56");
  expect(campo.inputMode).toBe("numeric");
  expect(new FormData(container.querySelector("form")!).get("valor")).toBe("1234.56");
  await usuario.type(campo, "{Backspace}");
  expect(campo.value).toBe("123,45");
  await usuario.clear(campo);
  expect(campo.validity.valueMissing).toBe(true);
  await usuario.type(campo, "0");
  expect(campo.value).toBe("0,00");
  expect(campo.validity.valid).toBe(true);
  await usuario.type(campo, "{Backspace}");
  expect(campo.value).toBe("");
});

it("aceita colagem formatada, ignora letras e permite substituir o valor inteiro", async () => {
  const usuario = userEvent.setup();
  render(<CurrencyInput aria-label="Valor" />);
  const campo = screen.getByRole("textbox") as HTMLInputElement;
  await usuario.click(campo);
  await usuario.paste("R$ 1.234,56");
  expect(campo.value).toBe("1.234,56");
  await usuario.type(campo, "abc.,-");
  expect(campo.value).toBe("1.234,56");
  await usuario.paste("texto123");
  expect(campo.value).toBe("1.234,56");
  await usuario.keyboard("{Control>}a{/Control}2590");
  expect(campo.value).toBe("25,90");
});

it("mantém valores preenchidos e atualiza cálculos controlados sem separador de milhares", async () => {
  function Formulario() {
    const [valor, definirValor] = useState("1200.50");
    return <><CurrencyInput aria-label="Valor" value={valor} onValueChange={definirValor} /><output>{valor}</output><button onClick={() => definirValor("42.90")}>Usar sugestão</button></>;
  }
  const usuario = userEvent.setup();
  render(<Formulario />);
  const campo = screen.getByRole("textbox") as HTMLInputElement;
  expect(campo.value).toBe("1.200,50");
  await usuario.clear(campo);
  await usuario.type(campo, "123456");
  expect(screen.getByRole("status").textContent).toBe("1234.56");
  await usuario.click(screen.getByRole("button"));
  expect(campo.value).toBe("42,90");
});

it("preserva saldo negativo existente e troca o sinal sem digitar caracteres", async () => {
  const usuario = userEvent.setup();
  const { container } = render(<form><CurrencyInput aria-label="Saldo" name="saldoInicial" defaultValue={-1200.5} permitirNegativo /></form>);
  const campo = screen.getByRole("textbox") as HTMLInputElement;
  expect(campo.value).toBe("1.200,50");
  const formulario = container.querySelector("form")!;
  expect(new FormData(formulario).get("saldoInicial")).toBe("-1200.50");
  await usuario.clear(campo);
  await usuario.type(campo, "2590");
  expect(new FormData(formulario).get("saldoInicial")).toBe("-25.90");
  await usuario.click(screen.getByRole("combobox", { name: "Sinal do saldo" }));
  await usuario.click(await screen.findByRole("option", { name: "Positivo" }));
  expect(new FormData(formulario).get("saldoInicial")).toBe("25.90");
});

it("digita ou cola ,5 como cinquenta centavos e mantém envio exato, precisão e sinal", async () => {
 const u=userEvent.setup(); const {container}=render(<form><CurrencyInput aria-label="Valor" name="valor" permitirNegativo defaultValue={-10}/></form>);
 const campo=screen.getByRole("textbox") as HTMLInputElement, form=container.querySelector("form")!;
 await u.clear(campo); await u.type(campo,",5"); expect(campo.value).toBe("0,5"); expect(new FormData(form).get("valor")).toBe("-0.50");
 await u.type(campo,"67abc"); expect(campo.value).toBe("0,56"); expect(new FormData(form).get("valor")).toBe("-0.56");
 await u.tab(); expect(campo.value).toBe("0,56");
 await u.clear(campo); await u.paste(",5"); expect(new FormData(form).get("valor")).toBe("-0.50");
 await u.clear(campo); await u.paste(",555"); expect(campo.value).toBe(""); expect(new FormData(form).get("valor")).toBe("");
 await u.type(campo,"50"); expect(campo.value).toBe("0,50");
});

it("o atalho respeita campos de somente leitura e o tamanho máximo", async () => {
 const u=userEvent.setup(), alterar=vi.fn();const {rerender}=render(<CurrencyInput aria-label="Valor" value="10.00" readOnly onValueChange={alterar}/>);
 const campo=screen.getByRole("textbox") as HTMLInputElement;await u.click(campo);await u.keyboard("{Control>}a{/Control},5");await u.paste(",5");
 expect(campo.value).toBe("10,00");expect(alterar).not.toHaveBeenCalled();
 rerender(<CurrencyInput aria-label="Valor" maxLength={1} onValueChange={alterar}/>);await u.clear(campo);alterar.mockClear();await u.type(campo,",5");
 expect(campo.value).not.toBe("0,5");expect(alterar).not.toHaveBeenCalledWith("0.50");
});

it("aceita ,5 sobre o zero inicial da máscara sem precisar apagar 0,00", async () => {
 const u=userEvent.setup();const {container}=render(<form><CurrencyInput aria-label="Valor" name="valor" defaultValue="0.00"/></form>);
 const campo=screen.getByRole("textbox") as HTMLInputElement;await u.type(campo,",5");expect(campo.value).toBe("0,5");
 expect(new FormData(container.querySelector("form")!).get("valor")).toBe("0.50");
});
