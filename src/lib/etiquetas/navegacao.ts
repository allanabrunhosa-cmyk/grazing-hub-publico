export type SecaoEtiquetas = "etiquetas" | "validades" | "configuracoes";

export function secaoEtiquetas(valor: unknown): SecaoEtiquetas {
  return valor === "validades" || valor === "configuracoes" ? valor : "etiquetas";
}

export const titulosSecoesEtiquetas = {
  etiquetas: "Imprimir etiquetas",
  validades: "Gestão de validades",
  configuracoes: "Configurações",
};
