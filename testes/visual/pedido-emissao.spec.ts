import { expect, test } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
const evidencia = resolve(raiz, ".tmp/emissao-direta-fiscal-20261021/visual");
const porta = Number(process.env.FISCAL_PEDIDO_VISUAL_PORT ?? "4258");
if (![4258, 4458].includes(porta)) throw new Error("Porta da prévia sintética fora do contrato local.");
const origem = `http://127.0.0.1:${porta}`;

test("emissão direta mantém modelo, alinhamento, teclado e resultado no próprio pedido", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === origem ? rota.continue() : rota.abort());
  await page.goto(`/pedido-detalhe.html?tema=${info.project.metadata.tema}`);
  const seletor = page.getByRole("combobox", { name: "Modelo da nota", exact: true });
  const botao = page.getByRole("button", { name: "Emitir NFC-e", exact: true });
  await expect(seletor).toContainText("NFC-e (65)"); await seletor.scrollIntoViewIfNeeded();
  const campo = await seletor.boundingBox(), acao = await botao.boundingBox();
  expect(Math.abs(campo!.y - acao!.y)).toBeLessThanOrEqual(1);
  expect(campo!.x + campo!.width).toBeLessThan(acao!.x);
  expect(acao!.x + acao!.width).toBeLessThanOrEqual(Number(info.project.metadata.largura));
  await mkdir(evidencia, { recursive: true });
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}-detalhe.png`), fullPage: true });
  await seletor.press("Enter"); await page.getByRole("option", { name: "NF-e (55)", exact: true }).click();
  await expect(seletor).toContainText("NF-e (55)");
  await page.getByRole("button", { name: "Emitir NF-e", exact: true }).click();
  await expect(page.getByText("Nota fiscal emitida com sucesso.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Emitir nota fiscal", exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Emitir NFC?-e$/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Abrir PDF", exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}-emitida.png`), fullPage: true });
  const auditorFonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), auditorFonte);
  expect(auditoria.problemas).toEqual([]);
  await writeFile(resolve(evidencia, `${info.project.name}.json`), JSON.stringify({ largura: info.project.metadata.largura, tema: info.project.metadata.tema, sintetico: true, auditoria }, null, 2));
});

test("pendência fiscal e cartão são corrigidos inline sem nova tela", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === origem ? rota.continue() : rota.abort());
  await page.goto(`/pedido-detalhe.html?fiscal=erro&tema=${info.project.metadata.tema}`);
  await page.getByRole("button", { name: "Emitir NFC-e", exact: true }).click();
  const fiscal = page.getByRole("region", { name: "Nota fiscal", exact: true });
  await expect(fiscal.getByRole("alert")).toContainText("Caixa Grazing média: informe o NCM de oito dígitos");
  await expect(fiscal.getByRole("link", { name: "Corrigir informação", exact: true })).toHaveAttribute("href", "/financeiro/fiscal/cobertura");
  await expect(page.getByRole("dialog", { name: "Emitir nota fiscal", exact: true })).toHaveCount(0);
  await fiscal.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(evidencia, `${info.project.name}-erro.png`) });
  const auditorFonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), auditorFonte); expect(auditoria.problemas).toEqual([]);
  await page.goto(`/pedido-detalhe.html?fiscal=cartao&tema=${info.project.metadata.tema}`);
  await page.getByRole("button", { name: "Emitir NFC-e", exact: true }).click();
  const campo = page.getByRole("combobox", { name: "Integração do pagamento com cartão", exact: true });
  await expect(campo).toBeVisible(); await expect(page.getByRole("button", { name: "Emitir NFC-e", exact: true })).toBeDisabled();
  await campo.press("Enter"); await page.getByRole("option", { name: "Não integrado ao sistema (POS)", exact: true }).click();
  await page.getByRole("button", { name: "Emitir NFC-e", exact: true }).click();
  await expect(page.getByText("Nota fiscal emitida com sucesso.", { exact: true })).toBeVisible();
});

test("nota autorizada apresenta ações e erro de cancelamento sem oferecer nova emissão", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === origem ? rota.continue() : rota.abort());
  await page.goto(`/pedido-detalhe.html?fiscal=autorizada&tema=${info.project.metadata.tema}`);

  await expect(page.getByText("Nota fiscal emitida com sucesso.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Emitir NFC?-e$/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Abrir PDF", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar XML", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pagamento", exact: true }).getByRole("button")).toHaveCount(0);
  const acoes = page.getByRole("group", { name: "Ações da nota fiscal", exact: true });
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}-autorizada-topo.png`) });
  await acoes.scrollIntoViewIfNeeded();
  for (const nome of ["Baixar XML", "Abrir PDF", "Cancelar NF", "Consultar resultado"]) {
    await expect(acoes.getByRole(nome === "Baixar XML" || nome === "Abrir PDF" ? "link" : "button", { name: nome, exact: true }).locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
  const cores = await acoes.locator('a, button').evaluateAll(elementos => elementos.map(e => getComputedStyle(e).backgroundColor));
  expect(new Set(cores).size).toBe(4);
  const auditorFonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), auditorFonte);
  expect(auditoria.problemas).toEqual([]);
  await expect(page.getByText("Histórico fiscal", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Documentos de revisões anteriores", { exact: true })).toHaveCount(0);
  await mkdir(evidencia, { recursive: true });
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}-autorizada.png`), fullPage: true });
  await page.getByRole("button", { name: "Cancelar NF", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Cancelar nota fiscal", exact: true });
  await dialogo.getByRole("textbox", { name: "Justificativa do cancelamento" }).fill("Pedido sintético duplicado pelo cliente.");
  await dialogo.getByRole("button", { name: "Confirmar cancelamento da NF" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("prazo legal encerrado");
  await expect(dialogo.getByRole("button", { name: "Confirmar cancelamento da NF" })).toBeDisabled();
  const caixa = await dialogo.boundingBox();
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(Number(info.project.metadata.largura) + 1);
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}-cancelamento.png`) });
});


test("nota com cancelamento pendente mantém alerta e documentos sem repetir a solicitação", async ({ page }, info) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === origem ? rota.continue() : rota.abort());
  await page.goto(`/pedido-detalhe.html?fiscal=pendente&tema=${info.project.metadata.tema}`);
  const fiscal = page.getByRole("region", { name: "Nota fiscal", exact: true });
  await fiscal.scrollIntoViewIfNeeded();
  await expect(fiscal.getByRole("alert")).toContainText("código 155");
  await expect(fiscal.getByRole("button", { name: "Cancelar NF", exact: true })).toHaveCount(0);
  await expect(fiscal.getByRole("link", { name: "Baixar XML", exact: true })).toBeVisible();
  await expect(fiscal.getByRole("link", { name: "Abrir PDF", exact: true })).toBeVisible();
  const auditorFonte = (await readFile(resolve(raiz, "scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
  const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), auditorFonte);
  expect(auditoria.problemas).toEqual([]);
  await mkdir(evidencia, { recursive: true });
  await page.screenshot({ path: resolve(evidencia, `${info.project.name}-pendente.png`) });
});
