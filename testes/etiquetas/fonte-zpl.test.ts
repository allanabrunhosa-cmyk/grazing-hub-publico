import { expect, it } from "vitest";
import { dimensionarFonte0 } from "@/lib/etiquetas/fonte-zpl";

it("converte o avanço visível de números para a célula proporcional, sem condensar a impressão", () => {
  // Fonte 0: cada dígito avança 19,2 dots quando a célula recebe 40 dots.
  const resultado = dimensionarFonte0("0123456789", 14);
  expect(resultado.larguraFonte).toBe(29);
  expect(resultado.larguraTexto).toBeGreaterThanOrEqual(139);
  expect(resultado.larguraTexto).toBeLessThanOrEqual(140);
});

it("mantém a mesma largura composta para letras estreitas e largas", () => {
  const estreitas = dimensionarFonte0("IIIIIIIIII", 22);
  const largas = dimensionarFonte0("WWWWWWWWWW", 22);
  expect(estreitas.larguraFonte).toBeGreaterThan(largas.larguraFonte);
  for (const resultado of [estreitas, largas]) {
    expect(resultado.larguraTexto).toBeGreaterThanOrEqual(214);
    expect(resultado.larguraTexto).toBeLessThanOrEqual(220);
  }
});

it.each(["15/10/2026 - 17H26", "PRODUTO FICTICIO", "END.: Av. das Palmeiras, 123, sala 4,", "? / \\ & # % + < > = : ( )"])("preserva a largura reservada para %s", (texto) => {
  const resultado = dimensionarFonte0(texto, 14);
  expect(resultado.larguraTexto).toBeLessThanOrEqual(texto.length * 14);
  expect(resultado.larguraTexto).toBeGreaterThan(texto.length * 14 * 0.95);
});
