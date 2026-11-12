import { expect, test } from "@playwright/test";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";

test("código curto permanece legível na lista, no editor e na ficha técnica", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4277" ? rota.continue() : rota.abort());
  await page.goto("/vendas.html?codigos=1");
  await page.evaluate(tema => { document.documentElement.classList.toggle("dark", tema === "escuro"); localStorage.setItem("theme", tema === "escuro" ? "dark" : "light"); }, info.project.metadata.tema);
  await page.getByRole("textbox", { name: "Buscar produtos", exact: true }).fill("p0100001");
  await expect(page.getByText("P0100001", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("lista.png"), fullPage: true });

  await page.getByRole("button", { name: "Editar Tábua Grazing para 1", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Editar produto", exact: true });
  const codigo = editor.getByRole("textbox", { name: "Código do produto", exact: true });
  await expect(codigo).toHaveValue("P0100001");
  await expect(codigo).toHaveAttribute("readonly", "");
  await expect(codigo).toHaveAttribute("maxlength", "8");
  await editor.getByRole("button", { name: "Preço", exact: true }).click();
  await expect(editor.getByText("P0100001", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Identificação", exact: true }).click();
  expect(await editor.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("editor.png"), fullPage: true });
  await info.attach("auditoria-interface", { body: JSON.stringify(await page.evaluate(`(${auditarInterface.toString()})(document)`)), contentType: "application/json" });

  await editor.getByRole("button", { name: "Imprimir ficha técnica", exact: true }).click();
  const ficha = page.getByRole("dialog", { name: "Ficha técnica · P0100001 · Tábua Grazing para 1", exact: true });
  await expect(ficha).toBeVisible();
  await expect(ficha.frameLocator("iframe").getByText(/^Código P0100001/)).toBeVisible();
  expect(await ficha.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("ficha.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(codigo).toHaveValue("P0100001");
});
