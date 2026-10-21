export type FrequenciaRecorrencia = "DIARIO" | "SEMANAL" | "QUINZENAL" | "MENSAL";

export const frequenciaRecorrenciaLabels: Record<FrequenciaRecorrencia, string> = {
  DIARIO: "Diário",
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
};

// Soma `vezes` períodos de `frequencia` a partir de `data` — usado tanto pra gerar o
// preview das parcelas no client quanto pra calcular a competência de cada parcela no
// servidor (mesmo cálculo dos dois lados, pra não haver divergência entre o que o
// usuário viu na tela e o que foi de fato salvo).
export function somarFrequencia(data: Date, frequencia: FrequenciaRecorrencia, vezes: number): Date {
  const resultado = new Date(data);
  switch (frequencia) {
    case "DIARIO":
      resultado.setDate(resultado.getDate() + vezes);
      return resultado;
    case "SEMANAL":
      resultado.setDate(resultado.getDate() + vezes * 7);
      return resultado;
    case "QUINZENAL":
      resultado.setDate(resultado.getDate() + vezes * 15);
      return resultado;
    case "MENSAL":
      resultado.setMonth(resultado.getMonth() + vezes);
      return resultado;
  }
}

export function dataParaIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
