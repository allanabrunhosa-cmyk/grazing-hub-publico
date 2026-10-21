// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelecaoFormulario, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

afterEach(cleanup);

it("abrir a lista não escolhe a primeira opção nem sobrepõe o gatilho", async () => {
  const mudar = vi.fn();
  render(<Select value="" onValueChange={mudar}><SelectTrigger aria-label="Tipo"><SelectValue placeholder="Escolha o tipo" /></SelectTrigger><SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent></Select>);
  const campo = screen.getByRole("combobox", { name: "Tipo" });
  await userEvent.click(campo);
  const primeira = await screen.findByRole("option", { name: "Pessoa Física" });
  expect(primeira.getAttribute("aria-selected")).toBe("false");
  expect(mudar).not.toHaveBeenCalled();
  expect(campo.textContent).toContain("Escolha o tipo");
  const popup = primeira.closest('[data-slot="select-content"]')!;
  expect(popup.getAttribute("data-align-trigger")).toBe("false");
  expect(popup.getAttribute("data-side")).not.toBe("none");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(document.activeElement).toBe(campo);
});

it("preserva defaultValue, opção sem value, FormData e envio somente explícito", async () => {
  const enviar = vi.fn();
  const { container } = render(<form onSubmit={evento => { evento.preventDefault(); enviar(new FormData(evento.currentTarget).get("canal")); }}><label htmlFor="canal">Canal</label><SelecaoFormulario id="canal" name="canal" defaultValue="Site"><option>Site</option><option>Loja</option></SelecaoFormulario><button>Consultar</button></form>);
  const formulario = container.querySelector("form")!;
  expect(new FormData(formulario).get("canal")).toBe("Site");
  await userEvent.click(screen.getByRole("combobox", { name: "Canal" }));
  await userEvent.click(await screen.findByRole("option", { name: "Loja" }));
  expect(new FormData(formulario).get("canal")).toBe("Loja");
  expect(enviar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
  expect(enviar).toHaveBeenCalledExactlyOnceWith("Loja");
});

it("mantém valores numéricos como strings e respeita required", async () => {
  function Campo() {
    const [valor, definir] = useState("");
    return <form><SelecaoFormulario name="coluna" aria-label="Coluna" required value={valor} onValueChange={definir}><option value="">Escolha a coluna</option><option value={0}>Primeira coluna</option><option value={1}>Segunda coluna</option></SelecaoFormulario></form>;
  }
  const { container } = render(<Campo />);
  const formulario = container.querySelector("form")!;
  expect(formulario.checkValidity()).toBe(false);
  await userEvent.click(screen.getByRole("combobox", { name: "Coluna" }));
  await userEvent.click(await screen.findByRole("option", { name: "Primeira coluna" }));
  expect(formulario.checkValidity()).toBe(true);
  expect(new FormData(formulario).get("coluna")).toBe("0");
});

it("grupos têm título, bloqueiam opções indisponíveis e preservam ajuda acessível", async () => {
  const mudar = vi.fn();
  render(<><p id="ajuda">Escolha uma categoria disponível.</p><SelecaoFormulario aria-label="Categoria" aria-describedby="ajuda" defaultValue="a" onValueChange={mudar}><optgroup label="Entradas"><option value="a">Vendas</option></optgroup><optgroup label="Saídas" disabled><option value="b">Taxa indisponível</option></optgroup></SelecaoFormulario></>);
  const campo = screen.getByRole("combobox", { name: "Categoria" });
  expect(campo.getAttribute("aria-describedby")).toBe("ajuda");
  await userEvent.click(campo);
  const grupo = await screen.findByRole("group", { name: "Saídas" });
  expect(within(grupo).getByRole("option", { name: "Taxa indisponível" }).getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByRole("option", { name: "Vendas" }).getAttribute("aria-selected")).toBe("true");
  await userEvent.keyboard("{Escape}");
  expect(mudar).not.toHaveBeenCalled();
});

it("controle desabilitado não abre nem entra no FormData", async () => {
  const { container } = render(<form><SelecaoFormulario name="categoria" aria-label="Categoria" disabled><option value="a">Vendas</option></SelecaoFormulario></form>);
  const campo = screen.getByRole("combobox", { name: "Categoria" });
  await userEvent.click(campo);
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(new FormData(container.querySelector("form")!).has("categoria")).toBe(false);
});
