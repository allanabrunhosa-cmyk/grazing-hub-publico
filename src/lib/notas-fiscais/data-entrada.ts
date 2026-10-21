const formatoDia = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});

export function diaEntradaEstoque(data = new Date()): string {
  return formatoDia.format(data);
}

// A confirmação altera o saldo imediatamente; datas futuras não agendam entradas.
// Meio-dia de Brasília preserva o dia escolhido nos filtros e na apresentação.
export function validarDataEntradaEstoque(valor: unknown, agora = new Date()): { data: Date } | { erro: string } {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { erro: "Informe a data de entrada no estoque." };
  }
  const data = new Date(`${valor}T12:00:00-03:00`);
  if (!Number.isFinite(data.getTime()) || diaEntradaEstoque(data) !== valor) {
    return { erro: "Informe uma data de entrada válida." };
  }
  if (valor > diaEntradaEstoque(agora)) {
    return { erro: "A data de entrada não pode ser futura. Confirme após receber os produtos." };
  }
  return { data };
}
