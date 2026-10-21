import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { inspecionarGeometria } from "../../../scripts/inspecionar-geometria.mjs";

async function abrir(page: Page, info: TestInfo, caso: string) {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4238" ? rota.continue() : rota.abort());
  await page.goto(`/qualidade.html?caso=${caso}&tema=${info.project.metadata.tema}`);
  await page.waitForFunction(() => window.grazingQualidade?.pronta === true);
}
for (const caso of ["normal", "longo", "salvando", "erro", "vazio"]) {
  test(`controles sem cortes ou sobreposição: ${caso}`, async ({ page }, info) => {
    await abrir(page, info, caso);
    const medidas = await page.evaluate(inspecionarGeometria, '[data-testid="controles"], [data-testid="formulario"]');
    await info.attach("geometria", { body: JSON.stringify(medidas, null, 2), contentType: "application/json" });
    expect(medidas.controles).toBeGreaterThan(0);
    expect(medidas.problemas).toEqual([]);
  });
}
test("diálogo aberto não corta nem sobrepõe seus controles", async ({ page }, info) => {
  await abrir(page, info, "normal");
  await page.getByTestId("abrir-dialogo").click();
  await expect(page.getByTestId("dialogo-painel")).toBeVisible();
  const medidas = await page.evaluate(inspecionarGeometria, '[data-testid="dialogo-painel"]');
  await info.attach("geometria-modal", { body: JSON.stringify(medidas, null, 2), contentType: "application/json" });
  expect(medidas.problemas).toEqual([]);
});
test("uma regressão sintética de corte e sobreposição é detectada", async ({ page }, info) => {
  await abrir(page, info, "normal");
  // Apenas nesta página fictícia do teste; nunca altera CSS/componentes do produto.
  await page.addStyleTag({ content: '[data-testid="linha-controles"] {position:relative;height:100px;overflow:hidden} [data-testid="campo-nome"], [data-testid="campo-local"] {position:absolute;left:-10px;top:10px;width:160px}' });
  const medidas = await page.evaluate(inspecionarGeometria, '[data-testid="formulario"]');
  expect(medidas.problemas.some(p => p.regra === "controle-cortado")).toBe(true);
  expect(medidas.problemas.some(p => p.regra === "controles-sobrepostos")).toBe(true);
  expect(medidas.problemas.some(p => p.regra === "controle-fora-da-grade")).toBe(true);
});
