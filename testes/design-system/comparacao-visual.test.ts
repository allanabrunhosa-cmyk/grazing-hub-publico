import { expect, it } from "vitest";
import { compararPixels } from "../../scripts/comparar-design.mjs";
it("compara pixels e rejeita dimensão diferente sem regravar referência", () => {
  const imagem = { width: 2, height: 1, data: Buffer.from([0,0,0,255,255,255,255,255]) };
  expect(compararPixels(imagem, imagem)).toMatchObject({ iguais: true, pixelsDiferentes: 0 });
  expect(compararPixels(imagem, { ...imagem, data: Buffer.from([1,0,0,255,255,255,255,255]) })).toMatchObject({ iguais: false, pixelsDiferentes: 1, percentual: 50 });
  expect(compararPixels(imagem, { ...imagem, width: 1 })).toMatchObject({ iguais: false });
});
