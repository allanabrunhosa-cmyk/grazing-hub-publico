/** Datas civis pertencem à loja, nunca ao fuso do computador do operador. */
export function diaNoFuso(agora: Date, fuso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}
export function diaValido(d?: string): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
}
export function somarDias(d: string, dias: number) { return new Date(Date.parse(d + "T12:00:00Z") + dias * 86400000).toISOString().slice(0, 10); }
export function periodoCalendario(dia: string, visao: string) {
  const data = new Date(dia + "T12:00:00Z");
  let inicio = dia, fim = dia;
  if (visao === "semana") { inicio = somarDias(dia, -((data.getUTCDay() + 6) % 7)); fim = somarDias(inicio, 6); }
  if (visao === "mes") { inicio = dia.slice(0, 7) + "-01"; fim = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10); }
  const dias: string[] = []; for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return { inicio, fim, dias };
}
export function entregaAtrasada(data: string | null, janela: string | null, fuso: string, agora = new Date()) {
  if (!data) return false;
  const hoje = diaNoFuso(agora, fuso);
  if (data < hoje) return true;
  if (data > hoje) return false;
  // Texto livre não é convertido em uma duração ou hora presumida.
  const horas = janela?.match(/^(\d{2}:\d{2})(?:\s*[–-]\s*(\d{2}:\d{2}))?$/);
  if (!horas) return false;
  const limite = horas[2] ?? horas[1];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(limite)) return false;
  return new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(agora) > limite;
}

/** Primeiro instante do dia civil; contempla mudanças de offset sem presumir 24 h. */
export function inicioDiaNoFuso(dia: string, fuso: string) {
  if (!diaValido(dia)) throw new Error("Dia inválido.");
  const formatar = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" });
  const referencia = Date.parse(dia + "T00:00:00Z");
  let inicio = referencia - 36 * 3600000, fim = referencia + 36 * 3600000;
  while (inicio < fim) {
    const meio = Math.floor((inicio + fim) / 2);
    if (formatar.format(new Date(meio)) < dia) inicio = meio + 1; else fim = meio;
  }
  return new Date(inicio);
}
export function intervaloDatasPedidos(de: string | undefined, ate: string | undefined, base: string | undefined, fuso: string) {
  const instante = (dia: string) => base === "entrega" ? new Date(dia + "T00:00:00Z") : inicioDiaNoFuso(dia, fuso);
  return { ...(diaValido(de) ? { gte: instante(de) } : {}), ...(diaValido(ate) ? { lt: instante(somarDias(ate, 1)) } : {}) };
}
