import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const pasta = resolve(__dirname, "../../.tmp/bi-vendas/capturas");
let fonteAuditoria = "";
test.beforeAll(async () => {
  await mkdir(pasta, { recursive: true });
  fonteAuditoria = (await readFile(resolve(__dirname, "../../scripts/auditar-interface.mjs"), "utf8"))
    .replace(/^[\s\S]*?(export function auditarInterface)/, "function auditarInterface");
});

async function auditarPagina(page: Page, info: TestInfo, estado: string) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  // Executa somente o auditor oficial, síncrono e sem mutações no DOM.
  const auditoria = await page.evaluate(fonte => (0, eval)(`(${fonte})(document)`), fonteAuditoria);
  await info.attach(`auditoria-interface-${estado}`, { body: JSON.stringify(auditoria, null, 2), contentType: "application/json" });
  expect(auditoria.problemas).toEqual([]);
}

test.afterEach(async ({ page }, info) => {
  if (info.status === "passed" && !page.isClosed()) await auditarPagina(page, info, "final");
});

for (const largura of [1672, 1800, 1920, 1440, 1280, 768, 390, 320]) test(`hierarquia, leitura e captura ${largura}`, async ({ page }) => {
  const erros: string[] = []; page.on("pageerror", erro => erros.push(erro.message));
  await page.setViewportSize({ width: largura, height: 941 });
  await page.goto("/bi-vendas.html?estado=longo");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evolução das vendas", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Produtos que mais vendem", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pessoa física e jurídica", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Categorias mais vendidas", exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Clientes que mais compram" }).getByRole("columnheader", { name: "Tipo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oportunidades comerciais", exact: true })).toHaveCount(0);
  const geometria = await page.evaluate(() => ({ largura: innerWidth, documento: document.documentElement.scrollWidth, cards: [...document.querySelectorAll('[aria-label="Indicadores de vendas"] [data-slot="card"]')].map(el => { const valor = el.querySelector("p")!; return { x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, largura: el.clientWidth, valorLargura: valor?.scrollWidth, valorDisponivel: valor?.clientWidth }; }) }));
  expect(geometria.documento).toBeLessThanOrEqual(geometria.largura + 1);
  expect(geometria.cards).toHaveLength(7);
  for (const card of geometria.cards) expect(card.valorLargura).toBeLessThanOrEqual(card.valorDisponivel + 1);
  const abas = await page.getByRole("tab").evaluateAll(elementos => elementos.map(el => { const r = el.getBoundingClientRect(); return { texto: el.textContent, x: r.x, y: r.y, direita: r.right, larguraTexto: el.scrollWidth, largura: el.clientWidth }; }));
  for (const aba of abas) expect(aba.larguraTexto, aba.texto ?? "Aba").toBeLessThanOrEqual(aba.largura + 1);
  for (let i = 1; i < abas.length; i++) if (Math.abs(abas[i].y - abas[i - 1].y) < 1) expect(abas[i].x).toBeGreaterThanOrEqual(abas[i - 1].direita);
  const pixelsNasBordasDoGrafico = await page.locator("canvas").evaluate(canvas => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("O gráfico precisa renderizar um canvas.");
    const contexto = canvas.getContext("2d")!;
    return [0, canvas.width - 1].map(x => {
      const pixels = contexto.getImageData(x, 0, 1, canvas.height).data;
      return Array.from({ length: canvas.height }, (_, y) => pixels[y * 4 + 3]).filter(alpha => alpha > 0).length;
    });
  });
  expect(pixelsNasBordasDoGrafico, "O eixo Y e os valores devem caber sem pintura cortada nas bordas do canvas.").toEqual([0, 0]);
  if (largura === 1672) expect(new Set(geometria.cards.map(c => c.y)).size).toBe(2);
  if (largura === 1800) expect(new Set(geometria.cards.map(c => c.y)).size).toBe(2);
  if (largura === 1920) expect(new Set(geometria.cards.map(c => c.y)).size).toBe(1);
  if (largura === 1280) expect(new Set(geometria.cards.map(c => c.y)).size).toBe(2);
  await page.screenshot({ path: resolve(pasta, `bi-${largura}.png`), animations: "disabled" });
  await page.screenshot({ path: resolve(pasta, `bi-${largura}-completa.png`), fullPage: true, animations: "disabled" });
  expect(erros).toEqual([]);
});

test("PF/PJ, ticket por tipo e ranking completo de categorias", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bi-vendas.html");
  const clientes = page.getByRole("table", { name: "Clientes que mais compram" });
  await expect(clientes.getByRole("cell", { name: "PJ", exact: true }).first()).toBeVisible();
  await expect(clientes.getByRole("cell", { name: "PF", exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Valores por tipo de pessoa: pedidos").getByText("Ticket médio", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "Ver ranking de categorias", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("table", { name: "Ranking de categorias" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("button", { name: "Ver ranking de categorias", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Ver ranking de categorias", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Grazing", exact: true }).click();
  await expect(page).toHaveURL(/categoria=grazing/);
  await expect(page).toHaveURL(/aba=produtos/);
});

test("abas, ranking, painéis e filtros preservados", async ({ page }, info) => {
  await page.setViewportSize({ width: 1672, height: 941 }); await page.goto("/bi-vendas.html");
  await page.getByRole("button", { name: "Ver ranking completo" }).click();
  await expect(page.getByRole("heading", { name: "Ranking completo de produtos" })).toBeVisible();
  await expect(page).toHaveURL(/aba=produtos/);
  await page.getByRole("tab", { name: "Visão geral" }).click();
  await page.getByRole("button", { name: "Ver ranking de clientes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Clientes compradores", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/aba=clientes/);
  await page.getByRole("tab", { name: "Visão geral" }).click();
  await expect(page).toHaveURL(/somenteSemRecompra=false/);
  await expect(page).toHaveURL(/de=2026-01-01.*ate=2026-09-30/);
  await expect(page.getByText("Sem recompra há 60 dias", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver pedidos", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await expect(page.getByText("GH-260001", { exact: true })).toBeVisible();
  await auditarPagina(page, info, "pedidos");
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Ver cobertura" }).click();
  await expect(page.getByRole("heading", { name: "Cobertura e definições" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Fechar", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Mais filtros" }).click();
  const dias = page.getByRole("textbox", { name: "Intervalo sem recompra (dias)" });
  await dias.fill("90"); await dias.press("e"); await expect(dias).toHaveValue("90");
  await auditarPagina(page, info, "filtros");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(/diasSemRecompra=90/);
});

test("erro preserva seleção confirmada e permite nova tentativa", async ({ page }) => {
  await page.goto("/bi-vendas.html?estado=erro");
  await page.getByRole("tab", { name: "Produtos", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Falha simulada");
  await page.screenshot({ path: resolve(pasta, "bi-erro.png"), fullPage: true, animations: "disabled" });
  await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Evolução das vendas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("alert")).toContainText("Falha simulada");
});

test("permissões ocultam exportação e restringem detalhamento", async ({ page }) => {
  await page.goto("/bi-vendas.html?estado=restrito");
  await expect(page.getByRole("link", { name: "Exportar" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Clientes", exact: true })).toBeDisabled();
  await expect(page.getByRole("img", { name: /Distribuição de pedidos por tipo de pessoa/ })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Métrica por tipo de pessoa", exact: true })).toHaveCount(0);
  await page.goto("/bi-vendas.html?estado=restrito&aba=clientes");
  await expect(page.getByText("Você não tem permissão para consultar os dados dos clientes.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Rentabilidade", exact: true })).toBeDisabled();
  await page.goto("/bi-vendas.html?estado=restrito&aba=rentabilidade");
  await expect(page.getByText("Você não tem permissão para consultar custos.")).toBeVisible();
});

test("gráfico tem alternativa textual e seleção por teclado", async ({ page }) => {
  await page.goto("/bi-vendas.html");
  const valores = page.getByRole("button", { name: "Consultar valores do gráfico", exact: true });
  await valores.click();
  await expect(page.getByText("Valores da evolução", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Período", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cobertura", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(valores).toBeFocused();
  const grafico = page.getByRole("img", { name: /Evolução de faturamento/ });
  await grafico.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/de=2026-02-01/);
});

test("resposta antiga não substitui o canal selecionado mais recentemente", async ({ page }) => {
  await page.goto("/bi-vendas.html");
  await page.getByRole("combobox", { name: "Canal", exact: true }).click();
  await page.getByRole("option", { name: "Site", exact: true }).click();
  await page.getByRole("combobox", { name: "Canal", exact: true }).click();
  await page.getByRole("option", { name: "iFood", exact: true }).click();
  await expect(page).toHaveURL(/canal=ifood/);
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/canal=ifood/);
  await expect(page.getByRole("combobox", { name: "Canal", exact: true })).toContainText("iFood");
});

test("Ver pedidos reinicia sua página e preserva os filtros globais", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/bi-vendas.html?aba=produtos&pagina=4&canal=site&de=2026-02-01&ate=2026-05-31");
  await page.getByRole("button", { name: "Ver pedidos", exact: true }).click();
  await expect(page).toHaveURL(/pagina=1(?:&|$)/);
  const url = new URL(page.url());
  expect(url.searchParams.get("canal")).toBe("site");
  expect(url.searchParams.get("de")).toBe("2026-02-01");
  expect(url.searchParams.get("ate")).toBe("2026-05-31");
  expect(url.searchParams.get("aba")).toBe("produtos");
  await expect(page.getByRole("dialog").getByText("GH-260001", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Página 1 de 1");
});

test("período oficial preserva anos e limites abertos na URL e exportação", async ({ page }) => {
  await page.goto("/bi-vendas.html?de=2025-12-15&ate=2026-03-15");
  for (const largura of [1672, 320]) {
    await page.setViewportSize({ width: largura, height: 941 });
    await expect(page.getByLabel("De", { exact: true })).toHaveValue("2025-12-15");
    await expect(page.getByLabel("até", { exact: true })).toHaveValue("2026-03-15");
    await expect(page.getByRole("combobox", { name: "Comparação", exact: true })).toBeVisible();
  }
  await page.getByLabel("De", { exact: true }).fill("2026-01-15");
  await expect(page).toHaveURL(/de=2025-12-15/);
  await page.getByLabel("De", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/de=2026-01-15/);
  await page.getByRole("button", { name: "Limpar datas", exact: true }).click();
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("até", { exact: true })).toHaveValue("");
  await expect(page).toHaveURL(/de=&ate=/);
  const exportacao = new URL(await page.getByRole("link", { name: "Exportar", exact: true }).getAttribute("href") ?? "", page.url());
  expect(exportacao.searchParams.get("de")).toBe("");
  expect(exportacao.searchParams.get("ate")).toBe("");
});

test("região informada não significa destino validado", async ({ page }, info) => {
  for (const largura of [1672, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width: largura, height: 941 });
    await page.goto("/bi-vendas.html?estado=regiao-sem-validacao");
    await expect(page.getByText(/4\/6 com região informada/)).toBeVisible();
    await page.getByRole("button", { name: "Ver cobertura", exact: true }).click();
    const painel = page.getByRole("dialog");
    const valor = (rotulo: string) => painel.getByText(rotulo, { exact: true }).locator("..").locator("dd");
    await expect(valor("Destinos confirmados")).toHaveText("1");
    await expect(valor("Localização aproximada")).toHaveText("2");
    await expect(valor("Sem região informada")).toHaveText("2");
    await expect(valor("Destinos não validados")).toHaveText("3");
    await expect(painel.getByText("Sem endereço validado", { exact: true })).toHaveCount(0);
    await auditarPagina(page, info, `cobertura-regional-${largura}`);
    if (largura === 1672) await page.screenshot({ path: resolve(pasta, "bi-cobertura-regional.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Entregas", exact: true }).click();
    await expect(page.getByText(/Cobertura regional: 4\/6 entregas com região informada/)).toBeVisible();
    await auditarPagina(page, info, `entregas-regiao-${largura}`);
  }
});

test("estados vazio, carregamento e tema escuro", async ({ page }, info) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/bi-vendas.html?estado=vazio");
  await expect(page.getByText("Nenhum produto vendido na seleção.")).toBeVisible();
  await expect(page.getByText("Nenhum pedido válido nesta seleção.", { exact: true })).toBeVisible();
  await auditarPagina(page, info, "vazio");
  await page.screenshot({ path: resolve(pasta, "bi-vazio.png"), animations: "disabled" });
  await page.goto("/bi-vendas.html?estado=carregando");
  await page.getByRole("tab", { name: "Produtos", exact: true }).click();
  await expect(page.getByTestId("bi-vendas")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByLabel("Atualizando indicador", { exact: true })).toHaveCount(7);
  await auditarPagina(page, info, "carregando");
  await page.screenshot({ path: resolve(pasta, "bi-carregando.png"), animations: "disabled" });
  await page.goto("/bi-vendas.html?escuro=true");
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const largura of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width: largura, height: 941 });
    await auditarPagina(page, info, `escuro-${largura}`);
    await page.screenshot({ path: resolve(pasta, `bi-escuro-${largura}.png`), fullPage: true, animations: "disabled" });
  }
});

test("pizza alterna pedidos e faturamento e mantém o ranking no espaço inferior", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 941 });
  await page.goto("/bi-vendas.html?canal=site&de=2026-01-01&ate=2026-09-30");
  const seletor = page.getByRole("group", { name: "Métrica por tipo de pessoa", exact: true });
  await expect(seletor.getByRole("button", { name: "Pedidos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /Distribuição de pedidos por tipo de pessoa/ })).toBeVisible();
  const legenda = page.getByLabel("Valores por tipo de pessoa: pedidos", { exact: true });
  await expect(legenda).toContainText("Pessoa física");
  await expect(legenda).toContainText("70%");
  await expect(legenda).toContainText("Sem classificação");
  await seletor.getByRole("button", { name: "Faturamento", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(seletor.getByRole("button", { name: "Faturamento", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /Distribuição de faturamento por tipo de pessoa/ })).toBeVisible();
  await expect(page.getByLabel("Valores por tipo de pessoa: faturamento", { exact: true })).toContainText("45%");
  const url = new URL(page.url());
  expect(url.searchParams.get("canal")).toBe("site");
  expect(url.searchParams.get("de")).toBe("2026-01-01");
  const pizza = await page.getByRole("heading", { name: "Pessoa física e jurídica", exact: true }).boundingBox();
  const produtos = await page.getByRole("heading", { name: "Produtos que mais vendem", exact: true }).boundingBox();
  expect(produtos!.y).toBeGreaterThan(pizza!.y);
  await page.screenshot({ path: resolve(pasta, "bi-pizza-faturamento-1440.png"), fullPage: true, animations: "disabled" });
});

test("celular com toque preserva alvos e consultas", async ({ browser, baseURL }, info) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1 });
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(new URL("/bi-vendas.html", baseURL).toString());
    await expect(pagina.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await auditarPagina(pagina, info, "celular-toque");
    await pagina.screenshot({ path: resolve(pasta, "bi-390-toque.png"), fullPage: true, animations: "disabled" });
    await pagina.getByRole("button", { name: "Mais filtros", exact: true }).tap();
    await expect(pagina.getByRole("dialog")).toBeVisible();
    await auditarPagina(pagina, info, "painel-celular-toque");
  } finally {
    await contexto.close();
  }
});


test("Dashboard apresenta sete indicadores e mantém recorrência com tempo médio", async ({ page }) => {
  await page.goto("/bi-vendas.html");
  for (const nome of ["Faturamento", "Descontos", "Pedidos", "Ticket médio", "Clientes compradores", "Clientes recorrentes", "Frete"]) await expect(page.getByRole("heading", { name: nome, exact: true })).toBeVisible();
  await expect(page.getByText("Tempo médio de recompra: 46,5 dias", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clientes que mais compram", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qualidade dos dados", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Caminho", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Data de referência", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver ranking de clientes", exact: true }).click();
  await expect(page).toHaveURL(/aba=clientes/);
  await expect(page.getByRole("columnheader", { name: "Tipo", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Pedidos", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Recorrência", exact: true })).toHaveCount(0);
});

test("ordenação e Tipo preservam período, contagens e exportação", async ({ page }) => {
  await page.goto("/bi-vendas.html?canal=site&de=2026-02-01&ate=2026-05-31");
  await page.getByRole("tab", { name: "Produtos", exact: true }).click();
  const receita = page.getByRole("columnheader", { name: "Receita líquida", exact: true });
  await expect(receita).toHaveAttribute("aria-sort", "descending");
  await receita.getByRole("button").click();
  await expect(receita).toHaveAttribute("aria-sort", "ascending");
  await expect(page).toHaveURL(/direcaoProdutos=asc/);
  await page.getByRole("tab", { name: "Clientes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Todos (14)", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pessoa jurídica (5)", exact: true }).click();
  await expect(page).toHaveURL(/tipoCliente=PJ/);
  await expect(page.getByRole("button", { name: "Todos (14)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pessoa física (8)", exact: true })).toBeVisible();
  const nome = page.getByRole("columnheader", { name: "Cliente", exact: true });
  await nome.getByRole("button").click();
  await expect(nome).toHaveAttribute("aria-sort", "ascending");
  const exportacao = new URL(await page.getByRole("link", { name: "Exportar", exact: true }).getAttribute("href") ?? "", page.url());
  for (const [chave, valor] of Object.entries({ tipoCliente:"PJ", ordemClientes:"nome", direcaoClientes:"asc", canal:"site", de:"2026-02-01", ate:"2026-05-31" })) expect(exportacao.searchParams.get(chave)).toBe(valor);
  await page.getByRole("tab", { name: "Entregas", exact: true }).click();
  const frete = page.getByRole("columnheader", { name: "Frete", exact: true });
  await frete.getByRole("button").click();
  await expect(frete).toHaveAttribute("aria-sort", "ascending");
  await expect(page).toHaveURL(/ordemEntregas=frete/);
});

test("descontos e tempo médio desconhecidos não aparecem como zero", async ({ page }) => {
  await page.goto("/bi-vendas.html?estado=desconhecido");
  await expect(page.getByRole("heading", { name: "Descontos", exact: true }).locator("..").locator("..")).toContainText("Não apurado");
  await expect(page.getByText("Tempo médio de recompra: Não apurado", { exact: true })).toBeVisible();
});


test("mapa carrega por ação explícita e descarta pontos ao trocar filtro", async ({ page }) => {
  await page.addInitScript(() => {
    const estado = { circulos: 0, removidos: 0, limites: [] as { lat: number; lng: number }[] };
    const alvo = window as unknown as { google: unknown; mapaSintetico: typeof estado };
    alvo.mapaSintetico = estado;
    alvo.google = { maps: {
      Map: class { fitBounds(limites: { pontos: { lat: number; lng: number }[] }) { estado.limites = [...limites.pontos]; } },
      LatLngBounds: class { pontos: { lat: number; lng: number }[] = []; extend(ponto: { lat: number; lng: number }) { this.pontos.push(ponto); } },
      Circle: class { constructor() { estado.circulos++; } setMap(mapa: unknown) { if (mapa === null) estado.removidos++; } },
      Polyline: class { setMap() {} },
    } };
  });
  let consultas = 0;
  await page.route("**/api/vendas/bi/mapa?**", async rota => {
    expect(rota.request().method()).toBe("POST");
    consultas++;
    const agora = new Date();
    const pontos = [
      { chave: "alfa", nome: "Região sintética Alfa", latitude: -23.54, longitude: -46.64, pedidos: 2, precisao: "bairro", origem: "GOOGLE_MAPS" },
      ...(consultas === 1 ? [{ chave: "beta", nome: "Região sintética Beta", latitude: -23.58, longitude: -46.67, pedidos: 1, precisao: "cep", origem: "GOOGLE_MAPS" }] : []),
    ];
    await rota.fulfill({ json: {
      estado: "parcial", pontos, totalEntregas: 6, entregasLocalizadas: consultas === 1 ? 3 : 2, totalGrupos: 3, gruposConsultados: pontos.length, limiteGrupos: 10,
      atualizadoEm: agora.toISOString(), validoAte: new Date(agora.getTime() + 600000).toISOString(), avisos: ["Amostra sintética agregada; nenhuma consulta ao Google."],
    } });
  });
  await page.goto("/bi-vendas.html?mapa=sintetico");
  await expect(page.getByRole("button", { name: "Carregar mapa de calor", exact: true })).toBeVisible();
  expect(consultas).toBe(0);
  await page.getByRole("button", { name: "Carregar mapa de calor", exact: true }).click();
  await expect(page.getByRole("img", { name: /Concentração aproximada de entregas/ })).toBeVisible();
  await expect(page.getByText(/3\/6 entregas representadas/)).toBeVisible();
  await expect(page.getByText(/Cobertura parcial\./).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { mapaSintetico: { circulos: number } }).mapaSintetico.circulos)).toBe(12);
  expect(consultas).toBe(1);
  await page.getByRole("button", { name: "Atualizar mapa de calor", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { mapaSintetico: { circulos: number } }).mapaSintetico.circulos)).toBe(18);
  const limites = await page.evaluate(() => (window as unknown as { mapaSintetico: { limites: { lat: number; lng: number }[] } }).mapaSintetico.limites);
  expect(limites).toHaveLength(2);
  expect(limites[0].lat).toBeLessThan(-23.55); expect(limites[1].lat).toBeGreaterThan(-23.53);
  expect(limites[0].lng).toBeLessThan(-46.65); expect(limites[1].lng).toBeGreaterThan(-46.63);
  expect(consultas).toBe(2);
  await page.getByRole("combobox", { name: "Canal", exact: true }).click();
  await page.getByRole("option", { name: "iFood", exact: true }).click();
  await expect(page).toHaveURL(/canal=ifood/);
  await expect(page.getByRole("img", { name: /Concentração aproximada de entregas/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Carregar mapa de calor", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { mapaSintetico: { removidos: number } }).mapaSintetico.removidos)).toBe(18);
  expect(consultas).toBe(2);
});

test("faixa de CEP aplica somente valores completos e preserva agrupamento", async ({ page }) => {
  await page.goto("/bi-vendas.html");
  await page.getByRole("combobox", { name: "Agrupar entregas por", exact: true }).click();
  await page.getByRole("option", { name: "Faixa de CEP", exact: true }).click();
  await expect(page).toHaveURL(/agrupamentoRegiao=cep/);
  await page.getByRole("button", { name: "Mais filtros", exact: true }).click();
  const inicio = page.getByRole("textbox", { name: "CEP inicial", exact: true });
  await inicio.fill("01234");
  await inicio.press("e");
  await expect(inicio).toHaveValue("01234");
  await expect(page.getByRole("button", { name: "Aplicar filtros", exact: true })).toBeDisabled();
  await inicio.fill("01234000");
  await page.getByRole("textbox", { name: "CEP final", exact: true }).fill("09999999");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(/cepDe=01234000/);
  await expect(page).toHaveURL(/cepAte=09999999/);
  await page.getByRole("tab", { name: "Entregas", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Faixa de CEP", exact: true })).toBeVisible();
  const exportacao = new URL(await page.getByRole("link", { name: "Exportar", exact: true }).getAttribute("href") ?? "", page.url());
  expect(exportacao.searchParams.get("agrupamentoRegiao")).toBe("cep");
  expect(exportacao.searchParams.get("cepDe")).toBe("01234000");
  expect(exportacao.searchParams.get("cepAte")).toBe("09999999");
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByText("CEP: 01234000 — 09999999", { exact: true })).toHaveCount(0);
});

test("Canal apresenta Site, iFood e GF e preserva a identidade na URL e na exportação", async ({ page }) => {
  await page.goto("/bi-vendas.html?de=2026-01-01&ate=2026-09-30");
  await page.getByRole("combobox", { name: "Canal", exact: true }).click();
  for (const nome of ["Site", "iFood", "GF", "Não identificado"]) await expect(page.getByRole("option", { name: nome, exact: true })).toBeVisible();
  await page.getByRole("option", { name: "GF", exact: true }).click();
  await expect(page).toHaveURL(/canal=gf/);
  await expect(page.getByRole("combobox", { name: "Canal", exact: true })).toContainText("GF");
  await expect(page.getByText("Canal: GF", { exact: true })).toBeVisible();
  const url = new URL(await page.getByRole("link", { name: "Exportar", exact: true }).getAttribute("href") ?? "", page.url());
  expect(url.searchParams.get("canal")).toBe("gf"); expect(url.searchParams.get("de")).toBe("2026-01-01"); expect(url.searchParams.get("ate")).toBe("2026-09-30");
});

test("detalhamento de pedidos identifica o faturamento com frete", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 941 });
  await page.goto("/bi-vendas.html");
  await page.getByRole("button", { name: "Ver pedidos", exact: true }).click();
  const painel = page.getByRole("dialog", { name: "Pedidos da seleção" });
  await expect(painel.getByRole("columnheader", { name: "Faturamento", exact: true })).toBeVisible();
  await expect(painel.getByText(/de faturamento \(inclui frete\)/)).toBeVisible();
  await page.screenshot({ path: resolve(pasta, "pedidos-faturamento-390.png"), fullPage: true });
});

test("busca cliente pelo nome e mantém ID nos filtros, URL e CSV", async ({ page }, info) => {
  await page.goto("/bi-vendas.html?aba=clientes&pagina=3&de=2026-01-01&ate=2026-09-30");
  const busca = page.getByRole("combobox", { name: "Cliente comprador", exact: true });
  await busca.fill("  COMPRADOR SINTETICO 4  ");
  await expect(page.getByRole("option", { name: "Comprador sintético 4", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Comprador sintético 5", exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/cliente=/);
  await page.getByRole("option", { name: "Comprador sintético 4", exact: true }).click();
  await expect(page).toHaveURL(/cliente=cliente-3/);
  await expect(page).toHaveURL(/pagina=1/);
  await expect(busca).toHaveValue("Comprador sintético 4");
  await expect(page.getByRole("cell", { name: "Comprador sintético 5", exact: true })).toHaveCount(0);
  let exportacao = new URL(await page.getByRole("link", { name: "Exportar", exact: true }).getAttribute("href") ?? "", page.url());
  expect(exportacao.searchParams.get("cliente")).toBe("cliente-3");
  expect(exportacao.searchParams.get("de")).toBe("2026-01-01");
  await page.getByRole("columnheader", { name: /Pedidos/ }).getByRole("button").click();
  await expect(page).toHaveURL(/ordemClientes=compras/);
  await expect(page).toHaveURL(/cliente=cliente-3/);
  await auditarPagina(page, info, "cliente-selecionado");
  await page.getByRole("button", { name: "Limpar filtro de cliente", exact: true }).click();
  await expect(page).not.toHaveURL(/cliente=/);
  await expect(busca).toHaveValue("");
  exportacao = new URL(await page.getByRole("link", { name: "Exportar", exact: true }).getAttribute("href") ?? "", page.url());
  expect(exportacao.searchParams.has("cliente")).toBe(false);
});

test("busca de cliente em Mais filtros aplica e descarta o rascunho", async ({ page }) => {
  await page.goto("/bi-vendas.html?aba=produtos");
  await page.getByRole("button", { name: "Mais filtros", exact: true }).click();
  const painel = page.getByRole("dialog", { name: "Mais filtros" });
  const busca = painel.getByRole("combobox", { name: "Cliente comprador", exact: true });
  await busca.fill("sintetico 4");
  await page.getByRole("option", { name: "Comprador sintético 4", exact: true }).click();
  await expect(page).not.toHaveURL(/cliente=/);
  await painel.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("button", { name: "Mais filtros", exact: true }).click();
  await expect(busca).toHaveValue("");
  await busca.fill("sintético 5");
  await page.getByRole("option", { name: "Comprador sintético 5", exact: true }).click();
  await painel.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(/cliente=cliente-4/);
  await page.getByRole("tab", { name: "Clientes", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Cliente comprador", exact: true })).toHaveValue("Comprador sintético 5");
});
