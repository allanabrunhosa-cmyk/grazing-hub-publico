import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";

const origem = "http://127.0.0.1:4389";
const diagnosticos = new WeakMap<Page, { erros: string[]; redesExternas: string[] }>();
test.beforeEach(async ({ page }) => {
  const estado = { erros: [] as string[], redesExternas: [] as string[] };
  diagnosticos.set(page, estado);
  page.on("pageerror", erro => estado.erros.push(erro.message));
  await page.clock.install({ time: new Date("2026-09-18T15:00:00.000Z") });
  await page.route("**/*", rota => {
    const url = new URL(rota.request().url());
    if (url.origin === origem) return rota.continue();
    estado.redesExternas.push(url.origin);
    return rota.abort();
  });
});
test.afterEach(async ({ page }, info) => {
  const diagnostico = diagnosticos.get(page)!;
  await info.attach("isolamento", { body: JSON.stringify(diagnostico), contentType: "application/json" });
  expect(diagnostico.erros).toEqual([]);
  expect(diagnostico.redesExternas).toEqual([]);
});
async function abrir(page: Page, info: TestInfo) {
  await page.goto(`/movimentacoes.html${info.project.metadata.tema === "escuro" ? "?escuro=1" : ""}`);
  await expect(page.getByRole("heading", { name: "Movimentações", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(info.project.metadata.toque);
}
async function capturar(page: Page, info: TestInfo, nome: string) {
  const auditoria = await page.evaluate<{ problemas: unknown[] }>(`(${auditarInterface.toString()})(document)`);
  await info.attach(`auditoria-${nome}`, { body: JSON.stringify(auditoria), contentType: "application/json" });
  expect(auditoria.problemas).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialogo = page.getByRole("dialog");
  if (await dialogo.count()) await dialogo.screenshot({ path: info.outputPath(`${nome}.png`), animations: "disabled" });
  else await page.screenshot({ path: info.outputPath(`${nome}.png`), animations: "disabled" });
}
async function lerResumo(page: Page) {
  const titulos = ["Saldo anterior", "Entradas no período", "Saídas no período", "Saldo final projetado"];
  return Promise.all(titulos.map(titulo => page.getByText(titulo, { exact: true }).first().locator("..").innerText()));
}
test("busca por texto e valores preserva os totais e permite limpar o filtro", async ({ page }, info) => {
  await abrir(page, info);
  const resumo = await lerResumo(page);
  const busca = page.getByRole("textbox", { name: "Buscar movimentações", exact: true });
  const descricao = "Compra de embalagens personalizadas para entregas e eventos corporativos";
  for (const termo of ["123.456,78", "123456,78", "123456.78", "embalagens"]) {
    await busca.fill(termo);
    await expect(page.getByRole("row", { name: `Ver detalhes: ${descricao}`, exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: "Ver detalhes: Aluguel da cozinha", exact: true })).toHaveCount(0);
    expect(await lerResumo(page)).toEqual(resumo);
  }
  await capturar(page, info, "busca-com-valor");
  await busca.fill("busca-sem-correspondencia-ficticia");
  await expect(page.getByRole("row", { name: /^Ver detalhes:/ })).toHaveCount(0);
  expect(await lerResumo(page)).toEqual(resumo);
  await capturar(page, info, "busca-sem-resultados");
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(busca).toHaveValue("");
  await expect(page.getByRole("row", { name: "Ver detalhes: Aluguel da cozinha", exact: true })).toBeVisible();
});
test("salvar edição de despesa conserva o botão verde oficial", async ({ page }, info) => {
  await abrir(page, info);
  await page.getByRole("row", { name: "Ver detalhes: Aluguel da cozinha", exact: true }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const salvar = page.getByRole("button", { name: "Salvar alterações", exact: true });
  await expect(salvar).toBeVisible();
  await expect(salvar).toHaveClass(/(?:^|\s)bg-success(?:\s|$)/);
  await expect(salvar).not.toHaveClass(/(?:^|\s)bg-destructive(?:\s|$)/);
  await salvar.scrollIntoViewIfNeeded();
  await capturar(page, info, "salvar-alteracoes-verde");
});
