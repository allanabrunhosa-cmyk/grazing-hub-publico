import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";

const origem = "http://127.0.0.1:4278";
const diagnosticos = new WeakMap<Page, { erros: string[]; redesExternas: string[] }>();
const motivo = "Equipamento devolvido e conferido com o fornecedor de exemplo.";

test.beforeEach(async ({ page }) => {
  const estado = { erros: [] as string[], redesExternas: [] as string[] };
  diagnosticos.set(page, estado);
  page.on("pageerror", erro => estado.erros.push(erro.message));
  await page.clock.install({ time: new Date("2026-11-04T15:00:00.000Z") });
  await page.route("**/*", rota => {
    const url = new URL(rota.request().url());
    if (url.origin === origem) return rota.continue();
    estado.redesExternas.push(url.origin);
    return rota.abort();
  });
});

test.afterEach(async ({ page }, info) => {
  const diagnostico = diagnosticos.get(page)!;
  await info.attach("isolamento-e-erros", { body: JSON.stringify(diagnostico), contentType: "application/json" });
  expect(diagnostico.erros).toEqual([]);
  expect(diagnostico.redesExternas).toEqual([]);
});

async function abrir(page: Page, info: TestInfo, consulta = "") {
  const parametros = new URLSearchParams(consulta);
  if (info.project.metadata.tema === "escuro") parametros.set("escuro", "1");
  await page.goto(`/manifestacao-nf.html?${parametros}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(info.project.metadata.toque);
}

async function capturar(page: Page, info: TestInfo, nome: string) {
  const auditoria = await page.evaluate(`(${auditarInterface.toString()})(document)`);
  await info.attach(`auditoria-${nome}`, { body: JSON.stringify(auditoria), contentType: "application/json" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const dialogo of await page.getByRole("dialog").all()) {
    const geometria = await dialogo.evaluate(elemento => ({ largura: elemento.clientWidth, conteudo: elemento.scrollWidth, caixa: elemento.getBoundingClientRect().toJSON() }));
    const transbordamentos = await dialogo.evaluate(elemento => [...elemento.querySelectorAll<HTMLElement>("*")]
      .filter(filho => filho.clientWidth > 0 && filho.scrollWidth > filho.clientWidth + 2)
      .map(filho => ({ tag: filho.tagName, classes: filho.className, largura: filho.clientWidth, conteudo: filho.scrollWidth }))
      .slice(0, 15));
    await info.attach(`geometria-${nome}`, { body: JSON.stringify({ geometria, transbordamentos }), contentType: "application/json" });
    expect(geometria.conteudo).toBeLessThanOrEqual(geometria.largura);
    expect(geometria.caixa.x).toBeGreaterThanOrEqual(0);
    expect(geometria.caixa.right).toBeLessThanOrEqual(Number(info.project.metadata.largura));
  }
  for (const painel of await page.locator('section[aria-label="Outras operações da nota"]').all()) {
    const limites = await painel.evaluate(elemento => {
      const caixa = elemento.getBoundingClientRect();
      return {
        esquerda: caixa.left, direita: caixa.right,
        botoes: [...elemento.querySelectorAll("button")].filter(botao => botao.getClientRects().length > 0).map(botao => {
          const posicao = botao.getBoundingClientRect();
          return { nome: botao.textContent?.trim(), esquerda: posicao.left, direita: posicao.right };
        }),
      };
    });
    await info.attach(`limites-acoes-${nome}`, { body: JSON.stringify(limites), contentType: "application/json" });
    for (const botao of limites.botoes) {
      expect(botao.esquerda, `${botao.nome} saiu pela esquerda do painel`).toBeGreaterThanOrEqual(limites.esquerda - 1);
      expect(botao.direita, `${botao.nome} saiu pela direita do painel`).toBeLessThanOrEqual(limites.direita + 1);
    }
  }
  await page.screenshot({ path: info.outputPath(`${nome}.png`), fullPage: true, animations: "disabled" });
}

async function abrirNfe(page: Page, fornecedor: string) {
  await page.getByRole("row").filter({ hasText: fornecedor }).getByRole("button", { name: "Ver nota", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nota fiscal", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Tratamento da nota", exact: true }).waitFor();
}

async function escolherOutrasOperacoes(page: Page) {
  const tratamento = page.getByRole("combobox", { name: "Tratamento da nota", exact: true });
  await tratamento.click();
  await page.getByRole("option", { name: "Outras operações", exact: true }).click();
  await expect(page.getByText("Parcelas (duplicatas)", { exact: true })).toHaveCount(0);
}

test("devolução realizada e nota ignorada saem das pendências sem perder histórico", async ({ page }, info) => {
  await abrir(page, info, "vazio=1");
  await capturar(page, info, "nfe-vazio");
  await abrir(page, info);
  await expect(page.getByRole("button", { name: "Pendentes (2)", exact: true })).toBeVisible();
  await abrirNfe(page, "Fornecedor fictício de equipamento");
  await escolherOutrasOperacoes(page);
  await page.getByRole("button", { name: "Registrar devolução/retorno", exact: true }).click();
  const data = page.getByLabel("Data da devolução", { exact: true });
  const confirmar = page.getByRole("button", { name: "Confirmar devolução/retorno", exact: true });
  await confirmar.click();
  await expect(page.getByRole("alert")).toHaveText(/motivo de 15 a 500 caracteres/);
  await expect(page.getByTestId("chamadas-simuladas")).toHaveText("[]");
  await data.fill("2026-11-05");
  await page.getByLabel("Motivo do tratamento (15 a 500 caracteres)", { exact: true }).fill(motivo);
  await confirmar.click();
  await expect(page.getByRole("alert")).toHaveText(/data de devolução não pode ser futura/);
  await expect(page.getByTestId("chamadas-simuladas")).toHaveText("[]");
  await capturar(page, info, "devolucao-data-invalida");
  await data.fill("2026-11-03");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await data.press("Tab");
  await expect(page.getByTestId("chamadas-simuladas")).toHaveText("[]");
  await expect(confirmar).toBeEnabled();
  await capturar(page, info, "devolucao-realizada");
  await confirmar.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pendentes (1)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Devoluções/retornos (2)", exact: true })).toBeVisible();

  await abrirNfe(page, "Fornecedor fictício de material de consumo");
  await escolherOutrasOperacoes(page);
  await page.getByRole("button", { name: "Ignorar nota", exact: true }).click();
  await page.getByLabel("Motivo do tratamento (15 a 500 caracteres)", { exact: true }).fill("Documento fora do controle de compras desta loja de exemplo.");
  await capturar(page, info, "ignorar-nota");
  await page.getByRole("button", { name: "Confirmar nota ignorada", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pendentes (0)", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ignoradas (2)", exact: true }).click();
  await capturar(page, info, "historico-notas-ignoradas");
  await page.getByRole("row").filter({ hasText: "Documento ignorado de exemplo" }).getByRole("button", { name: "Ver nota", exact: true }).click();
  await page.getByRole("button", { name: "Reabrir controle da nota", exact: true }).click();
  await page.getByLabel("Motivo do tratamento (15 a 500 caracteres)", { exact: true }).fill("Reabrir para conferir novamente o documento de exemplo.");
  await page.getByRole("button", { name: "Confirmar reabertura", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pendentes (1)", exact: true })).toBeVisible();
});

test("uso e consumo exige recebimento e preserva a data quando o aceite falha", async ({ page }, info) => {
  await abrir(page, info, "erro=1");
  await abrirNfe(page, "Fornecedor fictício de material de consumo");
  const data = page.getByLabel("Data de recebimento dos produtos", { exact: true });
  await expect(data).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Local de estoque", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Aceitar nota", exact: true }).click();
  const confirmar = page.getByRole("button", { name: "Confirmar aceite", exact: true });
  await expect(confirmar).toBeDisabled();
  await data.fill("2026-11-05");
  await expect(confirmar).toBeDisabled();
  await data.fill("2026-11-03");
  await data.press("Tab");
  await expect(page.getByTestId("chamadas-simuladas")).toHaveText("[]");
  await expect(confirmar).toBeEnabled();
  await data.scrollIntoViewIfNeeded();
  await capturar(page, info, "uso-consumo-recebimento");
  await confirmar.click();
  await expect(page.getByText("Falha simulada. Os dados permanecem no formulário.", { exact: true })).toBeVisible();
  await expect(data).toHaveValue("2026-11-03");
  await capturar(page, info, "uso-consumo-erro");
});

test("NFS-e informa vencimento no aceite e bloqueia envio duplicado durante a gravação", async ({ page }, info) => {
  await abrir(page, info, "tipo=nfse&erro=1");
  await page.getByRole("button", { name: "Ver nota", exact: true }).click();
  const aceitar = page.getByRole("button", { name: "Aceitar", exact: true });
  await aceitar.click();
  const confirmacao = page.getByRole("dialog", { name: "Aceitar NFS-e?", exact: true });
  await expect(confirmacao).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmacao).toBeHidden();
  await expect(aceitar).toBeFocused();
  await aceitar.click();
  const vencimento = page.getByLabel("Vencimento do pagamento (opcional)", { exact: true });
  await vencimento.fill("2026-11-20");
  await vencimento.press("Tab");
  await expect(page.getByTestId("chamadas-simuladas")).toHaveText("[]");
  await capturar(page, info, "nfse-vencimento");
  await page.getByRole("button", { name: "Confirmar aceite", exact: true }).click();
  await expect(page.getByText("Falha simulada. Os dados permanecem no formulário.", { exact: true })).toBeVisible();
  await expect(vencimento).toHaveValue("2026-11-20");
  await capturar(page, info, "nfse-erro");

  await abrir(page, info, "tipo=nfse&pendente=1");
  await page.getByRole("button", { name: "Ver nota", exact: true }).click();
  await page.getByRole("button", { name: "Aceitar", exact: true }).click();
  await page.getByLabel("Vencimento do pagamento (opcional)", { exact: true }).fill("2026-11-20");
  const confirmar = page.getByRole("button", { name: "Confirmar aceite", exact: true });
  await confirmar.click();
  await expect(confirmar).toBeDisabled();
  await expect(page.getByLabel("Vencimento do pagamento (opcional)", { exact: true })).toBeDisabled();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const chamadas = JSON.parse(await page.getByTestId("chamadas-simuladas").textContent() ?? "[]");
  expect(chamadas).toHaveLength(1);
  expect(chamadas[0].entrada.dataVencimento).toBe("2026-11-20");
  await capturar(page, info, "nfse-pendente");
});
