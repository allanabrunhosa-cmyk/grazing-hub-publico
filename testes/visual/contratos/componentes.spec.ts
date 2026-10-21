import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

let erros: string[] = [];
let externos: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = []; externos = [];
  page.on("pageerror", erro => erros.push(erro.message));
  await page.route("**/*", async rota => {
    const url = new URL(rota.request().url());
    if (["data:", "blob:"].includes(url.protocol) || url.origin === "http://127.0.0.1:4238") return rota.continue();
    externos.push(url.origin);
    await rota.abort();
  });
});
test.afterEach(async ({}, info) => {
  if (erros.length || externos.length) await info.attach("isolamento", { body: JSON.stringify({ erros, externos }), contentType: "application/json" });
  expect(erros, "A fixture não deve produzir erros de página").toEqual([]);
  expect(externos, "A fixture deve usar somente recursos locais").toEqual([]);
});

async function abrir(page: Page, info: TestInfo, caso = "normal") {
  const tema = String(info.project.metadata.tema);
  await page.goto(`/qualidade.html?caso=${caso}&tema=${tema}`);
  await page.waitForFunction(() => window.grazingQualidade?.pronta === true);
  await expect(page.locator("html")).toHaveClass(tema === "escuro" ? /\bdark\b/ : /\blight\b/);
}
async function cor(alvo: Locator, propriedade = "backgroundColor") {
  return alvo.evaluate((elemento, nome) => getComputedStyle(elemento).getPropertyValue(nome.replace(/[A-Z]/g, letra => `-${letra.toLowerCase()}`)), propriedade);
}

for (const caso of ["normal", "longo", "salvando", "erro", "vazio"]) {
  test(`auditoria renderizada sem desvios: ${caso}`, async ({ page }, info) => {
    await abrir(page, info, caso);
    const diagnostico = await page.evaluate(() => window.grazingQualidade!.auditar());
    await info.attach(`auditoria-${caso}`, { body: JSON.stringify(diagnostico, null, 2), contentType: "application/json" });
    expect(diagnostico.verificacoes.ponteiroGrosso).toBe(info.project.metadata.toque);
    expect(diagnostico.verificacoes.botoesVisiveis).toBeGreaterThan(0);
    expect(diagnostico.verificacoes.camposVisiveis).toBeGreaterThan(0);
    expect(diagnostico.problemas).toEqual([]);
    if (caso === "salvando") {
      await expect(page.getByTestId("confirmacao-positiva")).toBeDisabled();
      await expect(page.getByTestId("campo-nome")).toBeDisabled();
    }
    if (caso === "erro") await expect(page.getByTestId("campo-nome")).toHaveAttribute("aria-invalid", "true");
    if (caso === "vazio") await expect(page.getByTestId("tabela").getByRole("status")).toHaveText("Nenhum item encontrado nesta amostra.");
  });
}

test("controles usam alturas e ações compactas usam tokens/toque", async ({ page }, info) => {
  await abrir(page, info);
  const dimensoes = await page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    const px = (valor: string) => valor.trim().endsWith("rem") ? parseFloat(valor) * parseFloat(raiz.fontSize) : parseFloat(valor);
    const caixa = (id: string) => {
      const elemento = document.querySelector(`[data-testid="${id}"]`)!;
      const retangulo = elemento.getBoundingClientRect();
      return { width: retangulo.width, height: retangulo.height, centro: retangulo.y + retangulo.height / 2, y: retangulo.y, raio: getComputedStyle(elemento).borderRadius };
    };
    const grade = document.querySelector('[data-testid="linha-controles"]')!;
    return { colunas: getComputedStyle(grade).gridTemplateColumns.trim().split(/\s+/).length, altura: px(raiz.getPropertyValue("--ds-controle-altura")), acao: px(raiz.getPropertyValue("--ds-acao-tamanho")), raio: raiz.getPropertyValue("--ds-botao-raio").trim(), nome: caixa("campo-nome"), local: caixa("campo-local"), botao: caixa("botao-linha"), editar: caixa("editar-item"), remover: caixa("remover-item") };
  });
  for (const controle of [dimensoes.nome, dimensoes.local, dimensoes.botao]) expect(Math.abs(controle.height - dimensoes.altura)).toBeLessThanOrEqual(1);
  const linha = [dimensoes.nome, dimensoes.local, dimensoes.botao];
  for (let i = 0; i < linha.length - 1; i++) {
    if (Math.floor(i / dimensoes.colunas) === Math.floor((i + 1) / dimensoes.colunas)) expect(Math.abs(linha[i].centro - linha[i + 1].centro)).toBeLessThanOrEqual(2);
  }
  const alvo = info.project.metadata.toque ? Math.max(44, dimensoes.acao) : dimensoes.acao;
  for (const controle of [dimensoes.editar, dimensoes.remover]) {
    expect(Math.abs(controle.width - alvo)).toBeLessThanOrEqual(1);
    expect(Math.abs(controle.height - alvo)).toBeLessThanOrEqual(1);
    expect(controle.raio).toBe(dimensoes.raio);
  }
});

test("variantes reais preservam cores semânticas e Link tem nome", async ({ page }, info) => {
  await abrir(page, info);
  await page.mouse.move(0, 0);
  expect(await cor(page.getByTestId("confirmacao-positiva"))).toBe(await cor(page.getByTestId("token-success")));
  expect(await cor(page.getByTestId("cancelamento-operacional"))).toBe(await cor(page.getByTestId("token-destructive")));
  expect(await cor(page.getByTestId("salvar-orcamento"))).toBe(await cor(page.getByTestId("token-salvar")));
  const cancelar = page.getByTestId("cancelar-edicao");
  await expect(cancelar).toHaveAccessibleName("Cancelar edição");
  for (const propriedade of ["backgroundColor", "color", "borderColor"]) {
    expect(await cor(cancelar, propriedade)).toBe(await cor(page.getByTestId("token-neutro"), propriedade));
  }
  const link = page.getByTestId("link-icone");
  await expect(link).toHaveAttribute("href", "#tabela");
  await expect(link).toHaveAccessibleName("Ver detalhes da amostra");
  expect(await link.evaluate(elemento => elemento.tagName)).toBe("A");
  if (!info.project.metadata.toque) {
    await cancelar.hover();
    await expect.poll(() => cor(cancelar)).toBe(await cor(page.getByTestId("token-hover-neutro")));
    await page.getByTestId("remover-item").hover();
    await expect.poll(() => cor(page.getByTestId("remover-item"), "color")).toBe(await cor(page.getByTestId("token-destructive")));
  }
});

test("tabela larga rola dentro do contêiner e mantém o documento contido", async ({ page }, info) => {
  await abrir(page, info, "longo");
  const tabela = page.getByTestId("tabela").locator('[data-slot="table-container"]');
  const medidas = await tabela.evaluate(elemento => ({ largura: elemento.clientWidth, conteudo: elemento.scrollWidth, overflow: getComputedStyle(elemento).overflowX }));
  expect(["auto", "scroll"]).toContain(medidas.overflow);
  if (Number(info.project.metadata.largura) < 1440) {
    expect(medidas.conteudo).toBeGreaterThan(medidas.largura);
    await tabela.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => tabela.evaluate(elemento => elemento.scrollLeft)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test("lateral real está contida ou oculta no ponto de quebra vigente", async ({ page }, info) => {
  await abrir(page, info);
  const lateral = page.getByTestId("lateral");
  if (Number(info.project.metadata.largura) < 768) await expect(lateral).toBeHidden();
  else {
    await expect(lateral).toBeVisible();
    await expect(lateral.getByRole("navigation")).toBeVisible();
    const retangulo = await lateral.boundingBox();
    expect(retangulo!.x).toBeGreaterThanOrEqual(0);
    expect(retangulo!.x + retangulo!.width).toBeLessThanOrEqual(Number(info.project.metadata.largura));
  }
});
