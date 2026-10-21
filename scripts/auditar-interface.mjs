/**
 * Diagnóstico síncrono e somente leitura do documento renderizado.
 * Não certifica acessibilidade: nomes são uma aproximação das fontes abaixo;
 * foco, teclado, contraste composto e qualidade visual exigem validação própria.
 * Execute depois de fontes/layout estabilizarem, em cada cenário/largura/tema.
 * Todas as dependências ficam nesta função para permitir sua execução no navegador.
 */
export function auditarInterface(documento) {
  const janela = documento?.defaultView;
  if (!documento?.documentElement || !janela?.getComputedStyle) {
    throw new TypeError("A auditoria precisa de um Document com janela e layout renderizado.");
  }

  const tolerancia = 2;
  const problemas = [];
  const ponteiroGrosso = typeof janela.matchMedia === "function"
    ? janela.matchMedia("(pointer: coarse)").matches
    : null;
  const verificacoes = {
    overflowDocumento: true,
    botoesVisiveis: 0,
    camposVisiveis: 0,
    gruposAcoes: 0,
    alvosCompactos: 0,
    ponteiroGrosso,
  };
  const seletorBotoes = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], input[type="image"]';
  const normalizar = valor => String(valor ?? "").replace(/\s+/g, " ").trim();

  // Identificador serializável; não inclui valores de campos nem seus textos.
  function identificar(elemento) {
    const partes = [];
    for (let atual = elemento; atual && partes.length < 5; atual = atual.parentElement) {
      let parte = atual.tagName.toLowerCase();
      if (atual.id) {
        parte += `[id=${JSON.stringify(atual.id)}]`;
        partes.unshift(parte);
        break;
      }
      const irmaos = atual.parentElement
        ? [...atual.parentElement.children].filter(filho => filho.tagName === atual.tagName)
        : [];
      if (irmaos.length > 1) parte += `:nth-of-type(${irmaos.indexOf(atual) + 1})`;
      partes.unshift(parte);
    }
    return partes.join(" > ");
  }

  function estiloOculto(elemento) {
    const estilo = janela.getComputedStyle(elemento);
    return elemento.hidden || estilo.display === "none" || estilo.visibility === "hidden" || estilo.visibility === "collapse";
  }

  function recorteTotal(elemento) {
    const recorte = janela.getComputedStyle(elemento).clipPath;
    const inset = /^inset\(([^()]*)\)$/.exec(recorte ?? "");
    if (!inset) return false;
    const lados = inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
    if (lados.length > 4 || lados.some(lado => !/^\d*\.?\d+%$/.test(lado))) return false;
    const [topo, direita = topo, baixo = topo, esquerda = direita] = lados.map(lado => +lado.slice(0, -1));
    return topo + baixo >= 100 || direita + esquerda >= 100;
  }

  function visivel(elemento) {
    if (!elemento.getClientRects().length) return false;
    const retangulo = elemento.getBoundingClientRect();
    if (retangulo.width <= 0 || retangulo.height <= 0) return false;
    for (let atual = elemento; atual; atual = atual.parentElement) {
      // Base UI usa um input text de 1px com inset(50%) para submissão nativa.
      // aria-hidden sozinho não prova invisibilidade de um controle renderizado.
      if (estiloOculto(atual) || recorteTotal(atual)) return false;
    }
    return true;
  }

  function textoAlternativo(elemento, referencia = false) {
    if (elemento.getAttribute("aria-hidden") === "true" && !referencia) return "";
    // Texto recortado (sr-only) pode fornecer o nome acessível do controle.
    if (!referencia && estiloOculto(elemento)) return "";
    const aria = normalizar(elemento.getAttribute("aria-label"));
    if (aria) return aria;
    if (elemento.tagName === "IMG") return normalizar(elemento.getAttribute("alt"));
    if (elemento.tagName === "SCRIPT" || elemento.tagName === "STYLE") return "";
    return normalizar([...elemento.childNodes].map(no => {
      if (no.nodeType === 3) return no.textContent;
      if (no.nodeType === 1) return textoAlternativo(no, referencia);
      return "";
    }).join(" "));
  }

  function nomeAria(elemento) {
    const referencias = normalizar(elemento.getAttribute("aria-labelledby"));
    if (referencias) {
      const nome = normalizar(referencias.split(" ").map(id => {
        const alvo = documento.getElementById(id);
        // Referências explícitas podem apontar para texto visualmente oculto.
        return alvo ? textoAlternativo(alvo, true) : "";
      }).join(" "));
      if (nome) return nome;
    }
    return normalizar(elemento.getAttribute("aria-label"));
  }

  function nomeBotao(elemento) {
    const aria = nomeAria(elemento);
    if (aria) return aria;
    if (elemento.tagName === "INPUT") {
      if (elemento.type === "image") return normalizar(elemento.alt);
      if (normalizar(elemento.value)) return normalizar(elemento.value);
      // Sem value, submit/reset têm um rótulo nativo fornecido pelo navegador.
      if (!elemento.hasAttribute("value") && ["submit", "reset"].includes(elemento.type)) return "Rótulo nativo";
    }
    // title isolado não satisfaz o contrato do HUB para ações só com ícone.
    return textoAlternativo(elemento);
  }

  function rotuloCampo(elemento) {
    return nomeAria(elemento) || normalizar([...elemento.labels ?? []]
      .map(label => textoAlternativo(label)).join(" "));
  }

  function registrar(regra, mensagem, elemento) {
    problemas.push({ regra, mensagem, elemento: identificar(elemento) });
  }

  const raiz = documento.documentElement;
  const largura = raiz.clientWidth || janela.innerWidth;
  const larguraConteudo = Math.max(raiz.scrollWidth, documento.body?.scrollWidth ?? 0, documento.scrollingElement?.scrollWidth ?? 0);
  if (largura > 0 && larguraConteudo - largura > tolerancia) {
    registrar("overflow-documento", `O documento excede a largura disponível em ${Math.round(larguraConteudo - largura)}px; mantenha a rolagem de tabelas dentro do seu contêiner.`, raiz);
  }

  for (const botao of documento.querySelectorAll(seletorBotoes)) {
    if (!visivel(botao)) continue;
    verificacoes.botoesVisiveis++;
    if (!nomeBotao(botao)) {
      registrar("botao-sem-nome", "Botão visível sem nome detectado por texto, aria-label, aria-labelledby, alt ou valor nativo; confira seu nome acessível.", botao);
    }
  }

  // Mesmo 1px de overflow pode desenhar setas nativas dentro das abas.
  for (const controle of documento.querySelectorAll(`${seletorBotoes}, [role="tablist"]`)) {
    if (!visivel(controle)) continue;
    const estilo = janela.getComputedStyle(controle);
    const rola = (eixo, conteudo, area) => eixo === "scroll" || eixo === "auto" && conteudo > area;
    if (rola(estilo.overflowX, controle.scrollWidth, controle.clientWidth) || rola(estilo.overflowY, controle.scrollHeight, controle.clientHeight)) {
      registrar("rolagem-controle", "Botão ou faixa de abas com rolagem interna; reorganize o conteúdo e preserve o rótulo completo.", controle);
    }
  }

  for (const campo of documento.querySelectorAll("input, select, textarea")) {
    if (campo.tagName === "INPUT" && ["hidden", "button", "submit", "reset", "image"].includes(campo.type)) continue;
    if (!visivel(campo)) continue;
    verificacoes.camposVisiveis++;
    if (!rotuloCampo(campo)) {
      registrar("campo-sem-rotulo", "Campo visível sem rótulo detectado por label associado, aria-label ou aria-labelledby; placeholder não substitui um rótulo.", campo);
    }
  }

  for (const grupo of documento.querySelectorAll(".ds-grupo-acoes")) {
    if (!visivel(grupo)) continue;
    verificacoes.gruposAcoes++;
    const botoes = [...grupo.querySelectorAll(seletorBotoes)]
      .filter(botao => botao.closest(".ds-grupo-acoes") === grupo && visivel(botao))
      .map(botao => botao.getBoundingClientRect());
    let diferenca = 0;
    for (let a = 0; a < botoes.length; a++) {
      for (let b = a + 1; b < botoes.length; b++) {
        const primeiro = botoes[a]; const segundo = botoes[b];
        const sobreposicao = Math.min(primeiro.bottom, segundo.bottom) - Math.max(primeiro.top, segundo.top);
        // Linhas de flex-wrap sem sobreposição vertical são independentes.
        if (sobreposicao <= tolerancia) continue;
        diferenca = Math.max(diferenca, Math.abs(primeiro.top + primeiro.height / 2 - segundo.top - segundo.height / 2));
      }
    }
    if (diferenca > tolerancia) {
      registrar("acoes-desalinhadas", `Botões da mesma linha têm eixos verticais diferentes em ${Math.round(diferenca * 10) / 10}px (tolerância de ${tolerancia}px); confira a composição do GrupoAcoes.`, grupo);
    }
  }

  if (ponteiroGrosso) {
    // O CSS oficial amplia ações compactas, status e todos os Button no toque.
    for (const alvo of documento.querySelectorAll('.ds-acao-compacta, .ds-status, [data-slot="button"]')) {
      if (!visivel(alvo)) continue;
      verificacoes.alvosCompactos++;
      const retangulo = alvo.getBoundingClientRect();
      if (retangulo.width < 44 || retangulo.height < 44) {
        registrar("alvo-toque-pequeno", `Alvo oficial de ${Math.round(retangulo.width)}×${Math.round(retangulo.height)}px no modo de toque; o contrato do HUB exige pelo menos 44×44px.`, alvo);
      }
    }
  }

  return { verificacoes, problemas };
}
