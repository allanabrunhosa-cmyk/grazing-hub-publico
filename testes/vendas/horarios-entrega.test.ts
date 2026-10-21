import { describe, expect, it } from "vitest";
import { disponibilidadeEntrega, exigirHorarioEntrega, horariosEntregaVazios, validarHorariosEntrega } from "@/lib/vendas/horarios-entrega-dominio";

const faixa = { inicio: "09:05", fim: "12:30", texto: "Pela manhã" };
function agenda() { const c = horariosEntregaVazios(); c.semana[0] = { fechado: false, horarios: [faixa, { inicio: "14:00", fim: "18:55", texto: "" }, { inicio: "", fim: "", texto: "A combinar" }] }; return c; }
describe("horários de entrega", () => {
  it("preserva a origem da cópia e a ordem das opções sem gravar chaves da interface", () => {
    const c = agenda(); c.semana[1] = { fechado: false, copiadoDe: 0, horarios: [...c.semana[0].horarios].reverse() };
    const salvo = validarHorariosEntrega(c);
    expect(salvo.semana[1].copiadoDe).toBe(0);
    expect(disponibilidadeEntrega(salvo, "2026-10-06").horarios.map(h => h.texto)).toEqual(["A combinar", "", "Pela manhã"]);
    for (const origem of [-1, 7, 1, 0.5, "0"]) expect(() => validarHorariosEntrega({ ...c, semana: c.semana.map((d, i) => i === 1 ? { ...d, copiadoDe: origem } : d) })).toThrow("outro dia");
  });
  it("resolve o dia civil sem depender do fuso do computador e aceita várias opções", () => {
    const c = validarHorariosEntrega(agenda());
    expect(disponibilidadeEntrega(c, "2026-10-05").horarios).toHaveLength(3);
    expect(disponibilidadeEntrega(c, "2026-10-04").fechado).toBe(true);
    expect(() => exigirHorarioEntrega(c, "2026-10-05", "Pela manhã")).not.toThrow();
    expect(() => exigirHorarioEntrega(c, "2026-10-05", "14:00–18:55")).not.toThrow();
    expect(() => exigirHorarioEntrega(c, "2026-10-05", "A combinar")).not.toThrow();
    expect(() => exigirHorarioEntrega(c, "2026-10-05", "09:05–12:30")).toThrow("Selecione");
  });
  it("datas especiais substituem a semana e podem abrir um dia fechado", () => {
    const c = agenda(); c.especiais = [{ data: "2026-10-04", horarios: [faixa] }, { data: "2026-10-05", horarios: [{ inicio: "", fim: "", texto: "Especial" }] }];
    expect(disponibilidadeEntrega(validarHorariosEntrega(c), "2026-10-04").horarios).toEqual([faixa]);
    expect(disponibilidadeEntrega(c, "2026-10-05").horarios[0].texto).toBe("Especial");
  });
  it("bloqueia datas desativadas e dias fechados", () => {
    const c = agenda(); c.desativadas = ["2026-10-05"];
    expect(() => exigirHorarioEntrega(c, "2026-10-05", "Pela manhã")).toThrow("Não há entregas");
    expect(() => exigirHorarioEntrega(c, "2026-10-06", "Pela manhã")).toThrow("Não há entregas");
    expect(() => exigirHorarioEntrega(null, "2026-10-05", "Legado livre")).not.toThrow();
  });
  it.each([
    { inicio: "09:01", fim: "12:30", texto: "" }, { inicio: "09:00", fim: "09:00", texto: "" },
    { inicio: "23:55", fim: "00:05", texto: "" }, { inicio: "25:00", fim: "26:00", texto: "" },
    { inicio: "09:00", fim: "", texto: "Manhã" }, { inicio: "", fim: "", texto: "  " },
  ])("recusa faixa inválida %j", h => { const c = agenda(); c.semana[0].horarios = [h]; expect(() => validarHorariosEntrega(c)).toThrow(); });
  it("recusa datas inválidas, repetidas e conflitantes", () => {
    const c = agenda(); c.desativadas = ["2026-02-30"]; expect(() => validarHorariosEntrega(c)).toThrow("inválida");
    c.desativadas = ["2026-10-05", "2026-10-05"]; expect(() => validarHorariosEntrega(c)).toThrow("repetir");
    c.desativadas = ["2026-10-05"]; c.especiais = [{ data: "2026-10-05", horarios: [faixa] }]; expect(() => validarHorariosEntrega(c)).toThrow("ao mesmo tempo");
  });
  it("recusa opções duplicadas e dia aberto sem horário", () => {
    const c = agenda(); c.semana[0].horarios.push({ ...faixa }); expect(() => validarHorariosEntrega(c)).toThrow("repetidas");
    c.semana[0].horarios = []; expect(() => validarHorariosEntrega(c)).toThrow("ao menos um");
  });
});
