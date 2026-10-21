// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { Button } from "@/components/ui/button";
import { naturezaFinanceiraDoGrupo, naturezaFinanceiraDoTipo, naturezaFinanceiraDoValor } from "@/lib/financeiro/natureza-financeira";
import { grupoDreLabels, ORDEM_GRUPOS_DRE } from "@/lib/labels";

afterEach(cleanup);

it("classifica grupos, lançamentos e valores com a mesma regra", () => {
  expect(naturezaFinanceiraDoGrupo("RECEITA_BRUTA")).toBe("ENTRADA");
  expect(naturezaFinanceiraDoGrupo("RECEITAS_NAO_OPERACIONAIS")).toBe("ENTRADA");
  expect(naturezaFinanceiraDoGrupo("DEDUCOES_RECEITA")).toBe("SAIDA");
  expect(naturezaFinanceiraDoTipo("RECEITA")).toBe("ENTRADA");
  expect(naturezaFinanceiraDoTipo("DESPESA")).toBe("SAIDA");
  expect(naturezaFinanceiraDoValor(10)).toBe("ENTRADA");
  expect(naturezaFinanceiraDoValor(-10)).toBe("SAIDA");
});

it("apresenta Receitas financeiras como grupo 09 antes de Depreciação e Amortização", () => {
  expect(grupoDreLabels.RECEITAS_NAO_OPERACIONAIS).toBe("Receitas financeiras");
  expect(ORDEM_GRUPOS_DRE[8]).toBe("RECEITAS_NAO_OPERACIONAIS");
  expect(ORDEM_GRUPOS_DRE[9]).toBe("DEPRECIACAO_AMORTIZACAO");
});

it("exibe Receitas financeiras antes de Depreciação e Amortização na DRE", () => {
  render(<DreView lancamentos={[]} />);
  const conteudo = document.body.textContent ?? "";
  expect(conteudo.indexOf("Receitas financeiras")).toBeLessThan(
    conteudo.indexOf("Depreciação e Amortização"),
  );
});

it("oferece variantes semânticas para botões de entrada e saída", async () => {
  const usuario = userEvent.setup();
  render(<div>
    <Button variant="entrada">Receita</Button>
    <Button variant="saida">Despesa</Button>
    <Button variant="entrada-outline">A receber</Button>
    <Button variant="saida-outline">A pagar</Button>
  </div>);

  expect(screen.getByRole("button", { name: "Receita" }).className).toContain("bg-success");
  expect(screen.getByRole("button", { name: "Despesa" }).className).toContain("bg-destructive");
  expect(screen.getByRole("button", { name: "A receber" }).className).toContain("text-success");
  expect(screen.getByRole("button", { name: "A pagar" }).className).toContain("text-destructive");
  await usuario.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Receita" }));
});
