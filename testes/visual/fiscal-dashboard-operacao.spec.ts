import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const raiz = resolve(__dirname, "../..");
async function auditarECapturar(page: import("@playwright/test").Page, info: import("@playwright/test").TestInfo, nome: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const fonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(f => (0, eval)(`(${f})(document)`), fonte);
  const dir = resolve(raiz, ".tmp/fiscal-layout-20261016/visual");
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `${nome}-${info.project.name}.png`), fullPage: true, animations: "disabled" });
  await writeFile(resolve(dir, `${nome}-${info.project.name}.json`), JSON.stringify({ sintetico: true, consultasExternas: false, auditoria }, null, 2));
  expect(auditoria.problemas).toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", r => new URL(r.request().url()).origin === "http://127.0.0.1:4448" ? r.continue() : r.abort());
});
test("visão geral: cartões, documentos, período DRE e navegação", async ({ page }, info) => {
  await page.goto(`/fiscal-dashboard.html${info.project.metadata.tema === "escuro" ? "?escuro" : ""}`);
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  for (const nome of ["Serviços contratados", "Pendências fiscais", "Configuração fiscal vigente"]) await expect(page.getByText(nome, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Filtro de data" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Data de emissão" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir configurações" })).toHaveAttribute("href", /rota=%2Ffinanceiro%2Ffiscal%2Fconfiguracoes/);
  await auditarECapturar(page, info, "visao-geral");
  for (const [nome, cor] of [["Faturamento", "success"], ["Despesas", "warning"], ["Canceladas", "destructive"]]) {
    await expect(page.getByRole("heading", { name: nome, exact: true }).locator('xpath=ancestor::*[@data-slot="card"]')).toHaveClass(new RegExp(`border-${cor}/30`));
  }
  const olho = page.getByRole("button", { name: /Ver detalhes da nota/ }).first();
  await olho.click();
  const detalhe = page.getByRole("dialog", { name: "Detalhes da nota" });
  await expect(detalhe.getByText("Empresa sintética", { exact: true })).toBeVisible();
  await expect(detalhe.getByRole("table", { name: "Itens da nota" })).toBeVisible();
  await auditarECapturar(page, info, "detalhe-nota");
  await page.keyboard.press("Escape");
  await expect(detalhe).toHaveCount(0);
  await expect(olho).toBeFocused();
  await page.getByRole("button", { name: "Despesas", exact: true }).click();
  await expect(page.getByRole("table", { name: "Últimos documentos fiscais" }).getByText("NF saída", { exact: true })).toHaveCount(0);
  const aba = page.getByRole("tab", { name: /NFS entrada/ });
  await aba.focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("NFS-e · 908", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Últimos documentos fiscais" }).getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: "Canceladas", exact: true }).click();
  await expect(page.getByText("NF-e · 1001", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Canceladas", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("De", { exact: true }).fill("2026-09-01");
  await page.getByLabel("De", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/de=2026-09-01/);
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2026-09-01");
});
test("configurações: campos confirmados, edição explícita e certificado", async ({ page }, info) => {
  await page.goto(`/fiscal-numeracao.html${info.project.metadata.tema === "escuro" ? "?escuro" : ""}`);
  await expect(page.getByRole("heading", { name: "Configurações", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Série", exact: true })).toHaveValue("001");
  await expect(page.getByRole("textbox", { name: "Próximo número", exact: true })).toHaveValue("98765");
  await expect(page.getByRole("button", { name: "Salvar numeração" })).toBeDisabled();
  await expect(page.getByText("Vence em 07/11/2026 (22d)", { exact: true })).toBeVisible();
  await auditarECapturar(page, info, "configuracoes");
  const remover = page.getByRole("button", { name: "Remover certificado digital" });
  await remover.click();
  const dialogo = page.getByRole("dialog", { name: "Remover certificado digital?" });
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(remover).toBeFocused();
  await page.getByRole("button", { name: "Substituir" }).click();
  await expect(page.getByLabel("Arquivo do certificado (.pfx)")).toBeVisible();
  await expect(page.getByLabel("Senha do certificado", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Substituir" })).toBeVisible();
});
test("estados vazios, indisponíveis e sem permissão permanecem explícitos", async ({ page }, info) => {
  const tema = info.project.metadata.tema === "escuro" ? "&escuro" : "";
  await page.goto(`/fiscal-dashboard.html?estado=indisponivel${tema}`);
  await expect(page.getByText("Dados fiscais oficiais indisponíveis", { exact: true })).toHaveCount(4);
  await expect(page.getByRole("tab", { name: "Todos (—)", exact: true })).toBeVisible();
  await auditarECapturar(page, info, "indisponivel");
  await page.goto(`/fiscal-numeracao.html?estado=sem-permissao${tema}`);
  await expect(page.getByRole("button", { name: "Salvar numeração" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Substituir" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mostrar senha" })).toHaveCount(0);
  await page.goto(`/fiscal-numeracao.html?estado=vazio${tema}`);
  await expect(page.getByRole("textbox", { name: "Próximo número", exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Salvar numeração" })).toBeDisabled();
  await auditarECapturar(page, info, "configuracoes-vazio");
});
