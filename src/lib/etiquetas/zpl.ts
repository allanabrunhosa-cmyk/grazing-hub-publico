import { obterModeloLayout, comporEtiqueta, validarConteudoNoLayout, type LinhaCompostaEtiqueta } from "@/lib/etiquetas/layout";
import { logoGrazingZpl } from "@/lib/etiquetas/logo-grazing-zpl";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { sanitizarTextoZpl } from "@/lib/etiquetas/texto";
import { dimensionarFonte0 } from "@/lib/etiquetas/fonte-zpl";
import { codigoSerializado } from "@/lib/etiquetas/rastreio";
export { sanitizarTextoZpl } from "@/lib/etiquetas/texto";

function pontos(mm: number, resolucaoDpi: number) {
  return Math.round(mm * (resolucaoDpi / 25.4));
}

function validarCodigosDasCopias(dados: DadosEtiqueta) {
  const codigos = dados.codigosRastreio;
  if (codigos === undefined) return undefined;
  if (!Array.isArray(codigos) || !Number.isInteger(dados.copias) || dados.copias < 1
    || codigos.length !== dados.copias || codigos[0] !== dados.codigoRastreio
    || Array.from(codigos).some((codigo) => typeof codigo !== "string" || !/^[A-Z0-9]{6}$/.test(codigo))
    || new Set(codigos).size !== codigos.length) {
    throw new Error("Os códigos das etiquetas devem ser distintos, ter seis caracteres e corresponder às cópias.");
  }
  return codigos;
}

function comandosDaLinha(linha: LinhaCompostaEtiqueta, campo = `^FD${linha.texto}^FS`) {
  const { larguraFonte } = dimensionarFonte0(linha.texto, linha.larguraLetra);
  const comandos = [`^FO${linha.x},${linha.y}`, `^A0N,${linha.fonte},${larguraFonte}`, campo];
  if (linha.negrito) {
    comandos.push(`^FO${linha.x + 1},${linha.y}`, `^A0N,${linha.fonte},${larguraFonte}`, campo);
  }
  return comandos;
}

export function gerarZplEtiqueta(dados: DadosEtiqueta) {
  const codigos = validarCodigosDasCopias(dados);
  validarConteudoNoLayout(dados);
  // R: é RAM volátil. O pacote define seu próprio formato e o remove ao terminar.
  // O primeiro código identifica o lote sem sobrescrever formatos de outro envio.
  const formato = codigos ? `R:GV${codigos[0]}.ZPL` : undefined;
  const modelo = obterModeloLayout(dados.tamanho);
  const largura = pontos(modelo.larguraMm, dados.resolucaoDpi);
  const altura = pontos(modelo.alturaMm, dados.resolucaoDpi);
  const comandos: string[] = [
    "^XA",
    ...(formato ? [`^DF${formato}^FS`] : []),
    "^CI27",
    `^PW${largura}`,
    `^LL${altura}`,
    "^LH0,0",
  ];

  const composicao = comporEtiqueta(dados);
  for (const divisoria of composicao.divisorias) {
    comandos.push(`^FO${divisoria.x1},${divisoria.y}`, `^GB${divisoria.x2 - divisoria.x1},${divisoria.espessura},${divisoria.espessura}^FS`);
  }
  for (const linha of composicao.linhas) {
    if (codigos && linha.chave === "codigo") continue;
    // ^SN incrementa apenas o sufixo numérico de cada cópia (^PQ, replicação 1).
    // O formato fica compacto: logo e layout não são repetidos no transporte USB.
    const campo = linha.chave === "codigo" && codigoSerializado(dados.codigoRastreio)
      ? `^SN${linha.texto},1,Y^FS`
      : `^FD${linha.texto}^FS`;
    comandos.push(...comandosDaLinha(linha, campo));
  }

  const logo = logoGrazingZpl(dados.resolucaoDpi, dados.tamanho === "MM_60X40");
  const totalBytes = logo.hexadecimal.length / 2;
  comandos.push(
    `^FO${composicao.logo.x},${composicao.logo.y}`,
    `^GFA,${totalBytes},${totalBytes},${logo.bytesPorLinha},${logo.hexadecimal}^FS`,
  );

  if (codigos && formato) {
    const linhaCodigo = composicao.linhas.find((linha) => linha.chave === "codigo");
    if (!linhaCodigo) throw new Error("O layout da etiqueta deve incluir o código de rastreio.");
    // ^DF não imprime. Cada ^XF recebe seu código e imprime exatamente uma cópia.
    comandos.push("^XZ");
    for (const codigo of codigos) {
      // O código usa as mesmas métricas da prévia, sem depender dos demais códigos.
      comandos.push("^XA", `^XF${formato}^FS`, ...comandosDaLinha({ ...linhaCodigo, texto: `#${codigo}` }), "^PQ1,0,1,N", "^XZ");
    }
    // Excluir somente o objeto deste envio. Nunca usar curingas ou memória flash.
    comandos.push("^XA", `^ID${formato}^FS`, "^XZ");
  } else {
    comandos.push(`^PQ${dados.copias},0,1,N`, "^XZ");
  }
  return comandos.join("\n");
}

export function nomeArquivoZpl(produtoNome: string, id: string) {
  const seguro = sanitizarTextoZpl(produtoNome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "etiqueta";
  return `${seguro}-${id.slice(-8)}.zpl`;
}
