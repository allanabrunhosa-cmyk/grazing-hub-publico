import { diaValido, somarDias } from "./pedidos-agenda-dominio";

/** Política nacional de dias úteis para operações financeiras (não expediente de agência).
 * CMN 4.880/2020, arts. 3º e 6º: https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4880&tipo=RESOLU%C3%87%C3%83O+CMN
 * Calendário conferido com https://feriadosbancarios.febraban.org.br/ em 20/10/2026.
 * Feriados locais e pontos facultativos da administração pública não integram esta política.
 */
export const VERSAO_CALENDARIO_BANCARIO = "BR_CMN4880_2026_V1";
type Feriado = { dia: string; nome: string; natureza: "NACIONAL" | "BANCARIO" };
const cache = new Map<number, readonly Feriado[]>();

function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = (h + l - 7 * m + 114) % 31 + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
export function feriadosBancariosNacionais(ano: number): readonly Feriado[] {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2220) throw new Error("Ano do calendário bancário inválido.");
  const existente = cache.get(ano); if (existente) return existente;
  const fixos = [["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"], ["09-07", "Independência do Brasil"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"], ["11-15", "Proclamação da República"], ["12-25", "Natal"]];
  // Lei 14.759/2023 (DOU22/12/2023): não aplicar retroativamente a2023.
  if (ano >= 2024) fixos.push(["11-20", "Consciência Negra"]);
  const domingo = pascoa(ano);
  const moveis = [[-48, "Carnaval (segunda-feira)"], [-47, "Carnaval (terça-feira)"], [-2, "Sexta-feira da Paixão"], [60, "Corpus Christi"]] as const;
  const lista = [...fixos.map(([dia, nome]) => ({ dia: `${ano}-${dia}`, nome, natureza: "NACIONAL" as const })), ...moveis.map(([dias, nome]) => ({ dia: somarDias(domingo, dias), nome, natureza: "BANCARIO" as const }))].sort((a, b) => a.dia.localeCompare(b.dia));
  const congelada = Object.freeze(lista.map(f => Object.freeze(f))); cache.set(ano, congelada); return congelada;
}
export function diaUtilBancarioNacional(dia: string) {
  if (!diaValido(dia)) throw new Error("Dia do calendário bancário inválido.");
  const semana = new Date(dia + "T12:00:00Z").getUTCDay();
  return semana !== 0 && semana !== 6 && !feriadosBancariosNacionais(Number(dia.slice(0, 4))).some(f => f.dia === dia);
}
/** Horário especial não transforma Cinzas/24/12/último útil em feriado de mercado. */
export function expedienteBancarioNacional(dia: string): "NORMAL" | "REDUZIDO" | "SEM_ATENDIMENTO_PUBLICO" | "FECHADO" {
  if (!diaUtilBancarioNacional(dia)) return "FECHADO";
  const ano = Number(dia.slice(0, 4));
  let ultimo = `${ano}-12-31`; while (!diaUtilBancarioNacional(ultimo)) ultimo = somarDias(ultimo, -1);
  if (dia === ultimo) return "SEM_ATENDIMENTO_PUBLICO";
  return dia.endsWith("-12-24") || dia === somarDias(pascoa(ano), -46) ? "REDUZIDO" : "NORMAL";
}
