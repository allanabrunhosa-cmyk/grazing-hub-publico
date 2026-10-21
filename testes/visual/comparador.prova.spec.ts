import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { diferencaConsultiva } from "../../scripts/referencias-visuais.mjs";

async function abrir(page: Page, info: TestInfo) {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4238" ? rota.continue() : rota.abort());
  await page.goto(`/qualidade.html?caso=normal&tema=${info.project.metadata.tema}`);
  await page.waitForFunction(() => window.grazingQualidade?.pronta === true);
}
function esperado(info: TestInfo, nome: string) {
  const caminho = info.snapshotPath(nome, { kind: "screenshot" });
  const pasta = resolve(".tmp/qualidade-visual-automatizada/comparador/esperados") + sep;
  if (!resolve(caminho).startsWith(pasta)) throw new Error("Autoteste não pode escrever referências oficiais.");
  mkdirSync(resolve(caminho, ".."), { recursive: true });
  return caminho;
}
const hash = (arquivo: string) => createHash("sha256").update(readFileSync(arquivo)).digest("hex");

test("comparador gera diferenças e preserva expectativa temporária", async ({ page }, info) => {
  await abrir(page, info);
  const alvo = page.getByTestId("controles"), nome = "prova-diferenca.png";
  const caminho = esperado(info, nome);
  // Arranjo deliberado do autoteste em .tmp, sem registro ou aprovação de referência.
  writeFileSync(caminho, await alvo.screenshot({ animations: "disabled", caret: "hide", scale: "css" }));
  const antes = hash(caminho);
  await expect(alvo).toHaveScreenshot(nome);
  await page.addStyleTag({ content: '[data-testid="controles"] {opacity:0.5}' });
  const indice = info.attachments.length;
  let falha: unknown;
  try { await expect(alvo).toHaveScreenshot(nome, { timeout: 1500 }); } catch (erro) { falha = erro; }
  expect(diferencaConsultiva(falha, info.attachments.slice(indice))).toBe(true);
  expect(hash(caminho)).toBe(antes);
});

test("imagem inválida é erro operacional e não divergência consultiva", async ({ page }, info) => {
  await abrir(page, info);
  const nome = "prova-invalida.png", caminho = esperado(info, nome);
  writeFileSync(caminho, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
  const indice = info.attachments.length;
  let falha: unknown;
  try { await expect(page.getByTestId("controles")).toHaveScreenshot(nome, { timeout: 1500 }); } catch (erro) { falha = erro; }
  expect(falha).toBeInstanceOf(Error);
  expect(diferencaConsultiva(falha, info.attachments.slice(indice))).toBe(false);
});

test("referência ausente falha sem ser criada automaticamente", async ({ page }, info) => {
  await abrir(page, info);
  const nome = `ausente-${info.testId}.png`, caminho = esperado(info, nome);
  expect(existsSync(caminho)).toBe(false);
  let falha: unknown;
  try { await expect(page.getByTestId("controles")).toHaveScreenshot(nome, { timeout: 1500 }); } catch (erro) { falha = erro; }
  expect(String((falha as Error)?.message)).toContain("snapshot doesn't exist");
  expect(existsSync(caminho)).toBe(false);
});
