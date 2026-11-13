import { expect, test } from "@playwright/test";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";

test("entrada avulsa mostra fornecedor e produtos nas correspondências da fatura", async ({ page }, info) => {
  const erros: string[] = [], externas: string[] = [];
  page.on("pageerror", erro => erros.push(erro.message));
  await page.route("**/*", rota => {
    const origem = new URL(rota.request().url()).origin;
    if (origem === "http://127.0.0.1:4235") return rota.continue();
    externas.push(origem); return rota.abort();
  });
  await page.goto(`/faturas.html?entrada-avulsa=1${info.project.metadata.tema === "escuro" ? "&escuro=1" : ""}`, { waitUntil: "domcontentloaded" });
  const titulo = "FORNECEDOR FICTÍCIO — QUEIJO, PRESUNTO, EMBALAGEM PARA CESTAS DE CAFÉ DA MANHÃ E EVENTOS CORPORATIVOS";
  const selecionar = page.getByRole("checkbox", { name: `Vincular ${titulo}`, exact: true });
  await expect(page.getByText(titulo, { exact: true })).toBeVisible();
  await expect(page.getByText(/COMPRA SEM NOTA/i)).toHaveCount(0);
  await expect(selecionar).toBeEnabled();
  await selecionar.focus();
  await page.keyboard.press("Space");
  await expect(selecionar).toBeChecked();
  await page.keyboard.press("Space");
  await expect(selecionar).not.toBeChecked();
  await page.getByRole("searchbox", { name: "Buscar lançamento do HUB" }).fill("PRESUNTO");
  await expect(selecionar).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const auditoria = await page.evaluate<{ problemas: unknown[] }>(`(${auditarInterface.toString()})(document)`);
  await info.attach("auditoria-titulo", { body: JSON.stringify(auditoria), contentType: "application/json" });
  expect(auditoria.problemas).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await selecionar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("titulo-entrada-avulsa.png"), animations: "disabled" });
  expect(erros).toEqual([]); expect(externas).toEqual([]);
});
