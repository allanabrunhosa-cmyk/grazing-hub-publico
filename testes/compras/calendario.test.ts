import { it, expect } from "vitest";
import { dataISO, diasCalendario } from "@/app/(protegido)/compras/calendario";
import { statusExibicaoPedido } from "@/app/(protegido)/compras/types";
it("gera fevereiro bissexto e só as semanas necessárias", () => {
  const dias = diasCalendario(new Date(2024, 1, 15), "mes").map(dataISO);
  expect(dias).toContain("2024-02-29"); expect(dias).toHaveLength(35);
  expect(diasCalendario(new Date(2026, 1, 1), "mes")).toHaveLength(28);
});
it("a semana atravessa mês e ano sem perder dias", () => {
  expect(diasCalendario(new Date(2026, 11, 31), "semana").map(dataISO)).toEqual(["2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
});
it("distingue recebido, divergência, atraso e reabertura pelas regras de status", () => {
  const pedido = { status: "RECEBIDO_TOTAL" as const, previsaoEntrega: "2026-09-09", temDivergencia: false };
  expect(statusExibicaoPedido(pedido, "2026-09-10")).toBe("RECEBIDO");
  expect(statusExibicaoPedido({ ...pedido, temDivergencia: true }, "2026-09-10")).toBe("RECEBIDO_COM_DIVERGENCIA");
  expect(statusExibicaoPedido({ ...pedido, status: "CONFIRMADO" }, "2026-09-10")).toBe("ATRASADO");
  expect(statusExibicaoPedido({ ...pedido, status: "CONFIRMADO", previsaoEntrega: null }, "2026-09-10")).toBe("PENDENTE");
});
