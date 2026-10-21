import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { consultarTabelaFiscal } from "../../src/lib/fiscal/catalogos/consulta";
import type { ConsultaTabelaFiscal } from "../../src/lib/fiscal/catalogos/tipos";

const raiz = resolve(__dirname, "../..");
const saida = resolve(raiz, ".tmp/sem-gtin-modelos-20261021/visual");

test("origem definida conserva SEM GTIN e impede o atalho antigo; origem indefinida conserva o fluxo", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4461" ? rota.continue() : rota.abort());
  await page.route("**/api/fiscal/tabelas?*", async rota => {
    const p = new URL(rota.request().url()).searchParams;
    await rota.fulfill({ json: consultarTabelaFiscal({ tabela: p.get("tabela") as ConsultaTabelaFiscal["tabela"], selecionado: p.get("selecionado") ?? "", dia: "2026-10-21" }) });
  });
  await page.addInitScript(tema => localStorage.setItem("theme", tema === "escuro" ? "dark" : "light"), String(info.project.metadata.tema));
  await page.goto("/estrutura-fiscal.html?declaracao=nacional");
  const abrir = page.getByRole("button", { name: "Conferir classificação sintética", exact: true });
  await abrir.click();
  const dialogo = page.getByRole("dialog", { name: "Classificação do produto", exact: true });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole("combobox", { name: "Origem fiscal", exact: true })).toHaveValue(/^0 · Nacional/);
  await expect(dialogo.getByRole("combobox", { name: "Confirmação do GTIN", exact: true })).toContainText("Sem GTIN comprovado");
  await expect(dialogo.getByRole("button", { name: "Registrar declaração do responsável", exact: true })).toHaveCount(0);
  await expect(dialogo.getByText("Declaração já informada pelo responsável", { exact: true })).toHaveCount(0);
  await mkdir(saida, { recursive: true });
  await page.screenshot({ path: resolve(saida, `${info.project.name}.png`) });
  const fonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(f => (0, eval)(`(${f})(document)`), fonte);
  await writeFile(resolve(saida, `${info.project.name}.json`), JSON.stringify({ sintetico: true, auditoria }, null, 2));
  expect(auditoria.problemas).toEqual([]);
  await dialogo.getByRole("button", { name: "Fechar", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => dialogo.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(abrir).toBeFocused();
  await abrir.press("Enter");
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  await page.goto("/estrutura-fiscal.html?declaracao=sem-origem");
  await abrir.click();
  await expect(page.getByRole("button", { name: "Registrar declaração do responsável", exact: true })).toBeVisible();
});
