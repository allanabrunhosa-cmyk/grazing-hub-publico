// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HorarioEntregaCampo } from "@/app/(protegido)/vendas/pedidos/horario-entrega-campo";
import { converterHorariosEntrega } from "@/lib/vendas/pedidos-horarios-dominio";

afterEach(cleanup);
function CampoComJanelaHistorica() {
  const [valor, setValor] = useState("14:00–16:00");
  const [revisao, setRevisao] = useState(0);
  return <><HorarioEntregaCampo configuracao={converterHorariosEntrega(null, true)} data="2026-10-09" valor={valor} alterar={setValor} /><button onClick={() => setRevisao(revisao + 1)}>Atualizar outra informação</button><output aria-label="Janela escolhida">{valor}</output></>;
}
it("troca uma janela histórica por horário disponível sem perder a seleção ao renderizar", async () => {
  const usuario = userEvent.setup();
  render(<CampoComJanelaHistorica />);
  expect(screen.getByRole("combobox", { name: "Horário de entrega" }).textContent).toContain("14:00–16:00");
  await usuario.click(screen.getByRole("combobox", { name: "Horário de entrega" }));
  expect(screen.getByRole("option", { name: "14:00–16:00 · Horário anteriormente informado" }).hasAttribute("data-disabled")).toBe(true);
  await usuario.click(screen.getByRole("option", { name: "14:00–15:00" }));
  expect(screen.getByRole("status", { name: "Janela escolhida" }).textContent).toBe("14:00–15:00");
  await usuario.click(screen.getByRole("button", { name: "Atualizar outra informação" }));
  expect(screen.getByRole("combobox", { name: "Horário de entrega" }).textContent).toContain("14:00–15:00");
  expect(screen.getByRole("status", { name: "Janela escolhida" }).textContent).toBe("14:00–15:00");
});
