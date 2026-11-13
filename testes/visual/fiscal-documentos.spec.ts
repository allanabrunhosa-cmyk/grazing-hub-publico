import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function capturar(page: Page, info: TestInfo, nome: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const fonte = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate<{ problemas: unknown[] }, string>(f => (0, eval)("(" + f + ")(document)"), fonte);
  await info.attach("auditoria-" + nome, { body: JSON.stringify(auditoria), contentType: "application/json" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath(nome + ".png"), fullPage: false, animations: "disabled" });
  expect(auditoria.problemas).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-13T15:00:00Z"));
  await page.route("**/*", async rota => {
    const url = new URL(rota.request().url());
    if (url.origin !== "http://127.0.0.1:4448") return rota.abort();
    if (url.pathname.startsWith("/api/")) return rota.fulfill({ status: 200, headers: { "Content-Type": "application/xml", "Content-Disposition": 'attachment; filename="nota-sintetica.xml"' }, body: "<nota>Arquivo exclusivamente sintetico</nota>" });
    return rota.continue();
  });
});
const tema = (info: TestInfo) => info.project.metadata.tema === "escuro" ? "&escuro" : "";

test("lista oferece PDF e XML local no painel existente, com teclado e retorno de foco", async ({ page }, info) => {
  await page.goto("/fiscal-dashboard.html?mes=2026-10" + tema(info));
  await page.getByRole("tab", { name: /NF saída/ }).click();
  const abrir = page.getByRole("button", { name: "Abrir e baixar nota 1042", exact: true });
  await abrir.scrollIntoViewIfNeeded();
  await capturar(page, info, "lista");
  await abrir.focus(); await page.keyboard.press("Enter");
  const painel = page.getByRole("dialog", { name: "Detalhes da nota" });
  const pdf = painel.getByRole("link", { name: "Abrir PDF", exact: true });
  await expect(pdf).toHaveAttribute("href", "/api/fiscal-saida/ficticio-0/arquivo?tipo=pdf&visualizar=1");
  await expect(pdf).toHaveAttribute("target", "_blank");
  await expect(painel.getByRole("link", { name: "Baixar PDF", exact: true })).toHaveAttribute("href", "/api/fiscal-saida/ficticio-0/arquivo?tipo=pdf");
  const xml = painel.getByRole("link", { name: "Baixar XML", exact: true });
  const baixou = page.waitForEvent("download");
  await xml.click();
  expect((await baixou).suggestedFilename()).toBe("nota-sintetica.xml");
  await capturar(page, info, "arquivos");
  await xml.press("Escape");
  await expect(painel).toHaveCount(0);
  await expect(abrir).toBeFocused();
});

test("mês completo e mês anterior aplicam intervalos distintos", async ({ page }, info) => {
  await page.goto("/fiscal-dashboard.html?mes=2026-10" + tema(info));
  await page.getByRole("combobox", { name: "Filtro", exact: true }).click();
  await expect(page.getByRole("option", { name: "Mês fechado", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Mês completo", exact: true }).click();
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2026-11-01");
  await expect(page.getByLabel("até", { exact: true })).toHaveValue("2026-11-30");
  await page.getByRole("combobox", { name: "Filtro", exact: true }).click();
  await page.getByRole("option", { name: "Mês anterior", exact: true }).click();
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2026-10-01");
  await expect(page.getByLabel("até", { exact: true })).toHaveValue("2026-10-31");
  await capturar(page, info, "periodo");
});

test("XML ausente não apaga saídas comprovadas e recuperação admite nova tentativa", async ({ page }, info) => {
  await page.goto("/fiscal-dashboard.html?mes=2026-10&estado=sem-xml" + tema(info));
  await expect(page.getByRole("tab", { name: "NF saída (1)", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "NF saída (1)", exact: true }).click();
  await expect(page.getByRole("table", { name: "Últimos documentos fiscais" }).getByText("NF-e · 42", { exact: true })).toBeVisible();
  const recuperar = page.getByRole("button", { name: /Recuperar arquivos.*43/ });
  await recuperar.scrollIntoViewIfNeeded();
  await capturar(page, info, "xml-pendente");
  await recuperar.click();
  await expect(page.getByRole("alert")).toContainText("A nota continua autorizada.");
  await expect(recuperar).toBeEnabled();
  await capturar(page, info, "erro-recuperacao");
  await recuperar.click();
  await expect(page.getByRole("tab", { name: "NF saída (2)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Recuperar arquivos.*43/ })).toHaveCount(0);
  await page.getByRole("tab", { name: "NF saída (2)", exact: true }).click();
  await expect(page.getByRole("table", { name: "Últimos documentos fiscais" }).getByText("NF-e · 43", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Emitir/ })).toHaveCount(0);
  await capturar(page, info, "xml-recuperado");
});
