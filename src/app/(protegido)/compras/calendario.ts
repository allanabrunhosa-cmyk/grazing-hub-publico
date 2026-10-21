export function dataISO(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function diasCalendario(referencia: Date, modo: "semana" | "mes") {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), modo === "mes" ? 1 : referencia.getDate());
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const quantidade = modo === "semana" ? 7 : Math.ceil((new Date(referencia.getFullYear(), referencia.getMonth(), 1).getDay() + new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: quantidade }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}
