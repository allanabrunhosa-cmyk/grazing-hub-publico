// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Button, buttonVariants } from "@/components/ui/button";

afterEach(cleanup);
it("preserva o raio padrão dos consumidores existentes", () => {
  expect(buttonVariants()).toContain("rounded-[var(--ds-botao-raio)]");
  expect(buttonVariants()).not.toContain("rounded-[var(--ds-controle-raio)]");
});
it("oferece o formato de campo sem prop inválida no botão nativo", () => {
  render(<Button formato="campo">Consultar indicadores</Button>);
  const botao = screen.getByRole("button", { name: "Consultar indicadores" });
  expect(botao.className).toContain("rounded-[var(--ds-controle-raio)]");
  expect(botao.hasAttribute("formato")).toBe(false);
});
it("conserva as ações compactas oficiais ao receber o formato optativo", () => {
  render(<Button formato="campo" variant="editar" aria-label="Editar exemplo" />);
  const botao = screen.getByRole("button", { name: "Editar exemplo" });
  expect(botao.className).toContain("ds-acao-compacta");
  expect(botao.className).toContain("rounded-[var(--ds-botao-raio)]");
});
