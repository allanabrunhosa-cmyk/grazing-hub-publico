import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const evidencia = resolve(__dirname, "../../.tmp/fiscal-unificado/visual");
for (const [nome, rota, titulo] of [["produto", "/financeiro/fiscal/vinculos", "Configuração fiscal do produto"], ["grupos", "/financeiro/fiscal/grupos", "Regras fiscais existentes"], ["configuracoes", "/financeiro/fiscal/configuracoes", "Configurações fiscais"]]) {
  test(`${nome}: renderização e auditoria isoladas`, async ({ page }, info) => {
    const erros: string[] = []; page.on("pageerror", e => erros.push(e.message));
    await page.route("**/*", r => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
    await page.goto(`/fiscal-unificado.html?rota=${encodeURIComponent(rota)}${info.project.metadata.tema === "escuro" ? "&escuro" : ""}`);
    await expect(page.getByText(titulo, { exact: true })).toBeVisible();
    if (nome === "produto") {
      await page.getByRole("button", { name: "Voltar aos produtos" }).click();
      await expect(page.getByLabel("Buscar produto fiscal")).toBeFocused();
      await page.getByRole("button", { name: /^Abrir Fiscal de/ }).click();
      await expect(page.getByRole("region", { name: "Ficha fiscal selecionada" })).toBeFocused();
      await expect(page.getByText(titulo, { exact: true })).toBeVisible();
      await expect.poll(async () => (await page.getByRole("region", { name: "Ficha fiscal selecionada" }).boundingBox())?.y ?? 1000).toBeLessThan(250);
    }
    await page.evaluate(() => document.fonts.ready);
    const fonte = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
    const auditoria = await page.evaluate(f => (0, eval)(`(${f})(document)`), fonte);
    expect(auditoria.problemas).toEqual([]); expect(erros).toEqual([]);
    await mkdir(evidencia, { recursive: true });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo({ top: 0, behavior: "auto" }); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    await page.waitForTimeout(350);
    await page.screenshot({ path: resolve(evidencia, `${nome}-${info.project.name}.png`), fullPage: true });
    await writeFile(resolve(evidencia, `${nome}-${info.project.name}.json`), JSON.stringify({ sintetico: true, auditoria, erros }));
  });
}
test("rascunho, campos condicionais e revisão ficam na própria ficha", async ({ page }, info) => {
  await page.goto(`/fiscal-unificado.html?rota=/vendas/produtos${info.project.metadata.tema === "escuro" ? "&escuro" : ""}`);
  await page.getByRole("button", { name: "Editar classificação e grupo" }).click();
  await expect(page.getByRole("combobox", { name: "NCM individual", exact: true })).toBeVisible();
  const ncm = page.getByRole("combobox", { name: "NCM individual", exact: true });
  await ncm.click();
  await ncm.fill("19053100");
  await page.getByRole("option", { name: /^19053100 ·/ }).click();
  await expect(page.getByRole("combobox", { name: "CEST, quando aplicável" })).toBeHidden();
  await page.getByText("Fundamento e referências", { exact: true }).click();
  await page.getByRole("textbox", { name: "Motivo da alteração" }).fill("Revisão exclusivamente sintética sem transmissão externa.");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.getByRole("button", { name: "Revisar impacto" }).click();
  await expect(page.getByRole("region", { name: "Revisão de impacto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aplicar configuração" })).toBeEnabled();
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo({ top: 0, behavior: "auto" }); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(evidencia, `revisao-${info.project.name}.png`), fullPage: true });
  expect(page.url()).toContain("/fiscal-unificado.html");
  await page.getByRole("button", { name: "Aplicar configuração" }).click();
  await expect(page.getByText("19053100", { exact: true })).toBeVisible();
  await expect(page.getByText(/NCM 19053100 · CFOP 5101/)).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo({ top: 0, behavior: "auto" }); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(evidencia, `aplicacao-${info.project.name}.png`), fullPage: true });
});

test("editor mantém ações fiscais fora do formulário comercial e restaura o foco", async ({ page }, info) => {
  await page.goto(`/fiscal-unificado.html?rota=/vendas/produtos&editor${info.project.metadata.tema === "escuro" ? "&escuro" : ""}`);
  const abrir = page.getByRole("button", { name: "Editar produto de demonstração", exact: true });
  await abrir.click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Fiscal", exact: true }).click();
  await expect(dialogo.getByText("Configuração fiscal do produto", { exact: true })).toBeVisible();
  await expect(dialogo.getByRole("button", { name: "Salvar", exact: true })).toBeHidden();
  await dialogo.getByRole("button", { name: "Editar classificação e grupo" }).click();
  const ncm = dialogo.getByRole("combobox", { name: "NCM individual", exact: true });
  await expect(ncm).toBeVisible();
  expect(await ncm.evaluate(el => el.closest("form") === null)).toBe(true);
  await page.screenshot({ path: resolve(evidencia, `editor-${info.project.name}.png`), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(abrir).toBeFocused();
});

test("kit conserva dados por componente sem exigir campos fiscais do pai", async ({ page }, info) => {
  await page.goto(`/fiscal-unificado.html?kit${info.project.metadata.tema === "escuro" ? "&escuro" : ""}`);
  await expect(page.getByText(/NCM 19059090.*CFOP 5101/)).toBeVisible();
  await expect(page.getByText(/NCM 08061000.*CFOP 5102/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Personalizar esta operação" })).toBeHidden();
  await page.screenshot({ path: resolve(evidencia, `kit-${info.project.name}.png`), fullPage: true });
  await page.getByRole("button", { name: "Editar classificação e grupo" }).click();
  await expect(page.getByRole("combobox", { name: "NCM individual", exact: true })).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Confirmação do GTIN" })).toBeHidden();
});
