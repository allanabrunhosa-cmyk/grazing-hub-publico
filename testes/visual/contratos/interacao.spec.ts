import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", rota => new URL(rota.request().url()).origin === "http://127.0.0.1:4238" ? rota.continue() : rota.abort());
});
async function abrir(page: Page, info: TestInfo) {
  await page.goto(`/qualidade.html?caso=normal&tema=${info.project.metadata.tema}`);
  await page.waitForFunction(() => window.grazingQualidade?.pronta === true);
}

test("Tab mostra foco nos controles e seleção conserva a escolha", async ({ page }, info) => {
  await abrir(page, info);
  await page.getByTestId("campo-nome").focus();
  await page.keyboard.press("Tab");
  const seletor = page.getByTestId("campo-local");
  await expect(seletor).toBeFocused();
  expect(await seletor.evaluate(elemento => elemento.matches(":focus-visible") && getComputedStyle(elemento).boxShadow !== "none")).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Estoque principal", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Estoque principal", exact: true }).click();
  await expect(seletor).toHaveText(/Estoque principal/);
});

test("modal mantém foco, cabe no viewport e devolve foco ao fechar", async ({ page }, info) => {
  await abrir(page, info);
  const gatilho = page.getByTestId("abrir-dialogo");
  await gatilho.click();
  const dialogo = page.getByRole("dialog", { name: "Revisar amostra sintética" });
  await expect(dialogo).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Observação do diálogo" })).toHaveValue("Texto da amostra");
  const historicoFoco: object[] = [];
  const lerFoco = () => dialogo.evaluate(elemento => {
    const ativo = document.activeElement;
    return {
      dentro: elemento.contains(ativo),
      // Base UI encaminha este sentinel para o conteúdo no próximo rAF.
      // Um controle externo ou o body não satisfaz esta exceção transitória.
      guardaDoModal: Boolean(ativo?.hasAttribute("data-base-ui-focus-guard") && ativo.getAttribute("data-type") === "inside" && ativo.parentElement?.contains(elemento)),
      elemento: ativo ? { tag: ativo.tagName, id: ativo.id, role: ativo.getAttribute("role"), nome: ativo.getAttribute("aria-label"), testid: ativo.getAttribute("data-testid") } : null,
    };
  });
  try {
    let escapeReal = false;
    for (let indice = 0; indice < 8; indice++) {
      await page.keyboard.press("Tab");
      const antes = await lerFoco();
      historicoFoco.push({ tab: indice + 1, antes });
      expect(antes.dentro || antes.guardaDoModal, `Foco escapou do modal: ${JSON.stringify(antes)}`).toBe(true);
      await expect.poll(async () => {
        const atual = await lerFoco();
        historicoFoco.push({ tab: indice + 1, observado: atual });
        // Não aceitar um escape real durante a espera da transição do guard.
        if (!atual.dentro && !atual.guardaDoModal) escapeReal = true;
        return atual.dentro && !escapeReal;
      }, { timeout: 2000, intervals: [16, 50, 100, 250], message: `Tab ${indice + 1}: o foco deve terminar dentro do conteúdo do modal` }).toBe(true);
    }
  } finally {
    await info.attach("foco-modal", { body: JSON.stringify(historicoFoco, null, 2), contentType: "application/json" });
  }
  const caixa = await dialogo.boundingBox();
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(Number(info.project.metadata.largura));
  const auditoria = await page.evaluate(() => window.grazingQualidade!.auditar());
  expect(auditoria.problemas).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(gatilho).toBeFocused();
});

test("edição não salva no blur, Escape cancela e Enter envia somente uma vez", async ({ page }, info) => {
  await abrir(page, info);
  const campo = page.getByRole("textbox", { name: "Preço da amostra", exact: true });
  await campo.fill("20.00");
  await page.getByTestId("campo-nome").click();
  await expect(page.getByLabel("Envios simulados")).toHaveText("0");
  await campo.focus();
  await page.keyboard.press("Escape");
  await expect(campo).toHaveValue("10.00");
  await campo.fill("20.00");
  await campo.press("Enter");
  await expect(page.getByLabel("Envios simulados")).toHaveText("1");
  await expect(campo).toBeDisabled();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Envios simulados")).toHaveText("1");
  await page.getByRole("button", { name: "Responder com sucesso", exact: true }).click();
  await expect(campo).toBeEnabled();
  await expect(campo).toHaveValue("20.00");
  await expect(page.getByRole("button", { name: "Confirmar Preço da amostra", exact: true })).toBeDisabled();
});

test("erro de callback preserva preenchimento e permite nova tentativa", async ({ page }, info) => {
  await abrir(page, info);
  const campo = page.getByRole("textbox", { name: "Preço da amostra", exact: true });
  await campo.fill("23.45");
  await campo.press("Enter");
  await page.getByRole("button", { name: "Responder com falha", exact: true }).click();
  await expect(page.getByTestId("edicao-inline").getByRole("alert")).toHaveText("Falha sintética. O valor foi mantido.");
  await expect(campo).toHaveValue("23.45");
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Confirmar Preço da amostra", exact: true })).toBeEnabled();
});

test("filtros reais conservam contagens e busca vazia tem mensagem", async ({ page }, info) => {
  await abrir(page, info);
  const filtros = page.getByTestId("filtros");
  await expect(filtros.getByRole("button", { name: "Todos (3)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await filtros.getByRole("button", { name: "Pessoa jurídica (1)", exact: true }).click();
  await expect(filtros.getByRole("button", { name: "Pessoa física (2)", exact: true })).toBeVisible();
  await filtros.getByRole("textbox", { name: "Buscar cliente do exemplo", exact: true }).fill("Ausente");
  await expect(filtros.getByRole("status")).toHaveText("Nenhum cliente encontrado no exemplo.");
  await expect(filtros.getByRole("button", { name: "Todos (0)", exact: true })).toBeVisible();
});
