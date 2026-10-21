import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { consultarTabelaFiscal } from "../../src/lib/fiscal/catalogos/consulta";
import type { ConsultaTabelaFiscal } from "../../src/lib/fiscal/catalogos/tipos";

test("repasse FCI mostra prova do fornecedor nos dois modelos e permite revisão explícita", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4461" ? rota.continue() : rota.abort());
  await page.route("**/api/fiscal/tabelas?*", async rota => {
    const p = new URL(rota.request().url()).searchParams;
    await rota.fulfill({ json: consultarTabelaFiscal({ tabela: p.get("tabela") as ConsultaTabelaFiscal["tabela"], selecionado: p.get("selecionado") ?? "", dia: "2026-10-21" }) });
  });
  await page.addInitScript(tema => localStorage.setItem("theme", tema === "escuro" ? "dark" : "light"), String(info.project.metadata.tema));
  await page.goto("/estrutura-fiscal.html?declaracao=fornecedor");
  await page.getByRole("button", { name: "Conferir classificação sintética", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Classificação do produto", exact: true });
  const prova = dialogo.getByRole("region", { name: "FCI recebida do fornecedor" });
  await prova.evaluate(el => el.scrollIntoView({ block: "center" })); await expect(prova).toBeVisible();
  await expect(prova.getByText("NF-e 55 e NFC-e 65", { exact: true })).toBeVisible();
  await expect(prova.getByText("ABCDEF12-3456-7890-ABCD-1234567890AB", { exact: true })).toBeVisible();
  await expect(prova.getByRole("textbox")).toHaveCount(0);
  expect(await prova.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const pasta = resolve(__dirname, "../../.tmp/sem-gtin-modelos-20261021/fci-visual"); await mkdir(pasta, { recursive: true });
  await page.screenshot({ path: resolve(pasta, `${info.project.name}.png`) });
  await prova.getByRole("button", { name: "Revisar decisão de FCI", exact: true }).click();
  await expect(prova).toHaveCount(0);
  await expect(dialogo.getByText("Avançado: Conteúdo de Importação e FCI", { exact: true })).toBeVisible();
});
