// @vitest-environment jsdom
import { optimize } from "@tailwindcss/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { declaracoesCssTema } from "@/lib/design-system/gerar-css";
import { configuracaoPreviaValida } from "@/lib/design-system/previa";
import { REGISTRO_TOKENS, VALORES_FABRICA } from "@/lib/design-system/registro";
import { resolverTema } from "@/lib/design-system/resolver-tema";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
function bloco(seletor: string) {
  const inicio = css.indexOf(`\n${seletor} {`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  return css.slice(inicio, css.indexOf("}", inicio));
}
function variavel(conteudo: string, nome: string) {
  const valor = conteudo.match(new RegExp(`${nome}:\\s*(#[a-fA-F0-9]{6});`))?.[1];
  expect(valor, nome).toBeDefined();
  return valor!;
}
function luminancia(hex: string) {
  const componentes = [1, 3, 5].map(inicio => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
    .map(valor => valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4);
  return componentes[0] * 0.2126 + componentes[1] * 0.7152 + componentes[2] * 0.0722;
}
function contraste(texto: string, fundo: string) {
  const valores = [luminancia(texto), luminancia(fundo)].sort((a, b) => b - a);
  return (valores[0] + 0.05) / (valores[1] + 0.05);
}

describe("identidade verde dentro dos contratos da Central", () => {
  it("tem tokens fechados claro/escuro e completa temas publicados anteriores", () => {
    const legado = resolverTema({ "cor.hub.primariaClara": "#0b5fc4" });
    expect(legado["cor.pedidos.primariaClara"]).toBe(VALORES_FABRICA["cor.pedidos.primariaClara"]);
    expect(declaracoesCssTema()).toContainEqual({ propriedade: "--ds-pedidos-primaria-clara", valor: legado["cor.pedidos.primariaClara"] });
    for (const chave of ["cor.pedidos.primariaClara", "cor.pedidos.primariaEscura"] as const) {
      const escuro = chave.endsWith("Escura");
      const fundo = variavel(bloco(escuro ? '.dark [data-identidade="pedidos"]' : '[data-identidade="pedidos"]'), "--primary-foreground");
      for (const cor of REGISTRO_TOKENS[chave].opcoes) expect(contraste(cor, fundo), `${chave}: ${cor}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("prévia aceita Pedidos sem ampliar identidades fora do catálogo", () => {
    const previa = { canal: "grazing-design-lab", tipo: "configurar", padrao: "status-ativo", identidade: "pedidos", modo: "escuro", estado: "normal", aplicado: false, reinicio: 0, valores: VALORES_FABRICA };
    expect(configuracaoPreviaValida(previa)).toBe(true);
    expect(configuracaoPreviaValida({ ...previa, identidade: "livre" })).toBe(false);
  });
  it("identidade modifica cores e conserva geometria compartilhada", () => {
    const claros = bloco('[data-identidade="pedidos"]');
    const escuros = bloco('.dark [data-identidade="pedidos"]');
    expect(claros).toContain("--primary: var(--ds-pedidos-primaria-clara)");
    expect(escuros).toContain("--primary: var(--ds-pedidos-primaria-escura)");
    expect(claros + escuros).not.toMatch(/--ds-(controle|menu|cartao|botao|fonte)/);
  });
  it.each([":root", ".dark"])("pares de processo têm contraste textual suficiente em %s", seletor => {
    const conteudo = bloco(seletor);
    for (const status of ["rota", "entregue"]) {
      expect(contraste(variavel(conteudo, `--ds-processo-${status}`), variavel(conteudo, `--ds-processo-${status}-fundo`))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

it("preserva o desfoque padrão de Pedidos após a otimização usada em produção", () => {
  const superficies = css.slice(css.indexOf("/* Acabamento de vidro exclusivo"));
  const otimizado = Buffer.from(optimize(superficies, { minify: true }).code).toString();
  const regra = otimizado.slice(0, otimizado.indexOf("}") + 1);
  expect(regra).toMatch(/[;{]backdrop-filter:blur\(var\(--ds-vidro-desfoque\)\)/);
});

it.each([
  ["quadros", "--ds-pedidos-primaria-clara", "#166534", "rgb(22, 101, 52)"],
  ["calendario", "--color-blue-600", "#2563eb", "rgb(37, 99, 235)"],
  ["lista", "--color-violet-600", "#7c3aed", "rgb(124, 58, 237)"],
])("o seletor %s mantém sua cor em repouso acima do vidro, inclusive após otimização", (modo, token, cor, esperado) => {
  const variante = css.slice(css.indexOf("\n.ds-seletor-visualizacao"), css.indexOf("/* Identidade exclusiva do hostname de Etiquetas"));
  const superficies = css.slice(css.indexOf("/* Acabamento de vidro exclusivo"));
  for (const minificar of [false, true]) {
    const fonte = variante + superficies;
    const estilos = minificar ? Buffer.from(optimize(fonte, { minify: true }).code).toString() : fonte;
    // JSDOM não resolve custom properties: valores fictícios preservam seletores,
    // ordem e especificidade reais. A seleção do token é conferida separadamente.
    const resolvido = estilos.replaceAll("var(--visualizacao-cor)", cor)
      .replaceAll("var(--vidro-fundo)", "#ffffff").replaceAll("var(--vidro-borda)", "#eeeeee")
      .replaceAll("var(--brand-white)", "#ffffff");
    const fixture = document.createElement("div");
    fixture.innerHTML = `<style>${resolvido}</style><div data-identidade="pedidos"><button class="bg-card ds-seletor-visualizacao" data-slot="select-trigger" data-modo="${modo}">${modo}</button></div>`;
    document.body.appendChild(fixture);
    const gatilho = fixture.querySelector("button")!;
    const computado = window.getComputedStyle(gatilho);
    expect(computado.getPropertyValue("--visualizacao-cor").trim()).toBe(`var(${token})`);
    expect(computado.backgroundColor).toBe(esperado);
    expect(computado.color).toBe("rgb(255, 255, 255)");
    expect(computado.borderColor).toBe(esperado);
    fixture.remove();
  }
});
