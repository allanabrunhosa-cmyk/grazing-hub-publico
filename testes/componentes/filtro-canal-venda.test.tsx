// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiltroCanalVenda } from "@/components/filtro-canal-venda";
import { Button } from "@/components/ui/button";

const canais = [{ id: "site-ficticio", nome: "Site" }, { id: "ifood-ficticio", nome: "iFood" }];
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Controlado({ inicial, aoMudar = () => {}, nomeCanalSelecionado }: { inicial?: string; aoMudar?: (valor: string | undefined) => void; nomeCanalSelecionado?: string }) {
  const [valor, definirValor] = useState(inicial);
  return <FiltroCanalVenda canais={canais} canalId={valor} nomeCanalSelecionado={nomeCanalSelecionado} aoMudar={novo => { definirValor(novo); aoMudar(novo); }} />;
}

it("abre só canais em popup compacto, sem filtros complexos ou confirmação", async () => {
  render(<Controlado />);
  await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
  const popup = screen.getByRole("dialog", { name: "Canal" });
  expect(popup.className).toContain("w-60");
  expect(within(popup).getByRole("heading", { name: "Canal" })).toBeTruthy();
  expect(within(popup).getAllByRole("checkbox")).toHaveLength(3);
  expect(within(popup).getByRole("checkbox", { name: "Todos os canais" }).getAttribute("aria-checked")).toBe("true");
  expect(within(popup).queryByRole("combobox")).toBeNull();
  expect(within(popup).queryByRole("textbox")).toBeNull();
  expect(within(popup).queryByRole("button", { name: /Aplicar|Limpar/ })).toBeNull();
  for (const campo of ["Status", "Situação comercial", "Cliente", "Produto", "Base das datas", "De", "Até"]) expect(within(popup).queryByLabelText(campo)).toBeNull();
});

it("aplica no clique da linha, marca somente um canal e mantém o popup aberto", async () => {
  const mudou = vi.fn(), usuario = userEvent.setup(); render(<Controlado aoMudar={mudou} />);
  await usuario.click(screen.getByRole("button", { name: "Filtros" }));
  await usuario.click(screen.getByText("iFood"));
  expect(mudou).toHaveBeenCalledExactlyOnceWith("ifood-ficticio");
  expect(screen.getByRole("checkbox", { name: "iFood" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("checkbox", { name: "Todos os canais" }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("dialog", { name: "Canal" })).toBeTruthy();
  await usuario.click(screen.getByText("Site"));
  expect(mudou).toHaveBeenLastCalledWith("site-ficticio");
  expect(screen.getByRole("checkbox", { name: "iFood" }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("checkbox", { name: "Site" }).getAttribute("aria-checked")).toBe("true");
});

it("desmarcar o canal ou escolher Todos os canais remove imediatamente o filtro", async () => {
  const mudou = vi.fn(), usuario = userEvent.setup(); render(<Controlado inicial="site-ficticio" aoMudar={mudou} />);
  await usuario.click(screen.getByRole("button", { name: "Filtros" }));
  await usuario.click(screen.getByRole("checkbox", { name: "Site" }));
  expect(mudou).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(screen.getByRole("checkbox", { name: "Todos os canais" }).getAttribute("aria-checked")).toBe("true");
  await usuario.click(screen.getByRole("checkbox", { name: "iFood" }));
  await usuario.click(screen.getByRole("checkbox", { name: "Todos os canais" }));
  expect(mudou).toHaveBeenLastCalledWith(undefined);
  expect(screen.getByRole("dialog", { name: "Canal" })).toBeTruthy();
});

it("preserva canal fora do catálogo até ser removido, sem inventar outro ID", async () => {
  const mudou = vi.fn(), usuario = userEvent.setup(); render(<Controlado inicial="antigo-ficticio" nomeCanalSelecionado="Canal anterior" aoMudar={mudou} />);
  await usuario.click(screen.getByRole("button", { name: "Filtros" }));
  const antigo = screen.getByRole("checkbox", { name: "Canal anterior" });
  expect(antigo.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Fora do catálogo atual; desmarque para remover.")).toBeTruthy();
  expect(mudou).not.toHaveBeenCalled();
  await usuario.click(antigo);
  expect(mudou).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(screen.queryByRole("checkbox", { name: "Canal anterior" })).toBeNull();
});

it("Escape devolve foco e clique externo fecha sem modificar o canal", async () => {
  const mudou = vi.fn(), usuario = userEvent.setup(); render(<><FiltroCanalVenda canais={canais} canalId="site-ficticio" aoMudar={mudou} /><Button>Fora do filtro</Button></>);
  const gatilho = screen.getByRole("button", { name: "Filtros" });
  await usuario.click(gatilho); await usuario.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(gatilho);
  await usuario.click(gatilho); await usuario.click(screen.getByRole("button", { name: "Fora do filtro" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mudou).not.toHaveBeenCalled();
});

it("espaço alterna a opção pelo teclado usando o checkbox oficial", async () => {
  const mudou = vi.fn(), usuario = userEvent.setup(); render(<Controlado aoMudar={mudou} />);
  await usuario.click(screen.getByRole("button", { name: "Filtros" }));
  screen.getByRole("checkbox", { name: "iFood" }).focus();
  await usuario.keyboard(" ");
  expect(mudou).toHaveBeenCalledExactlyOnceWith("ifood-ficticio");
  expect(screen.getByRole("checkbox", { name: "iFood" }).getAttribute("aria-checked")).toBe("true");
});

it("mantém seleção desconhecida sem opções e informa ausência do catálogo", async () => {
  render(<FiltroCanalVenda canais={[]} canalId="desconhecido-ficticio" aoMudar={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
  expect(screen.getByRole("checkbox", { name: "Canal selecionado (indisponível)" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Nenhum canal disponível no catálogo.")).toBeTruthy();
});

it("não abre nem chama alteração quando desabilitado", async () => {
  const mudou = vi.fn(); render(<FiltroCanalVenda canais={canais} aoMudar={mudou} disabled />);
  await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(mudou).not.toHaveBeenCalled();
});

it("mostra contagens de todos os resultados e canais vazios, permitindo escolher zero", async () => {
  const mudar = vi.fn();
  render(<FiltroCanalVenda canais={canais} contagens={{ "": 87, "site-ficticio": 87 }} aoMudar={mudar} />);
  await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
  expect(screen.getByRole("checkbox", { name: "Todos os canais (87)" })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "Site (87)" })).toBeTruthy();
  await userEvent.click(screen.getByRole("checkbox", { name: "iFood (0)" }));
  expect(mudar).toHaveBeenCalledWith("ifood-ficticio");
});
