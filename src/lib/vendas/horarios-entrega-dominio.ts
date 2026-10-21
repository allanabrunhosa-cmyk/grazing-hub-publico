import { diaValido } from "./pedidos-agenda-dominio";
import { ErroPedidoVenda } from "./pedidos-dominio";

export const DIAS_ENTREGA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
export const HORAS_ENTREGA = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const MINUTOS_ENTREGA = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
export type FaixaEntrega = { inicio: string; fim: string; texto: string };
export type DiaEntrega = { fechado: boolean; horarios: FaixaEntrega[]; copiadoDe?: number };
export type HorariosEntrega = { semana: DiaEntrega[]; desativadas: string[]; especiais: { data: string; horarios: FaixaEntrega[] }[] };
export class ErroHorariosEntrega extends ErroPedidoVenda {}
export function horariosEntregaVazios(): HorariosEntrega {
  return { semana: DIAS_ENTREGA.map(() => ({ fechado: true, horarios: [] })), desativadas: [], especiais: [] };
}
export function valorHorarioEntrega(h: FaixaEntrega) { return h.texto || `${h.inicio}–${h.fim}`; }
export function rotuloHorarioEntrega(h: FaixaEntrega) {
  return h.texto && h.inicio ? `${h.texto} · ${h.inicio}–${h.fim}` : valorHorarioEntrega(h);
}
function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroHorariosEntrega("Configuração de horários inválida.");
  return v as Record<string, unknown>;
}
function texto(v: unknown) {
  if (typeof v !== "string") throw new ErroHorariosEntrega("Horário inválido.");
  return v.trim();
}
function horarios(v: unknown, nome: string, obrigatorio: boolean): FaixaEntrega[] {
  if (!Array.isArray(v) || v.length > 100 || (obrigatorio && !v.length)) throw new ErroHorariosEntrega(`${nome}: adicione ao menos um horário ou marque o dia como fechado (máximo de 100 horários).`);
  const valores = new Set<string>();
  return v.map(valor => {
    const h = objeto(valor), inicio = texto(h.inicio), fim = texto(h.fim), descricao = texto(h.texto);
    if (descricao.length > 100) throw new ErroHorariosEntrega(`${nome}: o texto deve ter até 100 caracteres.`);
    const horaValida = (s: string) => /^([01]\d|2[0-3]):[0-5][05]$/.test(s);
    if ((inicio || fim) && (!horaValida(inicio) || (!horaValida(fim) && fim !== "24:00") || fim <= inicio)) throw new ErroHorariosEntrega(`${nome}: informe início e término em passos de 5 minutos, com término após o início.`);
    if (!inicio && !descricao) throw new ErroHorariosEntrega(`${nome}: informe início e término ou um horário em texto.`);
    const faixa = { inicio, fim, texto: descricao }, opcao = valorHorarioEntrega(faixa);
    if (valores.has(opcao)) throw new ErroHorariosEntrega(`${nome}: há opções de horário repetidas.`);
    valores.add(opcao);
    return faixa;
  });
}
export function validarHorariosEntrega(valor: unknown): HorariosEntrega {
  const v = objeto(valor);
  if (!Array.isArray(v.semana) || v.semana.length !== 7) throw new ErroHorariosEntrega("Configure os sete dias da semana.");
  const semana = v.semana.map((valor, i) => {
    const dia = objeto(valor);
    if (typeof dia.fechado !== "boolean") throw new ErroHorariosEntrega("Informe se o dia está fechado.");
    if (dia.copiadoDe !== undefined && (typeof dia.copiadoDe !== "number" || !Number.isInteger(dia.copiadoDe) || dia.copiadoDe < 0 || dia.copiadoDe > 6 || dia.copiadoDe === i)) throw new ErroHorariosEntrega("Escolha outro dia da semana para copiar.");
    return { fechado: dia.fechado, horarios: horarios(dia.horarios, DIAS_ENTREGA[i], !dia.fechado), ...(dia.copiadoDe !== undefined ? { copiadoDe: dia.copiadoDe as number } : {}) };
  });
  if (!Array.isArray(v.desativadas) || !Array.isArray(v.especiais) || v.desativadas.length > 500 || v.especiais.length > 500) throw new ErroHorariosEntrega("Informe até 500 datas em cada lista de exceções.");
  const desativadas: string[] = v.desativadas.map(data => {
    if (typeof data !== "string" || !diaValido(data)) throw new ErroHorariosEntrega("Data desativada inválida.");
    return data;
  });
  const especiais = v.especiais.map(valor => {
    const e = objeto(valor);
    if (typeof e.data !== "string" || !diaValido(e.data)) throw new ErroHorariosEntrega("Data especial inválida.");
    return { data: e.data, horarios: horarios(e.horarios, `Data ${e.data}`, true) };
  });
  const datas = [...desativadas, ...especiais.map(e => e.data)];
  if (new Set(datas).size !== datas.length) throw new ErroHorariosEntrega("Uma data não pode se repetir nem ser especial e desativada ao mesmo tempo.");
  return { semana, desativadas: desativadas.sort(), especiais: especiais.sort((a, b) => a.data.localeCompare(b.data)) };
}
export function disponibilidadeEntrega(config: HorariosEntrega | null | undefined, data: string) {
  if (!config) return { configurado: false, fechado: false, horarios: [] as FaixaEntrega[] };
  if (!diaValido(data)) return { configurado: true, fechado: false, horarios: [] as FaixaEntrega[] };
  if (config.desativadas.includes(data)) return { configurado: true, fechado: true, horarios: [] as FaixaEntrega[] };
  const especial = config.especiais.find(e => e.data === data);
  const dia = config.semana[(new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7];
  const faixas = especial?.horarios ?? (dia.fechado ? [] : dia.horarios);
  return { configurado: true, fechado: faixas.length === 0, horarios: faixas };
}
export function exigirHorarioEntrega(config: HorariosEntrega | null, data: string, valor: string | null) {
  const disponivel = disponibilidadeEntrega(config, data);
  if (!disponivel.configurado) return;
  if (disponivel.fechado) throw new ErroHorariosEntrega("Não há entregas disponíveis nesta data. Escolha outra data.");
  if (!disponivel.horarios.some(h => valorHorarioEntrega(h) === valor)) throw new ErroHorariosEntrega("Selecione um horário disponível para a data de entrega.");
}
