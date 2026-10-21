type PartesData = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

export function fusoHorarioValido(fusoHorario: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: fusoHorario }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function obterPartesNoFuso(data: Date, fusoHorario: string): PartesData {
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: fusoHorario,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(data).map((parte) => [parte.type, parte.value]),
  );
  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

function partesComoUtc(partes: PartesData) {
  return Date.UTC(
    partes.ano,
    partes.mes - 1,
    partes.dia,
    partes.hora,
    partes.minuto,
    partes.segundo,
  );
}

function dataUtcDoHorarioLocal(partes: PartesData, fusoHorario: string) {
  const desejado = partesComoUtc(partes);
  let estimativa = desejado;

  // Intl não oferece a operação inversa. As poucas iterações abaixo corrigem o
  // deslocamento do fuso sem assumir que ele é sempre -03:00.
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const observado = partesComoUtc(obterPartesNoFuso(new Date(estimativa), fusoHorario));
    const diferenca = desejado - observado;
    estimativa += diferenca;
    if (diferenca === 0) break;
  }
  return new Date(estimativa);
}

export function fimDoDiaLocal(dataIso: string, fusoHorario: string) {
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
  if (!correspondencia) throw new Error("Informe a validade original no formato de data válido.");
  const ano = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const dia = Number(correspondencia[3]);
  const dataNormalizada = new Date(Date.UTC(ano, mes - 1, dia));
  if (dataNormalizada.getUTCFullYear() !== ano || dataNormalizada.getUTCMonth() !== mes - 1 || dataNormalizada.getUTCDate() !== dia) {
    throw new Error("Informe uma validade original válida.");
  }
  return dataUtcDoHorarioLocal({ ano, mes, dia, hora: 23, minuto: 59, segundo: 0 }, fusoHorario);
}

/**
 * Dias de validade significam dias de calendário da loja, preservando o horário
 * local de manipulação. A regra é usada por prévia persistida, ZPL e histórico.
 */
export function somarDiasDeCalendario(data: Date, dias: number, fusoHorario: string) {
  if (!Number.isInteger(dias) || dias <= 0) {
    throw new Error("O prazo precisa ser informado em dias inteiros positivos.");
  }
  if (!fusoHorarioValido(fusoHorario)) {
    throw new Error("O fuso horário configurado para a loja é inválido.");
  }
  const local = obterPartesNoFuso(data, fusoHorario);
  const alvoNormalizado = new Date(Date.UTC(
    local.ano,
    local.mes - 1,
    local.dia + dias,
    local.hora,
    local.minuto,
    local.segundo,
  ));
  return dataUtcDoHorarioLocal({
    ano: alvoNormalizado.getUTCFullYear(),
    mes: alvoNormalizado.getUTCMonth() + 1,
    dia: alvoNormalizado.getUTCDate(),
    hora: alvoNormalizado.getUTCHours(),
    minuto: alvoNormalizado.getUTCMinutes(),
    segundo: alvoNormalizado.getUTCSeconds(),
  }, fusoHorario);
}

export function formatarDataEtiqueta(
  iso: string,
  fusoHorario: string,
  mostrarHora: boolean,
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoHorario,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(mostrarHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(new Date(iso));
}

