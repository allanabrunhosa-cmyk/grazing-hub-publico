import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function capturar(page: Page, info: TestInfo, nome: string) {
  const fonte = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate<{ problemas: unknown[] }, string>(f => (0, eval)("(" + f + ")(document)"), fonte);
  await info.attach("auditoria-" + nome, { body: JSON.stringify(auditoria), contentType: "application/json" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath(nome + ".png"), fullPage: false });
  expect(auditoria.problemas).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4258" ? rota.continue() : rota.abort());
});
test("PDF e XML usam a mesma cor e nota autorizada não oferece emissão duplicada", async ({ page }, info) => {
  await page.goto("/pedido-detalhe.html?fiscal=autorizada&tema=" + info.project.metadata.tema);
  const acoes = page.getByRole("group", { name: "Ações da nota fiscal", exact: true });
  const xml = acoes.getByRole("link", { name: "Baixar XML", exact: true });
  const pdf = acoes.getByRole("link", { name: "Abrir PDF", exact: true });
  await acoes.scrollIntoViewIfNeeded();
  await expect(pdf).toHaveClass((await xml.getAttribute("class"))!);
  await expect(pdf).toHaveClass(/border-success/);
  await expect(pdf).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("button", { name: /^Emitir NF/ })).toHaveCount(0);
  await capturar(page, info, "pedido-autorizado");
});
test("arquivo ausente preserva sucesso e permite tentar a obtenção novamente", async ({ page }, info) => {
  await page.goto("/pedido-detalhe.html?fiscal=sem-xml&tema=" + info.project.metadata.tema);
  await expect(page.getByText("Nota fiscal emitida com sucesso.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar XML", exact: true })).toHaveCount(0);
  await expect(page.getByText(/O XML da nota autorizada ainda não está disponível/)).toBeVisible();
  const obter = page.getByRole("button", { name: "Obter documentos", exact: true });
  await obter.scrollIntoViewIfNeeded(); await obter.click();
  await expect(page.getByRole("alert")).toContainText("A prévia de testes não obtém arquivos externos.");
  await expect(obter).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Emitir NF/ })).toHaveCount(0);
  await capturar(page, info, "pedido-arquivo-pendente");
});
