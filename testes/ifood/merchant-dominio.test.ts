import { describe, expect, it } from "vitest";
import { lerHorariosMerchant, validarTurnosMerchant, horarioCivilMerchant, instanteParaMerchant, exibirHorarioMerchant } from "@/lib/ifood/merchant-dominio";
import { merchant, orderId } from "./fixtures";
describe("Horários Merchant",()=>{
 it("preserva múltiplos turnos e verifica sobreposição após meia-noite",()=>{
  const turnos=[{dayOfWeek:"MONDAY",start:"23:00:00",duration:120},{dayOfWeek:"TUESDAY",start:"01:00:00",duration:60}];
  expect(validarTurnosMerchant(turnos)).toHaveLength(2);
  expect(()=>validarTurnosMerchant([...turnos,{dayOfWeek:"TUESDAY",start:"00:30:00",duration:30}])).toThrow(/sobrepõem/);
  expect(()=>validarTurnosMerchant([{dayOfWeek:"SUNDAY",start:"23:00:00",duration:120},{dayOfWeek:"MONDAY",start:"00:30:00",duration:60}])).toThrow(/semana/);
 });
 it("rejeita precisão inválida, horário desconhecido e outra loja",()=>{
  expect(()=>validarTurnosMerchant([{dayOfWeek:"MONDAY",start:"09:00:00",duration:1.5}])).toThrow(/inválido/);
  expect(()=>validarTurnosMerchant([{dayOfWeek:"FUTURO",start:"24:00:00",duration:10}])).toThrow();
  expect(()=>lerHorariosMerchant({storeId:orderId,shifts:[]},merchant)).toThrow(/loja/);
 });
 it("Interruptions usa fuso da loja, compara fração sem offset e não aceita data impossível",()=>{
  expect(instanteParaMerchant(new Date("2026-10-07T03:23:10.850Z"),"America/Sao_Paulo")).toBe("2026-10-07T00:23:10.850");
  expect(horarioCivilMerchant("2026-10-07T03:23:10.85")).toBe(horarioCivilMerchant("2026-10-07T03:23:10.850Z"));
  expect(exibirHorarioMerchant("2026-10-07T00:23:10.85")).toBe("07/10/2026, 00:23:10");
  expect(()=>horarioCivilMerchant("2026-02-30T00:23:10")).toThrow(/inválida/);
  expect(()=>horarioCivilMerchant("2026-10-07T24:00:00")).toThrow(/inválido/);
 });
});
