import { expect, test } from "@playwright/test";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";
test.beforeEach(async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4269" ? rota.continue() : rota.abort());
  await page.goto("/vendas.html?secao=catalogo&cardapio=1&rota=/vendas/catalogo");
  await page.evaluate(tema => { document.documentElement.classList.toggle("dark", tema === "escuro"); localStorage.setItem("theme", tema === "escuro" ? "dark" : "light"); }, info.project.metadata.tema);
  await page.getByRole("button", { name: "Editar Porção de queijo brie", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
});
test("categoria em tag e disponibilidade preservam o cadastro ao trocar abas", async ({ page }, info) => {
  await expect(page.getByRole("combobox", { name: /Classificação dos/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("lista.png"), fullPage: true });
  const auditoria = await page.evaluate(`(${auditarInterface.toString()})(document)`);
  await info.attach("auditoria-interface", { body: JSON.stringify(auditoria), contentType: "application/json" });
  await page.getByRole("button", { name: "Editar Porção de queijo brie", exact: true }).click();
  await page.getByRole("tab", { name: "Disponibilidade", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Monte sua Tábua de Frios Grazing para 1", { exact: true })).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("disponibilidade.png"), fullPage: true });
  await page.getByRole("tab", { name: "Cadastro", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nome do complemento *" })).toHaveValue("Porção de queijo brie");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("grupo seleciona Produto e mantém a disponibilidade e categorias próprias", async ({ page }, info) => {
  await page.getByRole("tab", { name: "Grupos de complementos", exact: true }).click();
  await page.getByRole("button", { name: "Editar Queijos da montagem", exact: true }).click();
  await page.getByRole("combobox", { name: "Produtos e complementos do grupo" }).click();
  await expect(page.getByRole("option", { name: "Tábua Grazing para 1", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Monte sua Tábua de Frios Grazing para 1", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Tábua Grazing para 1", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "Nome da opção 2" })).toHaveValue("Tábua Grazing para 1");
  await page.screenshot({ path: info.outputPath("grupo.png"), fullPage: true });
  await page.getByRole("tab", { name: "Disponibilidade", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Monte sua Tábua de Frios Grazing para 1", { exact: true })).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
});
