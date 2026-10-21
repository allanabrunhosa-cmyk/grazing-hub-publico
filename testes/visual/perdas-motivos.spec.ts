import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pasta = resolve(__dirname, "../../.tmp/dashboard-operacao-20261020/perdas/capturas");
let auditor = "";
test.beforeAll(async () => {
  await mkdir(pasta, { recursive: true });
  auditor = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
});

for (const tema of ["claro", "escuro"]) for (const largura of [320, 390, 768, 1440]) {
  test(`motivos distintos ${tema} ${largura}`, async ({ page }, info) => {
    const erros: string[] = [];
    page.on("pageerror", erro => erros.push(erro.message));
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto(`/perdas-motivos.html?tema=${tema}`);
    await expect(page.getByRole("list", { name: "Valores por motivo de perda" }).getByRole("listitem")).toHaveCount(5);
    const cores = await page.getByRole("img").locator("pattern rect").evaluateAll(elementos => elementos.map(el => getComputedStyle(el).fill));
    expect(new Set(cores).size).toBe(5);
    const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), auditor);
    await info.attach("auditoria-interface", { body: JSON.stringify(auditoria), contentType: "application/json" });
    expect(auditoria.problemas).toEqual([]);
    await page.screenshot({ path: resolve(pasta, `perdas-${tema}-${largura}.png`), fullPage: true });
    expect(erros).toEqual([]);
  });
}

for (const estado of ["muitos", "zero", "vazio"]) test(`estado ${estado}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/perdas-motivos.html?${estado}`);
  if (estado === "muitos") {
    await expect(page.getByRole("list", { name: "Valores por motivo de perda" }).getByRole("listitem")).toHaveCount(8);
    await expect(page.getByRole("img").locator("pattern path")).toHaveCount(3);
  } else {
    await expect(page.getByRole("img", { name: /sem valores positivos/ })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: resolve(pasta, `perdas-${estado}-390.png`), fullPage: true });
});
