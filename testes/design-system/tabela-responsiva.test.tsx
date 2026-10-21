// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

afterEach(cleanup);

it("não amplia tabelas anteriores durante a rolagem até outra tabela", async () => {
  const conteudo = <><Table aria-label="Primeira"><TableBody><TableRow><TableCell>Primeira</TableCell></TableRow></TableBody></Table><Table aria-label="Segunda"><TableBody><TableRow><TableCell>Segunda</TableCell></TableRow></TableBody></Table></>;
  const { container } = render(conteudo);
  const [primeira, segunda] = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="table-container"]'));
  let topo = 200;
  primeira.getBoundingClientRect = () => ({ top: topo } as DOMRect);
  simularLargura(primeira, 360, 700);
  await waitFor(() => expect(primeira.style.getPropertyValue("--table-available-height")).toBe(`${window.innerHeight - 200 - 32}px`));
  topo = -50; segunda.focus(); fireEvent(window, new Event("scroll"));
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(primeira.style.getPropertyValue("--table-available-height")).toBe(`${window.innerHeight - 200 - 32}px`);
});

it("limita colgroup da identificação durante overflow e restaura a largura original", async () => {
  const { container } = render(<Table className="table-fixed"><colgroup><col style={{ width: 320 }} /><col /></colgroup><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Quantidade</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Nome completo</TableCell><TableCell>12</TableCell></TableRow></TableBody></Table>);
  const col = container.querySelector("col")!;
  col.getBoundingClientRect = () => ({ width: 320 } as DOMRect);
  const area = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  simularLargura(area, 360, 700);
  await waitFor(() => expect(col.style.width).toContain("38vw"));
  simularLargura(area, 900, 900);
  await waitFor(() => expect(col.style.width).toBe("320px"));
});

it("não usa a altura de cartões com overflow hidden como limite da tabela", async () => {
  const { container } = render(<div style={{ overflowY: "hidden" }}><Table><TableHeader><TableRow><TableHead>Produto</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Exemplo</TableCell></TableRow></TableBody></Table></div>);
  const cartao = container.firstElementChild as HTMLElement;
  cartao.getBoundingClientRect = () => ({ top: 100, bottom: 350 } as DOMRect);
  const area = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  area.getBoundingClientRect = () => ({ top: 200 } as DOMRect);
  simularLargura(area, 360, 700);
  await waitFor(() => expect(area.style.getPropertyValue("--table-available-height")).toBe(`${window.innerHeight - 200 - 32}px`));
});
function simularLargura(area: HTMLElement, largura: number, total: number) {
  Object.defineProperty(area, "clientWidth", { configurable: true, value: largura });
  Object.defineProperty(area, "scrollWidth", { configurable: true, value: total });
  fireEvent(window, new Event("resize"));
}

it("fixa seleção e identificação juntas, preservando offsets e linhas expandidas", async () => {
  const { container } = render(<Table><TableHeader><TableRow><TableHead><input type="checkbox" aria-label="Selecionar todos" /></TableHead><TableHead>Produto</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell><input type="checkbox" aria-label="Selecionar item" /></TableCell><TableCell>Nome extenso</TableCell><TableCell>R$ 123,45</TableCell></TableRow><TableRow><TableCell colSpan={3}>Composição completa</TableCell></TableRow></TableBody></Table>);
  const cells = container.querySelectorAll<HTMLTableCellElement>("th:first-child,td:first-child:not([colspan])");
  cells.forEach(cell => cell.getBoundingClientRect = () => ({ width: 44 } as DOMRect));
  const area = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  simularLargura(area, 360, 700);
  await waitFor(() => expect(container.querySelectorAll('[data-table-frozen="selecao"]').length).toBe(2));
  const nome = container.querySelector<HTMLElement>('td[data-table-frozen="identificacao"]')!;
  expect(nome.style.getPropertyValue("--table-sticky-left")).toBe("44px");
  expect(container.querySelector("td[colspan]")?.hasAttribute("data-table-frozen")).toBe(false);
  simularLargura(area, 900, 900);
  await waitFor(() => expect(container.querySelectorAll("[data-table-frozen]").length).toBe(0));
});

it("usa a identificação declarada depois da data e recalcula após atualizar registros", async () => {
  const row = (nome: string) => <Table identificationColumn={1}><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Insumo</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>09/10/2026</TableCell><TableCell>{nome}</TableCell></TableRow></TableBody></Table>;
  const tela = render(row("Brie"));
  const area = tela.container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  simularLargura(area, 360, 700);
  await waitFor(() => expect(tela.container.querySelector('td[data-table-frozen="identificacao"]')?.textContent).toBe("Brie"));
  tela.rerender(row("Parmesão"));
  await waitFor(() => expect(tela.container.querySelector('td[data-table-frozen="identificacao"]')?.textContent).toBe("Parmesão"));
  expect(tela.container.querySelector("td:first-child")?.hasAttribute("data-table-frozen")).toBe(false);
});

it("permite excluir a fixação de tabelas sem identificação de registro", async () => {
  const { container } = render(<Table identificationColumn={null}><TableBody><TableRow><TableCell>Total</TableCell><TableCell>10</TableCell></TableRow></TableBody></Table>);
  const area = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  simularLargura(area, 300, 600);
  await waitFor(() => expect(area.dataset.overflow).toBe("true"));
  expect(container.querySelector("[data-table-frozen]")).toBeNull();
});
