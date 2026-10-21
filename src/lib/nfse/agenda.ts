const DIA = 24 * 60 * 60_000;
export const INTERVALO_NFSE = 60 * 60_000;

type EstadoAgenda = {
  ultimaBuscaAutomaticaEm?: Date | null;
  proximaBuscaAutomaticaEm?: Date | null;
  proximaBuscaEm?: Date | null;
};

function horarioDiario(agora: Date) {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return new Date(`${dia}T03:15:00-03:00`);
}

export function proximaBuscaDiariaNfse(agora: Date) {
  const horario = horarioDiario(agora);
  return horario > agora ? horario : new Date(horario.getTime() + DIA);
}

export function horarioBuscaAutomaticaNfse(estado: EstadoAgenda | null, agora: Date) {
  const diaria = horarioDiario(agora);
  const horario = estado?.proximaBuscaAutomaticaEm
    ?? (estado?.ultimaBuscaAutomaticaEm && estado.ultimaBuscaAutomaticaEm >= diaria
      ? proximaBuscaDiariaNfse(agora) : diaria);
  return new Date(Math.max(horario.getTime(), estado?.proximaBuscaEm?.getTime() ?? 0));
}

export function buscaAutomaticaNfseDevida(estado: EstadoAgenda | null, agora: Date) {
  return horarioBuscaAutomaticaNfse(estado, agora) <= agora;
}
