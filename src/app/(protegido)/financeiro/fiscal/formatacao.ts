const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarDataFiscal(valor: string): string {
  // A projeção dia fiscal é uma data de negócio, não meia-noite UTC.
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00-03:00` : valor);
  return Number.isFinite(data.getTime()) ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(data) : "Indisponível";
}

/** Formata a projeção decimal sem perder centavos pela conversão a float. */
export function formatarMoedaFiscal(valor: string | null): string {
  if (valor === null || !/^\d+(?:\.\d{1,2})?$/.test(valor)) return "—";
  const [inteiro, fracao = ""] = valor.split(".");
  return moeda.format(BigInt(inteiro)).replace(/,00(?=\D*$)/, `,${fracao.padEnd(2, "0")}`);
}
