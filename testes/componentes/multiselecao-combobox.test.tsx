// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

function Exemplo({ aoSalvar = vi.fn() }: { aoSalvar?: (ids: string[]) => void }) {
  const [selecionados, definirSelecionados] = useState(["agua"]);
  return <form onSubmit={(evento) => {
    evento.preventDefault();
    aoSalvar(new FormData(evento.currentTarget).getAll("categorias").map(String));
  }}>
    <MultiselecaoCombobox
      opcoes={[
        { id: "agua", nome: "Água" },
        { id: "energia", nome: "Energia Elétrica" },
        { id: "telefone", nome: "Telefone" },
      ]}
      selecionadosIds={selecionados}
      aoMudar={definirSelecionados}
      name="categorias"
      placeholder="Buscar categoria..."
      ariaLabel="Categorias"
    />
    <button>Salvar</button>
  </form>;
}

it("filtra sem diferenciar acentos e mantém múltiplas opções selecionadas", async () => {
  const usuario = userEvent.setup();
  render(<Exemplo />);
  const busca = screen.getByRole("combobox", { name: "Categorias" });
  await usuario.click(busca);
  await usuario.type(busca, "eletrica");
  expect(screen.getByRole("option", { name: "Energia Elétrica" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Telefone" })).toBeNull();
  await usuario.click(screen.getByRole("option", { name: "Energia Elétrica" }));
  expect(screen.getByText("2 opções selecionadas.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remover Energia Elétrica" })).toBeTruthy();
});

it("envia cada seleção com o mesmo nome de campo no formulário", async () => {
  const usuario = userEvent.setup();
  const aoSalvar = vi.fn();
  render(<Exemplo aoSalvar={aoSalvar} />);
  const busca = screen.getByRole("combobox", { name: "Categorias" });
  await usuario.click(busca);
  await usuario.click(screen.getByRole("option", { name: "Energia Elétrica" }));
  await usuario.keyboard("{Escape}");
  await usuario.click(screen.getByRole("button", { name: "Salvar" }));
  expect(aoSalvar).toHaveBeenCalledWith(["agua", "energia"]);
});

it("fecha com Escape sem apagar as opções já selecionadas", async () => {
  const usuario = userEvent.setup();
  render(<Exemplo />);
  const busca = screen.getByRole("combobox", { name: "Categorias" });
  await usuario.click(busca);
  await usuario.type(busca, "energia");
  await usuario.keyboard("{Escape}{Escape}");
  expect(screen.getByRole("button", { name: "Remover Água" })).toBeTruthy();
  expect(screen.getByText("1 opção selecionada.")).toBeTruthy();
});

it("remove pelo X oficial, mantendo o texto da tag sem ação e sem enviar o formulário", async () => {
  const usuario = userEvent.setup();
  const aoSalvar = vi.fn();
  render(<Exemplo aoSalvar={aoSalvar} />);
  const tags = screen.getByLabelText("Categorias selecionados");
  await usuario.click(within(tags).getByText("Água"));
  const remover = within(tags).getByRole("button", { name: "Remover Água" });
  expect(remover.getAttribute("data-acao")).toBe("remover-discreto");
  expect(remover.className).toContain("text-muted-foreground");
  expect(remover.textContent).toBe("");
  await usuario.click(remover);
  expect(screen.queryByRole("button", { name: "Remover Água" })).toBeNull();
  expect(screen.getByText("Nenhuma opção selecionada.")).toBeTruthy();
  expect(aoSalvar).not.toHaveBeenCalled();
});

it("organiza opções em grupos e seleciona sem lista horizontal", async () => {
  const usuario = userEvent.setup();
  function Grupos() {
    const [ids, definir] = useState<string[]>([]);
    return <MultiselecaoCombobox opcoes={[
      { id: "queijos", nome: "Escolhas de queijo", grupo: "Tábuas" },
      { id: "frutas", nome: "Frutas extras", grupo: "Adicionais" },
    ]} selecionadosIds={ids} aoMudar={definir} placeholder="Buscar grupo" ariaLabel="Grupo de complementos" mostrarChips={false} />;
  }
  render(<Grupos />);
  await usuario.click(screen.getByRole("combobox", { name: "Grupo de complementos" }));
  expect(screen.getByText("Tábuas")).toBeTruthy();
  expect(screen.getByText("Adicionais")).toBeTruthy();
  await usuario.click(screen.getByRole("option", { name: "Escolhas de queijo" }));
  expect(screen.getByText("1 opção selecionada.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remover Escolhas de queijo" })).toBeNull();
});
