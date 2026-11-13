import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";

const origem = "http://127.0.0.1:4187";
const diagnosticos = new WeakMap<Page, { erros: string[]; redesExternas: string[] }>();
const formas = [{ codigo: "BOLETO", nome: "Boleto" }, { codigo: "PIX", nome: "Pix" }, { codigo: "CARTAO", nome: "Cartão de crédito" }] as const;

test.beforeEach(async ({ page }) => {
  const estado = { erros: [] as string[], redesExternas: [] as string[] };
  diagnosticos.set(page, estado);
  page.on("pageerror", erro => estado.erros.push(erro.message));
  await page.clock.install({ time: new Date("2026-11-13T15:00:00.000Z") });
  await page.route("**/*", rota => {
    const url = new URL(rota.request().url());
    if (url.origin === origem) return rota.continue();
    estado.redesExternas.push(url.origin);
    return rota.abort();
  });
});

test.afterEach(async ({ page }, info) => {
  const estado = diagnosticos.get(page)!;
  await info.attach("isolamento-e-erros", { body: JSON.stringify(estado), contentType: "application/json" });
  expect(estado.erros).toEqual([]);
  expect(estado.redesExternas).toEqual([]);
});

async function abrir(page: Page, info: TestInfo, caminho: string) {
  const url = new URL(caminho, origem);
  if (info.project.metadata.tema === "escuro") url.searchParams.set("escuro", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(info.project.metadata.toque);
  await expect(page.locator("html")).toHaveClass(info.project.metadata.tema === "escuro" ? /dark/ : /light/);
}

async function capturar(page: Page, info: TestInfo, nome: string) {
  const auditoria = await page.evaluate<{ problemas: unknown[] }>(`(${auditarInterface.toString()})(document)`);
  await info.attach(`auditoria-${nome}`, { body: JSON.stringify(auditoria), contentType: "application/json" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const dialogo of await page.getByRole("dialog").all()) {
    const limites = await dialogo.evaluate(elemento => ({ largura: elemento.clientWidth, conteudo: elemento.scrollWidth, caixa: elemento.getBoundingClientRect().toJSON() }));
    await info.attach(`geometria-${nome}`, { body: JSON.stringify(limites), contentType: "application/json" });
    expect(limites.conteudo).toBeLessThanOrEqual(limites.largura + 1);
    expect(limites.caixa.x).toBeGreaterThanOrEqual(0);
    expect(limites.caixa.right).toBeLessThanOrEqual(Number(info.project.metadata.largura));
  }
  expect(auditoria.problemas).toEqual([]);
  await page.screenshot({ path: info.outputPath(`${nome}.png`), fullPage: true, animations: "disabled" });
}

async function chamadas(page: Page) {
  return JSON.parse(await page.getByTestId("chamadas-simuladas").textContent() ?? "[]") as { acao: string; entrada: Record<string, unknown> }[];
}

async function escolherForma(page: Page, nome: string) {
  await page.getByRole("combobox", { name: "Forma de pagamento da compra", exact: true }).click();
  await page.getByRole("option", { name: nome, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Forma de pagamento da compra", exact: true }).locator('[data-slot="select-value"]')).toHaveText(nome);
}

async function parcelar(page: Page, forma: typeof formas[number], quantidade = 3) {
  await escolherForma(page, forma.nome);
  await page.getByLabel("Quantidade de parcelas", { exact: true }).fill(String(quantidade));
  if (forma.codigo === "CARTAO") {
    await page.getByRole("combobox", { name: "Cartão da compra", exact: true }).click();
    await page.getByRole("option", { name: "Cartão fictício com identificação extensa · Conta bancária de exemplo", exact: true }).click();
    await page.getByLabel("Data da compra", { exact: true }).fill("2026-11-13");
    await page.getByLabel("Parcela inicial do cartão", { exact: true }).fill("2");
  }
  for (let indice = 1; indice <= quantidade; indice++) {
    const vencimento = page.getByLabel(`Vencimento da parcela ${indice}`, { exact: true });
    if (forma.codigo === "CARTAO") {
      await expect(vencimento).toBeDisabled();
      await expect(vencimento).toHaveValue(indice === 1 ? "2026-12-28" : indice === 2 ? "2027-01-28" : "2027-02-28");
    } else {
      await expect(vencimento).toBeEnabled();
      await vencimento.fill(indice === 1 ? "2026-11-28" : indice === 2 ? "2026-12-28" : "2027-01-28");
    }
  }
  await expect(page.getByText(`Parcela ${quantidade} de ${quantidade}`, { exact: true })).toBeVisible();
}

test("criação permite parcelas em Boleto, Pix e Cartão e só envia ao registrar", async ({ page }, info) => {
  for (const forma of formas) {
    await abrir(page, info, "/entrada-avulsa.html");
    const fornecedor = page.getByRole("combobox", { name: "Fornecedor da compra", exact: true });
    await fornecedor.fill("MERCADO");
    await page.getByRole("option", { name: "MERCADO CENTRAL LTDA", exact: true }).click();
    await page.getByRole("combobox", { name: "Local do item 1", exact: true }).click();
    await page.getByRole("option", { name: "Câmara fria", exact: true }).click();
    await page.getByLabel("Quantidade do item 1", { exact: true }).fill("2");
    await page.getByLabel("Valor do item 1", { exact: true }).fill("16001");
    await parcelar(page, forma);
    await page.getByLabel("Quantidade de parcelas", { exact: true }).press("Tab");
    expect(await chamadas(page)).toEqual([]);
    await page.getByText("Parcela 1 de 3", { exact: true }).scrollIntoViewIfNeeded();
    await capturar(page, info, `criacao-${forma.codigo.toLowerCase()}-parcelada`);
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect.poll(() => chamadas(page)).toHaveLength(1);
    const [chamada] = await chamadas(page);
    expect(chamada.acao).toBe("CRIAR");
    expect(chamada.entrada.pagamento).toMatchObject({ formaPagamento: forma.codigo, parcelas: expect.arrayContaining([expect.objectContaining({ valor: expect.any(Number), dataVencimento: expect.any(String) })]) });
    const pagamento = chamada.entrada.pagamento as { parcelas: { valor: number }[]; cartaoCreditoId?: string; parcelaCartao?: number };
    expect(pagamento.parcelas).toHaveLength(3);
    expect(pagamento.parcelas.reduce((soma, parcela) => soma + Math.round(parcela.valor * 100), 0)).toBe(16001);
    if (forma.codigo === "CARTAO") expect(pagamento).toMatchObject({ cartaoCreditoId: "cartao-ficticio", dataCompra: "2026-11-13", parcelaCartao: 2 });
  }
});

test("edição altera forma e parcelas com revisão e exige salvar explicitamente", async ({ page }, info) => {
  for (const forma of formas) {
    await abrir(page, info, "/estoque-entradas.html?modo=detalhe&pagamento=pendente");
    await page.getByRole("button", { name: "Editar entrada", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Editar entrada avulsa 123", exact: true })).toBeVisible();
    await parcelar(page, forma);
    await page.getByLabel("Quantidade de parcelas", { exact: true }).press("Tab");
    expect(await chamadas(page)).toEqual([]);
    await page.getByText("Parcela 1 de 3", { exact: true }).scrollIntoViewIfNeeded();
    await capturar(page, info, `edicao-${forma.codigo.toLowerCase()}-parcelada`);
    await page.getByRole("button", { name: "Salvar correção", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const [chamada] = await chamadas(page);
    expect(chamada.acao).toBe("CORRIGIR");
    expect(chamada.entrada).toMatchObject({ id: "entrada-ficticia", versao: 2, pagamento: { formaPagamento: forma.codigo, revisao: "revisao-financeira-ficticia", parcelas: expect.any(Array) } });
    const pagamento = chamada.entrada.pagamento as { parcelas: { valor: number }[] };
    expect(pagamento.parcelas).toHaveLength(3);
    expect(pagamento.parcelas.reduce((soma, parcela) => soma + Math.round(parcela.valor * 100), 0)).toBe(16000);
    await expect(page.getByRole("button", { name: "Editar entrada", exact: true })).toBeFocused();
  }
});

test("pagamento realizado bloqueia edição financeira e preserva correção física", async ({ page }, info) => {
  await abrir(page, info, "/estoque-entradas.html?modo=detalhe&pagamento=pago");
  await page.getByRole("button", { name: "Editar entrada", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("A compra possui pagamento realizado. Estorne o pagamento no Financeiro antes de alterar a forma ou as parcelas.", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Forma de pagamento da compra", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Quantidade de parcelas", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Valor da parcela 1", { exact: true })).toBeDisabled();
  await page.getByLabel("Observação / motivo", { exact: true }).fill("Conferência física de exemplo sem alteração financeira.");
  await capturar(page, info, "edicao-pagamento-realizado-bloqueado");
  expect(await chamadas(page)).toEqual([]);
  await page.getByRole("button", { name: "Salvar correção", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const [chamada] = await chamadas(page);
  expect(chamada.entrada).not.toHaveProperty("pagamento");
});

test("erro preserva rascunho, não aceita soma divergente e permite sair por confirmação", async ({ page }, info) => {
  await abrir(page, info, "/estoque-entradas.html?modo=detalhe&pagamento=pendente&erro=1");
  await page.getByRole("button", { name: "Editar entrada", exact: true }).click();
  await parcelar(page, formas[1]);
  await page.getByLabel("Valor da parcela 1", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Salvar correção", exact: true }).click();
  await expect(page.getByText("A soma das parcelas deve ser igual ao total da compra.", { exact: true })).toBeVisible();
  expect(await chamadas(page)).toEqual([]);
  await capturar(page, info, "edicao-soma-divergente");
  await page.getByLabel("Quantidade de parcelas", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Salvar correção", exact: true }).click();
  await expect(page.getByText("Simulação: saldo disponível insuficiente. O rascunho foi preservado.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Quantidade de parcelas", { exact: true })).toHaveValue("2");
  await capturar(page, info, "edicao-erro-rascunho-preservado");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Continuar editando", exact: true }).press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByLabel("Quantidade de parcelas", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Sair sem salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
