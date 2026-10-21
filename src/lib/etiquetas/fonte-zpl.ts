// Avanços da fonte proporcional 0, ASCII 32–126, para ^A0N,40,40 / ^CI27.
// Medidos com dez repetições e marcador final no renderizador Labelary em
// 15/10/2026. São métricas de avanço, não desenhos nem arquivos de fonte.
// A conversão é local e determinística; a impressão não consulta esse serviço.
const AVANCOS_FONTE_0 = [
  11.8, 11.8, 19.2, 19.2, 19.2, 36.1, 24.3, 11.8, 11.8, 11.8, 19.2, 36.1, 11.8, 36.1, 11.8, 11.8,
  19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 11.8, 11.8, 39.8, 36.1, 39.8, 17.7,
  36.1, 22.1, 22.1, 21.4, 23.6, 19.9, 19.9, 23.6, 24.3, 11, 17.7, 22.1, 19.2, 30.2, 24.3, 22.9,
  22.1, 22.9, 23.6, 21.4, 19.9, 24.3, 21.4, 32.5, 22.1, 22.1, 19.9, 11.8, 11.8, 11.8, 19.9, 19.9,
  11.8, 18.4, 19.9, 17.7, 19.9, 19.2, 11, 19.9, 19.9, 10.3, 10.3, 17.7, 10.3, 30.2, 19.9, 19.2,
  19.9, 19.9, 13.3, 16.9, 11, 19.9, 17.7, 26.6, 17.7, 17.7, 15.5, 19.9, 19.9, 19.9, 39.8,
] as const;

/** Recebe o texto ASCII já sanitizado e a largura média definida na composição. */
export function dimensionarFonte0(texto: string, larguraMedia: number) {
  const larguraAlvo = texto.length * larguraMedia;
  const avanco = Array.from(texto).reduce((soma, caractere) =>
    soma + (AVANCOS_FONTE_0[caractere.charCodeAt(0) - 32] ?? AVANCOS_FONTE_0[63 - 32]), 0);
  // ^A0 recebe a largura da célula escalável, não o avanço de cada caractere.
  // Ajustar por texto evita condensar as datas ou alargar demais nomes com M/W.
  const larguraFonte = Math.max(10, avanco ? Math.floor(larguraAlvo * 40 / avanco) : 10);
  return { larguraFonte, larguraTexto: Math.ceil(avanco * larguraFonte / 40) };
}
