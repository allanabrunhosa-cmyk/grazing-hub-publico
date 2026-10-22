import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const evidencia = resolve(__dirname, "../../.tmp/fiscal-unificado/visual");
async function abrir(page: Page, info: TestInfo, rota: string, extra = "") {
  await page.route("**/*", r => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await page.goto(`/fiscal-unificado.html?rota=${encodeURIComponent(rota)}${info.project.metadata.tema === "escuro" ? "&escuro" : ""}${extra}`);
  await page.evaluate(() => document.fonts.ready);
}
async function capturar(page: Page, info: TestInfo, nome: string) {
  const fonte = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(f => (0, eval)(`(${f})(document)`), fonte);
  expect(auditoria.problemas).toEqual([]);
  await mkdir(evidencia, { recursive: true });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo({ top: 0, behavior: "auto" }); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.waitForTimeout(250); await page.screenshot({ path: resolve(evidencia, `${nome}-${info.project.name}.png`), fullPage: true });
}
test("produto: conserva a grade de campos oficiais e um único Salvar", async ({ page }, info) => {
  await abrir(page, info, "/vendas/produtos"); await expect(page.getByRole("combobox", { name: "NCM", exact: true })).toBeVisible();
  await expect(page.getByText("Salvar rascunho", { exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "Salvar", exact: true })).toHaveCount(1);
  await capturar(page, info, "produto");
});
test("grupos: cartões e editor compacto sem NCM", async ({ page }, info) => {
  await abrir(page, info, "/financeiro/fiscal/grupos"); await page.getByRole("button", { name: "Editar Preparações" }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await expect(page.getByRole("combobox", { name: "NCM", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Origem ICMS", exact: true })).toBeVisible(); await capturar(page, info, "grupos");
});
test("configurações: somente os quatro blocos principais", async ({ page }, info) => {
  await abrir(page, info, "/financeiro/fiscal/configuracoes"); await expect(page.getByText("Configurações fiscais", { exact: true })).toBeVisible();
  await expect(page.locator("main section[id]")).toHaveCount(4); await expect(page.getByText("Pré-requisitos de homologação", { exact: true })).toBeHidden();
  await capturar(page, info, "configuracoes");
});
test("Salvar aplica NCM diretamente e mantém o valor no cadastro", async ({ page }, info) => {
  await abrir(page, info, "/vendas/produtos"); const ncm = page.getByRole("combobox", { name: "NCM", exact: true });
  await ncm.click(); await ncm.fill("19053100"); await page.getByRole("option", { name: /^19053100 ·/ }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(page.getByText("Dados fiscais salvos.")).toBeVisible();
  await expect(ncm).toHaveValue(/19053100/); await expect(page.getByText("Revisar impacto", { exact: true })).toHaveCount(0);
  await capturar(page, info, "aplicacao");
});
test("aba fiscal permanece independente do formulário comercial", async ({ page }, info) => {
  await abrir(page, info, "/vendas/produtos", "&editor"); const gatilho = page.getByRole("button", { name: "Editar produto de demonstração", exact: true }); await gatilho.click(); await page.getByRole("button", { name: "Fiscal", exact: true }).click();
  const ncm = page.getByRole("combobox", { name: "NCM", exact: true }); await expect(ncm).toBeVisible(); expect(await ncm.evaluate(el => el.closest("form") === null)).toBe(true);
  await page.getByRole("button", { name: "Fechar", exact: true }).click(); await expect(gatilho).toBeFocused();
});
test("vínculos mantém a tabela anterior e kit não recebe NCM fictício", async ({ page }, info) => {
  await abrir(page, info, "/financeiro/fiscal/vinculos"); await expect(page.getByRole("table")).toBeVisible(); await expect(page.getByRole("columnheader", { name: "NCM", exact: true })).toBeVisible(); await capturar(page, info, "vinculos");
  await abrir(page, info, "/vendas/produtos", "&kit"); await expect(page.getByText(/O kit utiliza os dados fiscais/)).toBeVisible(); await expect(page.getByRole("combobox", { name: "NCM", exact: true })).toHaveCount(0); await capturar(page, info, "kit");
});
