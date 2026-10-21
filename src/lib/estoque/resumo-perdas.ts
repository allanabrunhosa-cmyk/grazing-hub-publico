import type { PerdaRow } from "@/app/(protegido)/inventario/types";
import { motivoPerdaLabels } from "@/lib/labels";
import { periodoDoMes } from "@/lib/financeiro/periodos";

export function dataDaPerda(data: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(data));
}

export function filtrarPeriodoPerdas<T>(linhas: T[], de: string, ate: string, obterData: (linha: T) => string): T[] {
  const valida = (data: string) => !data || (/^\d{4}-\d{2}-\d{2}$/.test(data) && !!periodoDoMes(data.slice(0, 7)) && data >= periodoDoMes(data.slice(0, 7))!.de && data <= periodoDoMes(data.slice(0, 7))!.ate);
  if (!valida(de) || !valida(ate) || (de && ate && de > ate)) return [];
  return linhas.filter(linha => {
    const data = dataDaPerda(obterData(linha));
    return (!de || data >= de) && (!ate || data <= ate);
  });
}

export function resumirPerdas(linhas: PerdaRow[]) {
  const totalCentavos = linhas.reduce((soma, linha) => soma + Math.round(linha.valorEstimado * 100), 0);
  const grupos = new Map<string, { chave: string; motivo: PerdaRow["motivo"]; nome: string; centavos: number; registros: number }>();
  for (const linha of linhas) {
    const chave = linha.categoriaPerdaId ?? linha.motivo;
    const grupo = grupos.get(chave) ?? { chave, motivo: linha.motivo, nome: linha.categoriaNome ?? motivoPerdaLabels[linha.motivo], centavos: 0, registros: 0 };
    grupo.centavos += Math.round(linha.valorEstimado * 100);
    grupo.registros++;
    grupos.set(chave, grupo);
  }
  return {
    total: totalCentavos / 100, registros: linhas.length,
    semValor: linhas.filter(linha => linha.valorEstimado === 0).length,
    maiores: [...linhas].filter(linha => linha.valorEstimado > 0).sort((a, b) => b.valorEstimado - a.valorEstimado || a.id.localeCompare(b.id)).slice(0, 3),
    motivos: [...grupos.values()].sort((a, b) => b.centavos - a.centavos || b.registros - a.registros).map(grupo => ({
      ...(grupo.chave !== grupo.motivo ? { chave: grupo.chave } : {}),
      motivo: grupo.motivo, nome: grupo.nome, valor: grupo.centavos / 100, registros: grupo.registros,
      percentual: totalCentavos > 0 ? grupo.centavos / totalCentavos * 100 : 0,
    })),
  };
}
