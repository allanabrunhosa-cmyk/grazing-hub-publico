import { expect, test } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const raiz = resolve(__dirname, "../.."), evidencia = resolve(raiz, ".tmp/fiscal-manual65-ui/evidencias");
test("habilitação65 preserva55 e exige decisão explícita sem fingir homologação", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4496" ? rota.continue() : rota.abort());
  await page.goto(`/brasilnfe.html?estado=habilitacao65&tema=${info.project.metadata.tema}`);
  await expect(page.getByText(/Prévia isolada/)).toBeVisible();
  const modelos = page.getByRole("combobox", { name: "Modelos para habilitar" });
  await modelos.press("Enter");
  await page.getByRole("option", { name: "NF-e e NFC-e", exact: true }).click();
  const producao = page.locator("section").filter({ has: page.getByText("Produção — ambiente 1", { exact: true }) });
  await expect(producao.getByText("Habilitada para outros modelos")).toBeVisible();
  await expect(producao.getByRole("button", { name: "Habilitar emissão manual" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /Autorizo a habilitação manual da NFC-e em produção sem prova local de homologação/ }).check();
  await page.getByRole("checkbox", { name: /Confirmo a alteração local da habilitação manual/ }).check();
  await expect(producao.getByRole("button", { name: "Habilitar emissão manual" })).toBeEnabled();
  await expect(page.getByText(/CSC de homologação ausente/)).toBeVisible();
  const fonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(f => (0, eval)(`(${f})(document)`), fonte);
  expect(auditoria.problemas).toEqual([]);
  await mkdir(evidencia, { recursive: true });
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}.png`), fullPage: true });
  await writeFile(resolve(evidencia, `${info.project.name}.json`), JSON.stringify({ sintetico: true, auditoria, largura: info.project.metadata.largura, tema: info.project.metadata.tema }));
  // Nenhuma habilitação externa ou nota é solicitada nesta prévia.
  await modelos.press("Enter"); await modelos.press("Escape"); await expect(modelos).toBeFocused();
});
