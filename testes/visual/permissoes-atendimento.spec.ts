import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RECURSOS_ATENDIMENTO, SECOES_ATENDIMENTO } from "../../src/lib/permissoes/atendimento";

const pasta = resolve(__dirname, "../../.tmp/permissoes-atendimento-20261021/capturas");
const nome = (id: string) => { const r = RECURSOS_ATENDIMENTO.find(r => r.id === id)!; return r.nomeMatriz ?? r.nome; };
let fonteAuditoria = "";
let erros: string[] = [], externos: string[] = [];
test.beforeAll(async () => {
  await mkdir(pasta, { recursive: true });
  fonteAuditoria = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8")).replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
});
test.beforeEach(async ({ page }) => {
  erros = []; externos = [];
  page.on("pageerror", erro => erros.push(erro.message));
  await page.route("**/*", async rota => {
    const url = new URL(rota.request().url());
    if (["data:", "blob:"].includes(url.protocol) || url.origin === "http://127.0.0.1:4459") return rota.continue();
    externos.push(url.origin); await rota.abort();
  });
});
test.afterEach(() => {
  expect(erros, "A prévia não deve produzir erros de página").toEqual([]);
  expect(externos, "A prévia não pode consultar sistemas externos").toEqual([]);
});

async function abrir(page: Page, info: TestInfo, estado = "perfil") {
  await page.goto(`/permissoes-atendimento.html?tema=${info.project.metadata.tema}&estado=${estado}`);
  await expect(page.getByRole("heading", { name: "Permissões do Atendimento" })).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  // A prévia usa a matriz real; recolhe os outros módulos por sua interação nativa.
  for (const titulo of ["Suprimentos", "Configurações"]) {
    const summary = page.getByText(titulo, { exact: true }).first().locator("..");
    if (await summary.evaluate(elemento => elemento.parentElement instanceof HTMLDetailsElement && elemento.parentElement.open)) await summary.click({ position: { x: 12, y: 12 } });
  }
}
async function resultado(page: Page) { return JSON.parse((await page.getByTestId("resultado").textContent())!); }
async function auditar(page: Page, info: TestInfo, estado: string) {
  const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), fonteAuditoria);
  await info.attach(`auditoria-${estado}`, { body: JSON.stringify(auditoria, null, 2), contentType: "application/json" });
  expect(auditoria.problemas).toEqual([]);
}

test("hierarquia, estados e capturas usam a matriz real sem overflow", async ({ page }, info) => {
  for (const estado of ["perfil", "personalizado", "salvando", "vazio", "erro"]) {
    await abrir(page, info, estado);
    const modulo = page.getByLabel("Módulo Atendimento", { exact: true });
    await expect(modulo).toBeVisible();
    for (const secao of SECOES_ATENDIMENTO) await expect(modulo.getByLabel(`Seção ${secao.nome}`, { exact: true })).toBeVisible();
    await expect(modulo.getByRole("group", { name: nome("crm.atendimento.contatos"), exact: true })).toBeVisible();
    const geometria = await page.evaluate(() => ({ viewport: innerWidth, documento: document.documentElement.scrollWidth, linhas: [...document.querySelectorAll('[aria-label="Módulo Atendimento"] [role="group"]')].filter(el => el.getClientRects().length).map(el => ({ disponivel: el.clientWidth, conteudo: el.scrollWidth })) }));
    expect(geometria.documento).toBeLessThanOrEqual(geometria.viewport + 1);
    for (const linha of geometria.linhas) expect(linha.conteudo).toBeLessThanOrEqual(linha.disponivel + 1);
    if (estado === "salvando") {
      await expect(page.getByRole("status")).toContainText("Salvando perfil fictício");
      await expect(modulo.getByRole("checkbox", { name: nome("crm") + ": Editar", exact: true })).toBeDisabled();
      await expect(modulo.getByRole("button", { name: "Tudo em Chat", exact: true })).toHaveCount(0);
    }
    if (estado === "erro") await expect(page.getByRole("alert")).toContainText("alterações foram preservadas");
    await auditar(page, info, estado);
    await modulo.screenshot({ path: resolve(pasta, `${info.project.name}-${estado}.png`), animations: "disabled" });
  }
});

test("ações em lote respeitam a seção, conservam outros módulos e exibem operações indisponíveis", async ({ page }, info) => {
  await abrir(page, info);
  const inicial = await resultado(page);
  const chat = page.getByLabel("Seção Chat", { exact: true });
  await chat.getByRole("button", { name: "Tudo em Chat", exact: true }).click();
  let atual = await resultado(page);
  for (const id of SECOES_ATENDIMENTO.find(s => s.id === "chat")!.recursos) expect(atual.base[id]).toEqual(RECURSOS_ATENDIMENTO.find(r => r.id === id)!.acoes);
  expect(atual.base["crm.atendimento.agenda"]).toEqual(inicial.base["crm.atendimento.agenda"]);
  expect(atual.base["vendas.clientes"]).toEqual(inicial.base["vendas.clientes"]);
  await chat.getByRole("checkbox", { name: "Chat: Adicionar em todos os recursos", exact: true }).click();
  atual = await resultado(page);
  expect(atual.base["crm.atendimento.mensagens"]).toEqual(["visualizar"]);
  await expect(chat.getByRole("checkbox", { name: nome("crm.atendimento.mensagens") + ": Excluir", exact: true })).toHaveCount(0);
  await expect(chat.getByLabel(nome("crm.atendimento.mensagens") + ": Excluir não se aplica", { exact: true })).toHaveText("—");
  await auditar(page, info, "acoes-da-secao");
});

test("teclado abre a seção, altera a ação exata e restaura a personalização", async ({ page }, info) => {
  await abrir(page, info, "personalizado");
  const templates = page.getByLabel("Seção Templates", { exact: true });
  const titulo = templates.locator(":scope > summary");
  await titulo.focus(); await page.keyboard.press("Enter");
  await expect(templates).toHaveAttribute("open", "");
  const editar = templates.getByRole("checkbox", { name: nome("crm.atendimento.modelos") + ": Editar", exact: true });
  await editar.focus(); await page.keyboard.press("Space");
  await expect(editar).toBeChecked();
  let atual = await resultado(page);
  expect(atual.excecoes["crm.atendimento.modelos"]).toEqual({ editar: true, visualizar: true });
  expect(atual.excecoes["crm.atendimento.mensagens"]).toEqual({ adicionar: false });
  await titulo.focus(); await page.keyboard.press("Enter");
  await expect(templates).not.toHaveAttribute("open", "");
  await titulo.focus(); await page.keyboard.press("Enter");
  await expect(editar).toBeChecked();
  await templates.getByRole("button", { name: "Restaurar perfil em " + nome("crm.atendimento.modelos"), exact: true }).click();
  await expect(editar).not.toBeChecked();
  atual = await resultado(page);
  expect(atual.excecoes["crm.atendimento.modelos"]).toBeUndefined();
  expect(atual.excecoes["crm.atendimento.mensagens"]).toEqual({ adicionar: false });
  await titulo.focus(); await page.keyboard.press("Enter");
  await expect(templates).not.toHaveAttribute("open", "");
  await auditar(page, info, "teclado-personalizacao");
});
