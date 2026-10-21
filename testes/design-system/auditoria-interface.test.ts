// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";

function retangulo(elemento: Element, x = 0, y = 0, largura = 120, altura = 44) {
  const caixa = new DOMRect(x, y, largura, altura);
  vi.spyOn(elemento, "getBoundingClientRect").mockReturnValue(caixa);
  vi.spyOn(elemento, "getClientRects").mockReturnValue([caixa] as unknown as DOMRectList);
}

function pagina(html: string) {
  document.body.innerHTML = html;
  for (const elemento of document.querySelectorAll("*")) retangulo(elemento);
}

function regras() {
  return auditarInterface(document).problemas.map((problema: { regra: string }) => problema.regra);
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(390);
  vi.spyOn(document.documentElement, "scrollWidth", "get").mockReturnValue(390);
  vi.spyOn(document.body, "scrollWidth", "get").mockReturnValue(390);
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false })) });
});

describe("diagnóstico da interface renderizada", () => {
  it("detecta overflow do documento e permite tabela com rolagem interna", () => {
    pagina('<div style="overflow-x:auto"><table><tbody><tr><td>Colunas contábeis</td></tr></tbody></table></div>');
    retangulo(document.querySelector("table")!, 0, 0, 900, 44);
    expect(regras()).not.toContain("overflow-documento");
    vi.spyOn(document.documentElement, "scrollWidth", "get").mockReturnValue(470);
    expect(auditarInterface(document).problemas).toContainEqual(expect.objectContaining({ regra: "overflow-documento", mensagem: expect.stringContaining("80px"), elemento: "html" }));
  });

  it("tolera até 2px de arredondamento na largura global", () => {
    pagina("<p>Conteúdo</p>");
    vi.spyOn(document.documentElement, "scrollWidth", "get").mockReturnValue(392);
    expect(regras()).not.toContain("overflow-documento");
  });

  it("detecta ícone sem nome e aceita texto, aria, imagem e submit", () => {
    pagina('<button id="sem-nome"><svg></svg></button><button>Salvar</button><button aria-label="Excluir"><svg></svg></button><button><img alt="Abrir ficha"></button><input type="submit" value="Confirmar"><input type="submit"><input type="image" alt="Enviar">');
    const resultado = auditarInterface(document);
    expect(resultado.verificacoes.botoesVisiveis).toBe(7);
    expect(resultado.problemas).toHaveLength(1);
    expect(resultado.problemas[0]).toMatchObject({ regra: "botao-sem-nome", elemento: 'button[id="sem-nome"]' });
  });

  it("resolve aria-labelledby com múltiplas referências, inclusive texto oculto", () => {
    pagina('<span id="acao" hidden>Excluir</span><span id="item">item do rascunho</span><button aria-labelledby="acao item"><svg></svg></button><button aria-labelledby="id-inexistente"><svg></svg></button>');
    const resultado = auditarInterface(document);
    expect(resultado.verificacoes.botoesVisiveis).toBe(2);
    expect(resultado.problemas.filter((problema: { regra: string }) => problema.regra === "botao-sem-nome")).toHaveLength(1);
  });

  it("ignora conteúdo aria-hidden no nome e não aceita somente tooltip", () => {
    pagina('<button><span aria-hidden="true">X</span></button><button title="Excluir"><svg></svg></button><button><span style="display:none">Salvar</span><svg></svg></button>');
    expect(regras()).toEqual(["botao-sem-nome", "botao-sem-nome", "botao-sem-nome"]);
  });

  it("ignora controles invisíveis, ancestrais ocultos e inputs hidden do Base UI", () => {
    pagina('<button hidden><svg></svg></button><div style="display:none"><input></div><div style="visibility:hidden"><button><svg></svg></button></div><input type="hidden"><button id="sem-caixa"><svg></svg></button>');
    vi.spyOn(document.querySelector("#sem-caixa")!, "getClientRects").mockReturnValue([] as unknown as DOMRectList);
    expect(auditarInterface(document)).toMatchObject({ verificacoes: { botoesVisiveis: 0, camposVisiveis: 0 }, problemas: [] });
  });

  it("ignora o input text totalmente recortado do Select Base UI sem ignorar aria-hidden visível", () => {
    pagina('<input id="base-ui-hidden" type="text" aria-hidden="true" tabindex="-1" style="clip-path:inset(50%);overflow:hidden;width:1px;height:1px;margin:-1px;position:fixed;top:0;left:0"><input id="visivel" aria-hidden="true">');
    retangulo(document.querySelector("#base-ui-hidden")!, 0, 0, 1, 1);
    const resultado = auditarInterface(document);
    expect(resultado.verificacoes.camposVisiveis).toBe(1);
    expect(resultado.problemas).toEqual([expect.objectContaining({ regra: "campo-sem-rotulo", elemento: 'input[id="visivel"]' })]);
  });

  it("preserva rótulos sr-only e não trata recorte parcial como invisibilidade", () => {
    pagina('<label for="nome" style="clip-path:inset(50%)">Nome</label><input id="nome"><input id="parcial" style="clip-path:inset(20%)"><div style="clip-path:inset(50% 50%)"><input></div>');
    const resultado = auditarInterface(document);
    expect(resultado.verificacoes.camposVisiveis).toBe(2);
    expect(resultado.problemas).toEqual([expect.objectContaining({ regra: "campo-sem-rotulo", elemento: 'input[id="parcial"]' })]);
  });

  it("aceita label explícito, label envolvente e referências aria de campos", () => {
    pagina('<label for="nome">Nome</label><input id="nome"><label>Quantidade<input></label><select aria-label="Categoria"><option>Teste</option></select><span id="observacoes" hidden>Observações</span><textarea aria-labelledby="observacoes"></textarea>');
    expect(auditarInterface(document)).toMatchObject({ verificacoes: { camposVisiveis: 4 }, problemas: [] });
  });

  it("exige rótulos em campos somente leitura/desabilitados e não usa placeholder", () => {
    pagina('<input placeholder="Nome"><textarea readonly></textarea><select disabled><option>Indisponível</option></select>');
    expect(regras()).toEqual(["campo-sem-rotulo", "campo-sem-rotulo", "campo-sem-rotulo"]);
  });

  it("compara centros dos botões, aceitando alturas diferentes e tolerância de 2px", () => {
    pagina('<div class="ds-grupo-acoes"><button id="principal">Salvar</button><button id="compacto" aria-label="Cancelar"><svg></svg></button></div>');
    retangulo(document.querySelector("#principal")!, 0, 0, 120, 44);
    retangulo(document.querySelector("#compacto")!, 128, 4, 36, 36);
    expect(regras()).not.toContain("acoes-desalinhadas");
    retangulo(document.querySelector("#compacto")!, 128, 6, 36, 36);
    expect(regras()).not.toContain("acoes-desalinhadas");
    retangulo(document.querySelector("#compacto")!, 128, 8, 36, 36);
    expect(regras()).toContain("acoes-desalinhadas");
  });

  it("permite flex-wrap e detecta desalinhamento dentro de uma das linhas", () => {
    pagina('<div class="ds-grupo-acoes"><button id="a">Salvar</button><button id="b">Cancelar</button><button id="c">Ajuda</button></div>');
    retangulo(document.querySelector("#a")!, 0, 0, 120, 44);
    retangulo(document.querySelector("#b")!, 0, 52, 120, 44);
    retangulo(document.querySelector("#c")!, 128, 52, 120, 44);
    expect(regras()).not.toContain("acoes-desalinhadas");
    retangulo(document.querySelector("#c")!, 128, 58, 120, 44);
    expect(regras()).toContain("acoes-desalinhadas");
  });

  it("não compara ações que pertencem a grupos descendentes diferentes", () => {
    pagina('<div class="ds-grupo-acoes"><div class="ds-grupo-acoes"><button id="a">Salvar</button></div><div class="ds-grupo-acoes"><button id="b">Cancelar</button></div></div>');
    retangulo(document.querySelector("#a")!, 0, 0, 120, 44);
    retangulo(document.querySelector("#b")!, 128, 10, 120, 44);
    expect(regras()).not.toContain("acoes-desalinhadas");
  });

  it("verifica o contrato de 44px de ações/status/Button no modo de toque", () => {
    pagina('<button class="ds-acao-compacta" id="compacto" aria-label="Excluir"><svg></svg></button><button data-slot="button" id="oficial">Salvar</button><button class="ds-status" id="status" aria-label="Ativo"></button>');
    retangulo(document.querySelector("#compacto")!, 0, 0, 36, 36);
    retangulo(document.querySelector("#oficial")!, 44, 0, 120, 44);
    retangulo(document.querySelector("#status")!, 172, 0, 43, 44);
    expect(auditarInterface(document).verificacoes.alvosCompactos).toBe(0);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true })) });
    const resultado = auditarInterface(document);
    expect(resultado.verificacoes).toMatchObject({ alvosCompactos: 3, ponteiroGrosso: true });
    expect(resultado.problemas.filter((problema: { regra: string }) => problema.regra === "alvo-toque-pequeno")).toHaveLength(2);
  });

  it("informa suporte ausente a matchMedia e não infere modo de toque", () => {
    pagina('<button data-slot="button">Salvar</button>');
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    expect(auditarInterface(document)).toMatchObject({ verificacoes: { ponteiroGrosso: null, alvosCompactos: 0 }, problemas: [] });
  });

  it("retorna diagnóstico serializável e não altera DOM, valores ou foco", () => {
    pagina('<label for="seguro">Campo</label><input id="seguro" value="Texto fictício"><button><svg></svg></button>');
    const campo = document.querySelector<HTMLInputElement>("#seguro")!;
    campo.focus();
    const antes = document.documentElement.outerHTML;
    const resultado = auditarInterface(document);
    expect(JSON.parse(JSON.stringify(resultado))).toEqual(resultado);
    expect(document.documentElement.outerHTML).toBe(antes);
    expect(campo.value).toBe("Texto fictício");
    expect(document.activeElement).toBe(campo);
  });

  it("rejeita entrada sem documento renderizável", () => {
    expect(() => auditarInterface(null)).toThrow("Document com janela e layout");
  });
});

it("detecta até 1px de rolagem nas abas e nos botões, sem bloquear tabelas",()=>{
 pagina('<div role="tablist" style="overflow-y:auto"><button>Imprimir</button></div><button id="rolavel" style="overflow-x:auto">Ação</button><div style="overflow:auto"><table></table></div>');
 const abas=document.querySelector('[role="tablist"]')!,botao=document.querySelector('#rolavel')!;
 vi.spyOn(abas,"clientHeight","get").mockReturnValue(38);vi.spyOn(abas,"scrollHeight","get").mockReturnValue(39);
 vi.spyOn(botao,"clientWidth","get").mockReturnValue(100);vi.spyOn(botao,"scrollWidth","get").mockReturnValue(120);
 expect(regras().filter(r=>r==="rolagem-controle")).toHaveLength(2);
});
