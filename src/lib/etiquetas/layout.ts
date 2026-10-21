import { conservacoesEtiqueta, type DadosEtiqueta, type TamanhoEtiquetaValor } from "@/lib/etiquetas/tipos";
import { sanitizarTextoZpl } from "@/lib/etiquetas/texto";
import { enderecoDaEtiqueta } from "@/lib/etiquetas/endereco";
import { dimensionarFonte0 } from "@/lib/etiquetas/fonte-zpl";

export class ErroLayoutEtiqueta extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroLayoutEtiqueta";
  }
}

export type LinhaCompostaEtiqueta = {
  chave: string;
  texto: string;
  x: number;
  y: number;
  fonte: number;
  larguraLetra: number;
  negrito?: boolean;
};

export type ModeloLayoutEtiqueta = {
  larguraMm: 60;
  alturaMm: 40 | 60;
  margemMm: number;
  maximoCaracteresProduto: number;
  maximoLinhasProduto: number;
};

export type ComposicaoEtiqueta = {
  linhas: LinhaCompostaEtiqueta[];
  divisorias: { chave: string; x1: number; x2: number; y: number; espessura: number }[];
  logo: { x: number; y: number; largura: number; altura: number };
};

const BASE = {
  larguraMm: 60 as const,
  margemMm: 2,
  maximoCaracteresProduto: 58,
};

// Avanço médio usado para compor a prévia e reservar a área de cada linha.
// A largura da célula ^A0 é calculada separadamente em fonte-zpl.ts.
const FATOR_LARGURA_FONTE_ZPL = 0.66;

export const MODELOS_LAYOUT_ETIQUETA: Record<TamanhoEtiquetaValor, ModeloLayoutEtiqueta> = {
  MM_60X40: { ...BASE, alturaMm: 40, maximoLinhasProduto: 2 },
  MM_60X60: { ...BASE, alturaMm: 60, maximoCaracteresProduto: 86, maximoLinhasProduto: 3 },
};

export function obterModeloLayout(tamanho: TamanhoEtiquetaValor) {
  return MODELOS_LAYOUT_ETIQUETA[tamanho];
}

function pontos(mm: number, resolucaoDpi: number) {
  return Math.round(mm * resolucaoDpi / 25.4);
}

function dataNoPadraoFoodcamp(iso: string, fusoHorario: string, mostrarHora: boolean) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoHorario,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: mostrarHora ? "2-digit" : undefined,
    minute: mostrarHora ? "2-digit" : undefined,
    hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]));
  const data = `${partes.day}/${partes.month}/${partes.year}`;
  return mostrarHora ? `${data} - ${partes.hour}H${partes.minute}` : data;
}

export function textosDaEtiqueta(dados: DadosEtiqueta) {
  return {
    produto: dados.produtoNome.toLocaleUpperCase("pt-BR"),
    conservacao: conservacoesEtiqueta.find((item) => item.valor === dados.conservacao)?.rotuloEtiqueta ?? (dados.conservacao === "APOS_ABERTO" ? "APÓS ABERTO" : dados.conservacao),
    manipulacao: dataNoPadraoFoodcamp(dados.manipuladoEm, dados.fusoHorario, dados.mostrarHora),
    validade: dataNoPadraoFoodcamp(dados.validoAte, dados.fusoHorario, dados.mostrarHora),
    marcaFornecedor: dados.marcaFornecedor?.toLocaleUpperCase("pt-BR") ?? "",
    sif: dados.sif ?? "",
    medida: dados.quantidade ? `${dados.quantidade.replace(".", ",")} ${dados.unidade.toLocaleUpperCase("pt-BR")}` : "",
    lote: dados.lote ?? "",
    responsavel: dados.responsavelManipulacao.toLocaleUpperCase("pt-BR"),
    loja: dados.lojaNome.toLocaleUpperCase("pt-BR"),
    cnpj: dados.lojaCnpj ? `CNPJ: ${dados.lojaCnpj}` : "",
    endereco: dados.lojaEndereco ? `END.: ${dados.lojaEndereco.replace(/\bavenida\b\.?/gi, "Av.")}` : "",
    codigo: `#${(dados.codigoRastreio || "000000").toLocaleUpperCase("pt-BR")}`,
  };
}

function linhaAjustada({
  chave, texto, xMm, yMm, larguraMm, fonteMm, minimoMm, dpi, negrito = false, alinharDireita = false,
}: {
  chave: string;
  texto: string;
  xMm: number;
  yMm: number;
  larguraMm: number;
  fonteMm: number;
  minimoMm: number;
  dpi: number;
  negrito?: boolean;
  alinharDireita?: boolean;
}): LinhaCompostaEtiqueta {
  const seguro = sanitizarTextoZpl(texto);
  const larguraMaxima = pontos(larguraMm, dpi);
  let fonte = pontos(fonteMm, dpi);
  const minimo = pontos(minimoMm, dpi);
  let larguraLetra = Math.max(1, Math.round(fonte * FATOR_LARGURA_FONTE_ZPL));
  while (seguro.length * larguraLetra > larguraMaxima && fonte > minimo) {
    fonte -= 1;
    larguraLetra = Math.max(1, Math.round(fonte * FATOR_LARGURA_FONTE_ZPL));
  }
  if (seguro.length * larguraLetra > larguraMaxima) {
    throw new ErroLayoutEtiqueta(chave === "endereco"
      ? "O endereço da loja não cabe com legibilidade na etiqueta. Abrevie o endereço no cadastro da empresa."
      : `O campo ${chave} não cabe com legibilidade na etiqueta. Reduza o texto informado.`);
  }
  const xBase = pontos(xMm, dpi);
  return {
    chave,
    texto: seguro,
    x: alinharDireita ? xBase + larguraMaxima - seguro.length * larguraLetra : xBase,
    y: pontos(yMm, dpi),
    fonte,
    larguraLetra,
    negrito,
  };
}

function produtoEmLinhas(dados: DadosEtiqueta, larguraMm: number, alturaMm: number, maximoLinhas: number): LinhaCompostaEtiqueta[] {
  const texto = sanitizarTextoZpl(textosDaEtiqueta(dados).produto);
  const dpi = dados.resolucaoDpi;
  const minimo = pontos(dados.tamanho === "MM_60X40" ? 2.8 : 3.2, dpi);
  for (let fonte = pontos(dados.tamanho === "MM_60X40" ? 3.7 : 4.2, dpi); fonte >= minimo; fonte -= 1) {
    const larguraLetra = Math.max(1, Math.round(fonte * FATOR_LARGURA_FONTE_ZPL));
    const capacidade = Math.floor(pontos(larguraMm, dpi) / larguraLetra);
    const partes: string[] = [];
    let restante = texto;
    while (restante.length > capacidade) {
      const espaco = restante.lastIndexOf(" ", capacidade);
      const corte = espaco > 0 ? espaco : capacidade;
      partes.push(restante.slice(0, corte));
      restante = restante.slice(corte).trimStart();
    }
    if (restante) partes.push(restante);
    const entrelinhas = Math.max(1, pontos(0.25, dpi));
    if (partes.length <= maximoLinhas && partes.length * fonte + (partes.length - 1) * entrelinhas <= pontos(alturaMm, dpi)) {
      return partes.map((parte, indice) => ({
        chave: `produto-${indice}`,
        texto: parte,
        x: pontos(2, dpi),
        y: pontos(dados.tamanho === "MM_60X40" ? 1.5 : 2, dpi) + indice * (fonte + entrelinhas),
        fonte,
        larguraLetra,
        negrito: true,
      } satisfies LinhaCompostaEtiqueta));
    }
  }
  throw new ErroLayoutEtiqueta(`O nome do produto não cabe com legibilidade em 60×${dados.tamanho === "MM_60X40" ? 40 : 60} mm.`);
}

function enderecoEmLinhas(dados: DadosEtiqueta): LinhaCompostaEtiqueta[] {
  if (!dados.lojaEndereco) return [];
  const { cep, endereco, cidadeUf } = enderecoDaEtiqueta(dados.lojaEndereco);
  const dpi = dados.resolucaoDpi;
  const largura = pontos(38.5, dpi);
  const textoEndereco = endereco ? sanitizarTextoZpl(`END.: ${endereco}`) : "";
  const textoCep = sanitizarTextoZpl(cep);
  const textoCidade = sanitizarTextoZpl(cidadeUf);
  // Quatro linhas entre o CNPJ e o rastreio: CEP, até duas de endereço e cidade/UF.
  // A coluna fica à esquerda do logo e mantém a mesma composição na prévia e no ZPL.
  for (let fonte = pontos(1.5, dpi); fonte >= pontos(1.25, dpi); fonte -= 1) {
    const larguraLetra = Math.max(1, Math.round(fonte * FATOR_LARGURA_FONTE_ZPL));
    const capacidade = Math.floor(largura / larguraLetra);
    const partes: string[] = [];
    let restante = textoEndereco;
    while (restante.length > capacidade) {
      const espaco = restante.lastIndexOf(" ", capacidade);
      const corte = espaco > 0 ? espaco : capacidade;
      partes.push(restante.slice(0, corte));
      restante = restante.slice(corte).trimStart();
    }
    if (restante) partes.push(restante);
    if (partes.length > 2 || textoCep.length > capacidade || textoCidade.length > capacidade) continue;
    const textos = [
      ...(textoCep ? [{ chave: "endereco-cep", texto: textoCep }] : []),
      ...partes.map((texto, indice) => ({ chave: `endereco-${indice}`, texto })),
      ...(textoCidade ? [{ chave: "endereco-cidade", texto: textoCidade }] : []),
    ];
    const passo = fonte + Math.max(1, pontos(0.2, dpi));
    return textos.map((linha, indice) => ({ ...linha, x: pontos(2, dpi), y: pontos(48.8, dpi) + indice * passo, fonte, larguraLetra }));
  }
  throw new ErroLayoutEtiqueta("O endereço completo não cabe com legibilidade em 60×60 mm. Revise os dados do endereço antes de emitir.");
}

export function comporEtiqueta(dados: DadosEtiqueta): ComposicaoEtiqueta {
  const modelo = obterModeloLayout(dados.tamanho);
  const dpi = dados.resolucaoDpi;
  const textos = textosDaEtiqueta(dados);
  const compacto = dados.tamanho === "MM_60X40";
  const linhas = produtoEmLinhas(dados, 56, compacto ? 6.5 : 9, modelo.maximoLinhasProduto);

  linhas.push(linhaAjustada({
    chave: "conservacao",
    texto: textos.conservacao,
    xMm: 2,
    yMm: compacto ? 8 : 11,
    larguraMm: 56,
    fonteMm: compacto ? 2.25 : 2.7,
    minimoMm: 1.8,
    dpi,
  }));

  const campos = [
    ["manipulacao", "MANIPULAÇÃO:", textos.manipulacao],
    ["validade", "VALIDADE:", textos.validade],
    ["marca", "MARCA/FORN.:", textos.marcaFornecedor],
    ["sif", "SIF:", textos.sif],
    ["medida", "MEDIDA:", textos.medida],
    ["lote", "LOTE:", textos.lote],
  ].filter(([, , valor], indice) => indice < 2 || Boolean(valor));
  const inicioMm = compacto ? 12.2 : 15.8;
  const passoMm = compacto ? 2.45 : 3.45;
  const fonteMm = compacto ? 2.2 : 2.8;
  const larguraRotuloMm = compacto ? 22 : 24;
  campos.forEach(([chave, rotulo, valor], indice) => {
    const yMm = inicioMm + indice * passoMm;
    linhas.push(linhaAjustada({ chave: `${chave}-rotulo`, texto: rotulo, xMm: 2, yMm, larguraMm: larguraRotuloMm, fonteMm, minimoMm: 1.55, dpi, negrito: true }));
    // Os valores ficam alinhados à direita, como no modelo Foodcamp, para
    // manter datas e números visualmente organizados no mesmo eixo.
    linhas.push(linhaAjustada({ chave: `${chave}-valor`, texto: valor, xMm: larguraRotuloMm + 1, yMm, larguraMm: 57 - larguraRotuloMm, fonteMm, minimoMm: 1.5, dpi, alinharDireita: true }));
  });

  const limiteRodapeMm = compacto ? 41.5 : 40.5;
  const yRodapeMm = compacto ? 28.8 : 40;
  linhas.push(linhaAjustada({ chave: "responsavel-rotulo", texto: "RESP.:", xMm: 2, yMm: yRodapeMm, larguraMm: 10, fonteMm: compacto ? 2.05 : 2.55, minimoMm: 1.7, dpi, negrito: true }));
  linhas.push(linhaAjustada({ chave: "responsavel-valor", texto: textos.responsavel, xMm: compacto ? 12 : 14, yMm: yRodapeMm, larguraMm: limiteRodapeMm - (compacto ? 12 : 14), fonteMm: compacto ? 1.95 : 2.35, minimoMm: 1.3, dpi }));
  linhas.push(linhaAjustada({ chave: "loja", texto: textos.loja, xMm: 2, yMm: yRodapeMm + (compacto ? 2.35 : 3.4), larguraMm: limiteRodapeMm - 2, fonteMm: compacto ? 1.75 : 2.1, minimoMm: 1.35, dpi, negrito: true }));
  if (textos.cnpj) linhas.push(linhaAjustada({ chave: "cnpj", texto: textos.cnpj, xMm: 2, yMm: yRodapeMm + (compacto ? 4.35 : 6.25), larguraMm: limiteRodapeMm - 2, fonteMm: compacto ? 1.55 : 1.9, minimoMm: 1.2, dpi }));
  if (compacto && textos.endereco) linhas.push(linhaAjustada({ chave: "endereco", texto: textos.endereco, xMm: 2, yMm: yRodapeMm + 6.3, larguraMm: limiteRodapeMm - 2, fonteMm: 1.35, minimoMm: 1.05, dpi }));
  if (!compacto) linhas.push(...enderecoEmLinhas(dados));
  linhas.push(linhaAjustada({ chave: "codigo", texto: textos.codigo, xMm: 2, yMm: compacto ? 37 : 56.2, larguraMm: 18, fonteMm: compacto ? 1.65 : 2.1, minimoMm: 1.3, dpi, negrito: true }));

  for (const linha of linhas) {
    if (dimensionarFonte0(linha.texto, linha.larguraLetra).larguraTexto > linha.texto.length * linha.larguraLetra + 1) {
      throw new ErroLayoutEtiqueta(`O campo ${linha.chave} não cabe na largura mínima da fonte da impressora. Reduza o texto informado.`);
    }
  }

  return {
    linhas,
    divisorias: [
      { chave: "superior", x1: pontos(2, dpi), x2: pontos(58, dpi), y: pontos(compacto ? 10.8 : 14.2, dpi), espessura: Math.max(1, pontos(0.18, dpi)) },
      { chave: "inferior", x1: pontos(2, dpi), x2: pontos(58, dpi), y: pontos(compacto ? 27.4 : 38, dpi), espessura: Math.max(1, pontos(0.18, dpi)) },
    ],
    logo: {
      x: pontos(compacto ? 46 : 44.5, dpi),
      y: pontos(compacto ? 27.7 : 41.5, dpi),
      largura: pontos(compacto ? 12 : 13.5, dpi),
      altura: pontos((compacto ? 12 : 13.5) * 709 / 717, dpi),
    },
  };
}

export function comporLinhasEtiqueta(dados: DadosEtiqueta) {
  return comporEtiqueta(dados).linhas;
}

export function validarConteudoNoLayout(dados: DadosEtiqueta) {
  const modelo = obterModeloLayout(dados.tamanho);
  if (dados.produtoNome.length > modelo.maximoCaracteresProduto) {
    throw new ErroLayoutEtiqueta(dados.tamanho === "MM_60X40"
      ? "O nome do produto não cabe com legibilidade em 60×40 mm. Selecione 60×60 mm."
      : "O nome do produto é longo demais para a etiqueta 60×60 mm. Abrevie o cadastro antes de emitir.");
  }
  if (dados.responsavelManipulacao.length > 48) {
    throw new ErroLayoutEtiqueta("O nome da pessoa responsável é longo demais para a etiqueta. Use uma identificação menor.");
  }
  comporEtiqueta(dados);
}
