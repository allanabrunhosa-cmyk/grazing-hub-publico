import { expect, it } from "vitest";
import { converterHorariosEntrega, horariosVazios, validarHorarios, janelasDoDia } from "@/lib/vendas/pedidos-horarios-dominio";
it("grade padrão de uma hora, meia hora e fechamento por dia", () => {
  expect(janelasDoDia("2026-09-28", null)).toContain("08:00–09:00");
  const h = horariosVazios(); h.dias[1].intervalos = [{ inicio: "08:00", fim: "10:00" }];
  expect(janelasDoDia("2026-09-28", validarHorarios(h))).toEqual(["08:00–09:00", "09:00–10:00"]);
  h.grade = 30;
  expect(janelasDoDia("2026-09-28", validarHorarios(h))).toEqual(["08:00–08:30", "08:30–09:00", "09:00–09:30", "09:30–10:00"]);
  expect(janelasDoDia("2026-09-29", h)).toEqual([]);
});
it("converte a configuração anterior preservando todas as opções, fechamento e término à meia-noite", () => {
  const h = horariosVazios(); h.grade = 30;
  h.dias[1].intervalos = [{ inicio: "22:00", fim: "24:00" }];
  const convertido = converterHorariosEntrega(validarHorarios(h));
  expect(janelasDoDia("2026-10-05", convertido)).toEqual(janelasDoDia("2026-10-05", h));
  expect(janelasDoDia("2026-10-06", convertido)).toEqual([]);
  expect(janelasDoDia("2026-10-05", validarHorarios(convertido))).toEqual(janelasDoDia("2026-10-05", h));
  expect(janelasDoDia("2026-10-05", converterHorariosEntrega(null, true))).toEqual(janelasDoDia("2026-10-05", null));
});
it("recusa grade inválida, sobreposição e limites fora da grade", () => {
  expect(() => validarHorarios({ ...horariosVazios(), grade: 15 })).toThrow();
  const h = horariosVazios(); h.dias[0].intervalos = [{ inicio: "08:00", fim: "10:00" }, { inicio: "09:00", fim: "11:00" }];
  expect(() => validarHorarios(h)).toThrow("sobrepor");
  h.dias[0].intervalos = [{ inicio: "08:15", fim: "10:00" }]; expect(() => validarHorarios(h)).toThrow("Alinhe");
  h.dias[0].intervalos = [{ inicio: "22:00", fim: "24:00" }]; expect(janelasDoDia("2026-09-27", validarHorarios(h))).toEqual(["22:00–23:00", "23:00–24:00"]);
});
