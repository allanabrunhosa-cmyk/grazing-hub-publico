import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

for (const largura of [390, 768, 1440]) test(`divide em quatro faturas sem transbordar em ${largura}px`, async ({ page }) => {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.goto("/parcelamento-cartao.html");
  await page.getByLabel("Quantidade de parcelas para dividir 1").fill("4");
  const campo = await page.getByLabel("Quantidade de parcelas para dividir 1").boundingBox();
  const botao = await page.getByRole("button", { name: "Dividir em parcelas o valor da parcela 1", exact: true }).boundingBox();
  expect(campo?.height).toBeCloseTo(botao?.height ?? -1, 0);
  await page.getByRole("button", { name: "Dividir em parcelas o valor da parcela 1", exact: true }).click();
  await expect(page.getByLabel(/Valor da parcela .* em reais/)).toHaveCount(4);
  await expect(page.getByLabel("Valor da parcela 001 em reais")).toHaveValue("37,38");
  await expect(page.getByLabel("Vencimento da parcela 1", { exact: true })).toHaveValue("2026-10-15");
  await expect(page.getByLabel("Vencimento da parcela 4", { exact: true })).toHaveValue("2027-01-15");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(`.tmp/parcelamento-cartao/parcelas-${largura}.png`), fullPage: true });
});
