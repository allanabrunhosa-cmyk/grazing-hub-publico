import { ErroPedidoVenda } from "./pedidos-dominio";
import { diaValido } from "./pedidos-agenda-dominio";
import { disponibilidadeEntrega, validarHorariosEntrega, valorHorarioEntrega, type HorariosEntrega, type FaixaEntrega } from "./horarios-entrega-dominio";
export type HorariosLegados = { grade: 30 | 60; dias: { intervalos: { inicio: string; fim: string }[] }[] };
export type HorariosPedidos = HorariosLegados | HorariosEntrega;
export const horariosVazios = (): HorariosLegados => ({ grade: 60, dias: Array.from({ length: 7 }, () => ({ intervalos: [] })) });
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function validarHorarios(valor: unknown): HorariosPedidos {
  if (valor && typeof valor === "object" && "semana" in valor) return validarHorariosEntrega(valor);
  const h = valor as HorariosLegados;
  if (!h || ![30, 60].includes(h.grade) || !Array.isArray(h.dias) || h.dias.length !== 7) throw new ErroPedidoVenda("Informe a grade e os sete dias da semana.");
  return { grade: h.grade, dias: h.dias.map(d => {
    if (!d || !Array.isArray(d.intervalos) || d.intervalos.length > 6) throw new ErroPedidoVenda("Informe até seis períodos por dia.");
    const intervalos = d.intervalos.map(i => {
      if (!i || !/^([01]\d|2[0-3]):[0-5]\d$/.test(i.inicio) || !/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(i.fim) || minutos(i.inicio) >= minutos(i.fim)) throw new ErroPedidoVenda("Informe início e fim válidos no mesmo dia.");
      if (minutos(i.inicio) % h.grade || minutos(i.fim) % h.grade) throw new ErroPedidoVenda("Alinhe os horários à grade escolhida.");
      return { inicio: i.inicio, fim: i.fim };
    }).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (intervalos.some((i, n) => n > 0 && intervalos[n - 1].fim > i.inicio)) throw new ErroPedidoVenda("Os períodos do mesmo dia não podem se sobrepor.");
    return { intervalos };
  }) };
}
export function janelasDoDia(data: string | null, horarios: HorariosPedidos | null) {
  if (!data || !diaValido(data)) return [];
  if (horarios && "semana" in horarios) return disponibilidadeEntrega(horarios, data).horarios.map(valorHorarioEntrega);
  const grade = horarios?.grade ?? 60;
  const intervalos = horarios ? horarios.dias[new Date(data + "T12:00:00Z").getUTCDay()].intervalos : [{ inicio: "00:00", fim: "24:00" }];
  return intervalos.flatMap(i => { const opcoes: string[] = []; for (let m = minutos(i.inicio); m + grade <= minutos(i.fim); m += grade) opcoes.push(`${hora(m)}–${hora(m + grade)}`); return opcoes; });
}

/** Converte a grade anterior em opções equivalentes, sem regravar o cadastro ao consultar. */
export function converterHorariosEntrega(h: HorariosPedidos | null, padraoPedido = false): HorariosEntrega | null {
  if (h && "semana" in h) return h;
  if (!h && !padraoPedido) return null;
  return { semana: Array.from({ length: 7 }, (_, n) => {
    // 05/10/2026 é segunda-feira; preserva a ordem segunda → domingo no editor.
    const data = `2026-10-${String(5 + n).padStart(2, "0")}`;
    const horarios: FaixaEntrega[] = janelasDoDia(data, h).map(v => { const [inicio, fim] = v.split("–"); return { inicio, fim, texto: "" }; });
    return { fechado: !horarios.length, horarios };
  }), desativadas: [], especiais: [] };
}
