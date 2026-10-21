export function periodoDoMes(mes: string): { de: string; ate: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const [ano, numeroMes] = mes.split("-").map(Number);
  if (ano < 1) return null;
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return { de: `${mes}-01`, ate: `${mes}-${dias[numeroMes - 1]}` };
}

export function periodoDoAno(ano: string): { de: string; ate: string } | null {
  if (!/^\d{4}$/.test(ano) || Number(ano) < 1) return null;
  return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
}


export function periodoUltimosDias(dias: number, hoje: Date): { de: string; ate: string } {
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  const formatar = (data: Date) => [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
  return { de: formatar(inicio), ate: formatar(hoje) };
}

export function mesesFechados(hoje: Date): { valor: string; label: string }[] {
  return Array.from({ length: hoje.getMonth() }, (_, indice) => {
    const mes = hoje.getMonth() - indice;
    const data = new Date(hoje.getFullYear(), mes - 1, 1);
    const label = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { valor: String(hoje.getFullYear()) + "-" + String(mes).padStart(2, "0"), label: label[0].toUpperCase() + label.slice(1) };
  });
}

// Campos vazios removem o limite; relatórios diários usam os extremos do histórico disponível.
export function completarPeriodo(periodo: { de: string; ate: string }, datas: (string | null | undefined)[], hoje: string) {
  const validas = [...datas, periodo.de, periodo.ate].filter((data): data is string => !!data)
    .map(data => data.slice(0, 10)).filter(data => {
      const mes = periodoDoMes(data.slice(0, 7));
      return !!mes && data.length === 10 && data >= mes.de && data <= mes.ate;
    }).sort();
  return { de: periodo.de || validas[0] || hoje, ate: periodo.ate || validas.at(-1) || hoje };
}

// Calendário de Brasília, comum ao servidor e à interface.
export function periodoMesAteHoje(hoje = new Date()): { de: string; ate: string } {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(hoje);
  const valor = (tipo: string) => partes.find(parte => parte.type === tipo)!.value;
  const mes = valor("year") + "-" + valor("month");
  return { de: mes + "-01", ate: mes + "-" + valor("day") };
}

// Ausência aplica o padrão; datas vazias ou parciais são escolhas explícitas.
export function aplicarPeriodoPadrao<T extends { de?: string; ate?: string }>(filtros: T, hoje = new Date()): T {
  return filtros.de === undefined && filtros.ate === undefined
    ? { ...filtros, ...periodoMesAteHoje(hoje) } : filtros;
}
