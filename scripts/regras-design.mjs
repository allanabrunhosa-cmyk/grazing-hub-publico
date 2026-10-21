import ts from "typescript";
import { posix } from "node:path";

/** Regras de apresentação; não inspeciona valores de domínio, XML, ZPL ou cálculos. */
export function analisarDesign(arquivo, conteudo) {
  const fonte = ts.createSourceFile(arquivo, conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const problemas = [];
  const acaoPorIcone = new Map([["Pencil", "editar"], ["PencilLine", "editar"], ["Trash", "excluir"], ["Trash2", "excluir"]]);
  for (const stmt of fonte.statements) {
    if (!ts.isImportDeclaration(stmt) || stmt.moduleSpecifier.text !== "lucide-react") continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
      const acao = acaoPorIcone.get(item.propertyName?.text ?? item.name.text);
      if (acao) acaoPorIcone.set(item.name.text, acao);
    }
  }
  function apontar(node, regra, mensagem) {
    problemas.push({ arquivo, linha: fonte.getLineAndCharacterOfPosition(node.getStart(fonte)).line + 1, regra, mensagem });
  }
  function atributo(no, nome) { return no.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === nome); }
  function valor(no, nome) {
    const init = atributo(no, nome)?.initializer;
    if (!init) return "";
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) return init.expression.text;
    return init.getText(fonte);
  }
  function visitar(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const nome = node.tagName.getText(fonte);
      if (["Input", "InputComSufixo", "Texto", "input"].includes(nome) && valor(node, "type") === "number") {
        const passo = valor(node, "step");
        if (valor(node, "inputMode") === "decimal" || valor(node, "restricao") === "decimal" || (passo && !Number.isInteger(Number(passo.replace(/[{}]/g, ""))))) {
          apontar(node, "decimal-localizado", 'Decimais devem usar Input com inputMode="decimal", precisão e limite explícitos, para aceitar ,5 como 0,5. Reserve type="number" aos inteiros.');
        }
      }
      if (nome === "Button" || nome === "button") {
        const variante = valor(node, "variant"), classe = valor(node, "className");
        const compacta = variante === "editar" || variante === "excluir";
        const container = ts.isJsxOpeningElement(node) ? node.parent : node;
        const filhos = ts.isJsxElement(container) ? container.children : [];
        const icones = filhos.flatMap(f => ts.isJsxSelfClosingElement(f) ? [acaoPorIcone.get(f.tagName.getText(fonte))] : []).filter(Boolean);
        if (icones.length && (nome === "button" || valor(node, "size").startsWith("icon")) && !compacta) {
          apontar(node, "acao-duplicada", `Use Button variant="${icones[0]}" para a ação compacta.`);
        }
        if (compacta && /(?:^|[\s"'`:])(?:size-|[wh]-|min-[wh]-|max-[wh]-|rounded|bg-|text-(?:\[|red|amber|yellow)|border-(?:red|amber|yellow))/.test(classe)) {
          apontar(node, "acao-geometria", "Não sobrescreva dimensão, círculo ou cor da ação compacta; ajuste o token comum.");
        }
        if (/(?:bg|text|border)-\[#[\da-fA-F]{3,8}\]/.test(classe) || /#[\da-fA-F]{3,8}\b/.test(valor(node, "style"))) {
          apontar(node, "cor-avulsa", "Use a variante semântica/token do botão, não uma cor HEX local.");
        }
      }
    }
    ts.forEachChild(node, visitar);
  }
  visitar(fonte);
  return problemas;
}

/**
 * Auditoria incremental: somente contratos comprováveis pela AST, com identidade
 * independente da linha para a linha de base. Não substitui inspeção no navegador.
 * Expressões dinâmicas, referências aria-labelledby e title exigem validação visual/DOM.
 */
export function analisarQualidadeVisual(arquivo, conteudo) {
  const caminho = arquivo.replaceAll("\\", "/");
  if (/(?:^|\/)src\/components\/ui\//.test(caminho)) return [];
  const fonte = ts.createSourceFile(arquivo, conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const desconhecido = Symbol("dinâmico");
  const escopos = new Map();
  const problemas = [];
  const impressora = ts.createPrinter({ removeComments: true });
  const nomesIcones = new Map([["Pencil", "editar"], ["PencilLine", "editar"], ["Trash", "excluir"], ["Trash2", "excluir"]]);
  const componentes = new Map([["button", new Set(["Button"])], ["input", new Set(["Input"])], ["select", new Set(["Select", "SelectTrigger", "SelectValue", "SelectContent", "SelectItem"])], ["textarea", new Set(["Textarea"])]]);

  function declarar(nome, vinculo, escopo) {
    if (ts.isIdentifier(nome)) escopos.get(escopo).set(nome.text, vinculo);
    else if (ts.isObjectBindingPattern(nome) || ts.isArrayBindingPattern(nome)) {
      for (const item of nome.elements) if (ts.isBindingElement(item)) declarar(item.name, {}, escopo);
    }
  }
  function mapear(node, escopo) {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) declarar(node.name, {}, escopo);
    if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isFunctionLike(node) || ts.isCatchClause(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      escopo = node;
      escopos.set(node, new Map());
      if (ts.isFunctionLike(node)) for (const parametro of node.parameters) declarar(parametro.name, {}, escopo);
      if (ts.isCatchClause(node) && node.variableDeclaration) declarar(node.variableDeclaration.name, {}, escopo);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
      const modulo = node.moduleSpecifier.text;
      const bindings = node.importClause?.namedBindings;
      if (node.importClause?.name) declarar(node.importClause.name, { modulo, nome: "default" }, escopo);
      if (bindings && ts.isNamespaceImport(bindings)) declarar(bindings.name, { modulo, namespace: true }, escopo);
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        if (!item.isTypeOnly) declarar(item.name, { modulo, nome: item.propertyName?.text ?? item.name.text }, escopo);
      }
    }
    if (ts.isVariableDeclaration(node)) declarar(node.name, { inicializador: node.initializer, constante: !!(node.parent.flags & ts.NodeFlags.Const) }, escopo);
    ts.forEachChild(node, filho => mapear(filho, escopo));
  }
  mapear(fonte, fonte);

  function vinculo(nome, node) {
    for (let atual = node; atual; atual = atual.parent) {
      if (escopos.get(atual)?.has(nome)) return escopos.get(atual).get(nome);
    }
  }
  function importado(node) {
    if (ts.isIdentifier(node)) return vinculo(node.text, node);
    if (ts.isPropertyAccessExpression(node) || ts.isJsxNamespacedName(node)) {
      const base = ts.isPropertyAccessExpression(node) ? node.expression : node.namespace;
      if (ts.isIdentifier(base)) {
        const item = vinculo(base.text, node);
        if (item?.namespace) return { modulo: item.modulo, nome: node.name.text };
      }
    }
  }
  function tipoOficial(item) {
    if (!item?.modulo) return undefined;
    const destino = item.modulo.startsWith("@/") ? `src/${item.modulo.slice(2)}` : item.modulo.startsWith(".") ? posix.normalize(posix.join(posix.dirname(caminho), item.modulo)) : "";
    const tipo = destino.match(/(?:^|\/)src\/components\/ui\/(button|input|select|textarea)(?:\.[cm]?[jt]sx?)?$/)?.[1];
    return tipo && componentes.get(tipo)?.has(item.nome) ? tipo : undefined;
  }
  function funcaoClasses(node) {
    const item = importado(node);
    return item && (["cn", "clsx", "classnames"].includes(item.modulo) || /(?:^|\/)lib\/utils$/.test(item.modulo)) && ["cn", "clsx", "default"].includes(item.nome);
  }
  function desembrulhar(node) {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
    return node;
  }
  function classesDeValor(valor) {
    if (Array.isArray(valor)) return valor.flatMap(classesDeValor);
    if (valor && typeof valor === "object") return Object.entries(valor).filter(([, ativo]) => ativo).map(([classe]) => classe);
    return typeof valor === "string" || typeof valor === "number" ? [String(valor)] : [];
  }
  function chavePropriedade(nome, vistos) {
    if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) return nome.text;
    return ts.isComputedPropertyName(nome) ? resolver(nome.expression, vistos) : desconhecido;
  }
  function resolver(node, vistos = new Set()) {
    node = desembrulhar(node);
    if (!node || vistos.has(node)) return desconhecido;
    vistos = new Set(vistos).add(node);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined" && !vinculo(node.text, node)) return undefined;
      const item = vinculo(node.text, node);
      return item?.constante && item.inicializador ? resolver(item.inicializador, vistos) : desconhecido;
    }
    if (ts.isTemplateExpression(node)) {
      let texto = node.head.text;
      for (const parte of node.templateSpans) {
        const valor = resolver(parte.expression, vistos);
        if (valor === desconhecido || (valor !== null && typeof valor === "object")) return desconhecido;
        texto += String(valor) + parte.literal.text;
      }
      return texto;
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const valor = resolver(node.operand, vistos);
      if (valor === desconhecido) return desconhecido;
      if (node.operator === ts.SyntaxKind.ExclamationToken) return !valor;
      if (node.operator === ts.SyntaxKind.MinusToken && typeof valor === "number") return -valor;
    }
    if (ts.isConditionalExpression(node)) {
      const condicao = resolver(node.condition, vistos);
      return condicao === desconhecido ? desconhecido : resolver(condicao ? node.whenTrue : node.whenFalse, vistos);
    }
    if (ts.isBinaryExpression(node)) {
      const esquerda = resolver(node.left, vistos);
      if (esquerda === desconhecido) return desconhecido;
      const operador = node.operatorToken.kind;
      if (operador === ts.SyntaxKind.AmpersandAmpersandToken) return esquerda ? resolver(node.right, vistos) : esquerda;
      if (operador === ts.SyntaxKind.BarBarToken) return esquerda || resolver(node.right, vistos);
      if (operador === ts.SyntaxKind.QuestionQuestionToken) return esquerda ?? resolver(node.right, vistos);
      const direita = resolver(node.right, vistos);
      if (operador === ts.SyntaxKind.PlusToken && direita !== desconhecido && [esquerda, direita].every(v => typeof v === "string" || typeof v === "number")) return esquerda + direita;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const valores = node.elements.map(item => resolver(item, vistos));
      return valores.includes(desconhecido) ? desconhecido : valores;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const objeto = {};
      for (const item of node.properties) {
        if (!ts.isPropertyAssignment(item) && !ts.isShorthandPropertyAssignment(item)) return desconhecido;
        const chave = chavePropriedade(item.name, vistos);
        const valor = resolver(ts.isPropertyAssignment(item) ? item.initializer : item.name, vistos);
        if (typeof chave !== "string" || valor === desconhecido) return desconhecido;
        objeto[chave] = valor;
      }
      return objeto;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const objeto = resolver(node.expression, vistos);
      const chave = ts.isPropertyAccessExpression(node) ? node.name.text : resolver(node.argumentExpression, vistos);
      if (objeto && typeof objeto === "object" && (typeof chave === "string" || typeof chave === "number")) return Object.hasOwn(objeto, chave) ? objeto[chave] : undefined;
    }
    if (ts.isCallExpression(node) && funcaoClasses(node.expression)) {
      const valores = node.arguments.map(item => resolver(item, vistos));
      return valores.includes(desconhecido) ? desconhecido : valores.flatMap(classesDeValor).join(" ");
    }
    return desconhecido;
  }
  function classesPossiveis(node, vistos = new Set()) {
    node = desembrulhar(node);
    if (!node || vistos.has(node)) return [];
    const valor = resolver(node);
    if (valor !== desconhecido) return classesDeValor(valor);
    vistos = new Set(vistos).add(node);
    if (ts.isIdentifier(node)) {
      const item = vinculo(node.text, node);
      return item?.constante ? classesPossiveis(item.inicializador, vistos) : [];
    }
    if (ts.isCallExpression(node) && funcaoClasses(node.expression)) return node.arguments.flatMap(item => classesPossiveis(item, vistos));
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(item => classesPossiveis(item, vistos));
    if (ts.isConditionalExpression(node)) return [node.whenTrue, node.whenFalse].flatMap(item => classesPossiveis(item, vistos));
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return classesPossiveis(node.right, vistos);
    if (ts.isObjectLiteralExpression(node)) return node.properties.flatMap(item => {
      if (!ts.isPropertyAssignment(item)) return [];
      const chave = chavePropriedade(item.name, new Set());
      return typeof chave === "string" && resolver(item.initializer) !== false ? [chave] : [];
    });
    return [];
  }
  function atributos(node) {
    const mapa = new Map();
    for (const item of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(item)) {
        // O spread pode sobrescrever atributos anteriores. Não presumir o valor.
        for (const chave of mapa.keys()) mapa.set(chave, desconhecido);
        mapa.set("...", desconhecido);
      } else mapa.set(item.name.getText(fonte), item.initializer ? ts.isJsxExpression(item.initializer) ? item.initializer.expression ?? desconhecido : item.initializer : true);
    }
    return mapa;
  }
  function valorAtributo(mapa, nome) {
    const node = mapa.get(nome);
    if (node === desconhecido || (!mapa.has(nome) && mapa.has("..."))) return desconhecido;
    if (node === true) return true;
    return node ? resolver(node) : undefined;
  }
  function textoFilhos(node) {
    const container = ts.isJsxOpeningElement(node) ? node.parent : node;
    const partes = [];
    let dinamico = false;
    function texto(filho) {
      if (ts.isJsxText(filho)) partes.push(filho.text);
      else if (ts.isJsxElement(filho) || ts.isJsxFragment(filho)) filho.children.forEach(texto);
      else if (ts.isJsxExpression(filho) && filho.expression) {
        if (ts.isJsxElement(filho.expression) || ts.isJsxFragment(filho.expression)) texto(filho.expression);
        else {
          const valor = resolver(filho.expression);
          if (valor === desconhecido) dinamico = true;
          else if (typeof valor === "string" || typeof valor === "number") partes.push(String(valor));
        }
      }
    }
    if (ts.isJsxElement(container)) container.children.forEach(texto);
    return { valor: partes.join(" ").replace(/\s+/g, " ").trim(), dinamico };
  }
  function identificar(node, mapa, texto) {
    const pares = [...mapa.entries()].filter(([chave]) => chave !== "...").sort(([a], [b]) => a.localeCompare(b)).map(([chave, valor]) => {
      const resolvido = valor === desconhecido ? desconhecido : valor === true ? true : resolver(valor);
      return `${chave}=${resolvido !== desconhecido ? JSON.stringify(resolvido) : valor === desconhecido ? "<spread>" : impressora.printNode(ts.EmitHint.Unspecified, valor, fonte).replace(/\s+/g, " ").trim()}`;
    });
    const classes = mapa.get("className");
    const classesConhecidas = classes && classes !== desconhecido && classes !== true ? classesPossiveis(classes).flatMap(valor => valor.split(/\s+/)).filter(Boolean).sort() : [];
    return `${node.tagName.getText(fonte)}|${mapa.has("...") ? "...|" : ""}${pares.join("|")}|classes=${JSON.stringify(classesConhecidas)}|texto=${JSON.stringify(texto)}`;
  }
  function apontar(node, regra, mensagem, mapa, texto) {
    problemas.push({ arquivo: caminho, linha: fonte.getLineAndCharacterOfPosition(node.getStart(fonte)).line + 1, regra, mensagem, identidade: identificar(node, mapa, texto) });
  }
  function utilitario(classe) {
    let profundidade = 0, inicio = 0;
    for (let i = 0; i < classe.length; i++) {
      if (classe[i] === "[" || classe[i] === "(") profundidade++;
      else if (classe[i] === "]" || classe[i] === ")") profundidade--;
      else if (classe[i] === ":" && profundidade === 0 && classe[i - 1] !== "\\") inicio = i + 1;
    }
    return { valor: classe.slice(inicio).replace(/^!|!$/g, ""), variante: classe.slice(0, inicio) };
  }
  function corLiteral(classe) {
    return /^(?:bg|text|border(?:-[xytrbl])?|ring|outline|fill|stroke|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)(?:\/.*)?$/.test(classe) || /^(?:bg|text|border|ring|outline|fill|stroke)-\[(?:color:)?(?:#[\da-f]+|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\()/i.test(classe);
  }
  function visitar(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const nome = node.tagName.getText(fonte), item = importado(node.tagName), mapa = atributos(node), texto = textoFilhos(node);
      const tipo = tipoOficial(item);
      const oficial = !!tipo;
      const nativo = ["button", "input", "select", "textarea"].includes(nome);
      if (nativo && !(nome === "input" && valorAtributo(mapa, "type") === "hidden")) apontar(node, "controle-nativo", `Reutilize o controle oficial para ${nome}; exceções compartilhadas devem ser documentadas no inventário.`, mapa, texto.valor);
      if (oficial && tipo === "input" && valorAtributo(mapa, "type") === "number") {
        const passo = valorAtributo(mapa, "step");
        if (valorAtributo(mapa, "inputMode") === "decimal" || valorAtributo(mapa, "restricao") === "decimal" || (passo !== desconhecido && passo != null && !Number.isInteger(Number(passo)))) apontar(node, "decimal-localizado", "Reutilize Input decimal com precisão e limite explícitos; type=number fica reservado a inteiros.", mapa, texto.valor);
      }
      if ((oficial && tipo === "button") || nome === "button") {
        const variante = valorAtributo(mapa, "variant"), tamanho = valorAtributo(mapa, "size");
        const aria = valorAtributo(mapa, "aria-label"), titulo = valorAtributo(mapa, "title");
        const rotulo = aria ?? titulo ?? (texto.dinamico ? desconhecido : texto.valor);
        const compacta = variante === "editar" || variante === "excluir" || (typeof rotulo === "string" && /^(remover|retirar|excluir)\b/i.test(rotulo));
        const icone = typeof tamanho === "string" && tamanho.startsWith("icon");
        const classesNode = mapa.get("className");
        const classes = classesNode && classesNode !== desconhecido && classesNode !== true ? classesPossiveis(classesNode).flatMap(valor => valor.split(/\s+/)).map(utilitario).filter(classe => !/\[.*(?:&_svg|&_svg\b).*\]/.test(classe.variante)) : [];
        if (classes.some(classe => corLiteral(classe.valor))) apontar(node, "cor-local-em-botao", "Use a variante semântica e os tokens existentes; paletas Tailwind ou cores CSS literais locais sobrescrevem o botão oficial.", mapa, texto.valor);
        const estilo = valorAtributo(mapa, "style");
        if (estilo && estilo !== desconhecido && typeof estilo === "object" && Object.entries(estilo).some(([chave, valor]) => /(?:color|background|fill|stroke)$/i.test(chave) && typeof valor === "string" && /^(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()/i.test(valor))) apontar(node, "cor-local-em-botao", "Use tokens existentes nas cores do estilo do botão oficial.", mapa, texto.valor);
        if (compacta && classes.some(classe => /^(?:size-|[wh]-|min-[wh]-|max-[wh]-|rounded(?:-|$)|p[xytrblse]?-|bg-(?!clip-)|text-(?:\[|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-))/.test(classe.valor))) apontar(node, "geometria-acao-compacta", "Não sobrescreva dimensão, padding, círculo ou cor da ação compacta; reutilize seu contrato/token compartilhado.", mapa, texto.valor);
        if (compacta || icone) {
          const nomes = ["aria-label", "aria-labelledby", "title"].map(chave => valorAtributo(mapa, chave));
          const explicito = nomes.some(valor => valor === desconhecido || typeof valor === "string" && valor.trim() && !/^(editar|excluir|remover|retirar)$/i.test(valor.trim()));
          const contextoFilhos = variante !== "editar" && !texto.dinamico && texto.valor && !/^(editar|excluir|remover|retirar)$/i.test(texto.valor);
          if (!explicito && !contextoFilhos) apontar(node, compacta ? "acao-compacta-sem-contexto" : "acao-compacta-sem-nome", compacta ? "Declare nome contextual por aria-label/aria-labelledby/title; o fallback Editar/Excluir não identifica o item. Title e referências ARIA ainda precisam de validação no DOM." : "Declare nome acessível no botão de ícone por texto contextual/aria-label/aria-labelledby/title e confira no DOM.", mapa, texto.valor);
        }
        if (!compacta && (icone || nome === "button")) {
          const container = ts.isJsxOpeningElement(node) ? node.parent : node;
          let acao;
          function procurarIcone(filho) {
            if (ts.isJsxSelfClosingElement(filho) || ts.isJsxOpeningElement(filho)) {
              const importacao = importado(filho.tagName);
              if (importacao?.modulo === "lucide-react") acao ??= nomesIcones.get(importacao.nome);
            }
            ts.forEachChild(filho, procurarIcone);
          }
          ts.forEachChild(container, procurarIcone);
          if (acao) apontar(node, "acao-compacta-duplicada", `Reutilize Button variant="${acao}" para a ação compacta; ícones aninhados/aliases não criam outra variante.`, mapa, texto.valor);
        }
        if (oficial && !texto.dinamico && texto.valor === "Confirmar" && variante !== desconhecido && !["entrada", "entrada-outline", "saida", "saida-outline", "destructive"].includes(variante)) apontar(node, "confirmacao-sem-semantica", "Confirmar exige variante semântica: entrada verde para confirmação positiva; saida/destructive vermelha para operação destrutiva. Não inferir intenção pela cor local.", mapa, texto.valor);
      }
    }
    ts.forEachChild(node, visitar);
  }
  visitar(fonte);
  return problemas;
}
