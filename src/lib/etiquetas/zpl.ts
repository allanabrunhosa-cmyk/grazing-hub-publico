import { obterModeloLayout, comporEtiqueta, validarConteudoNoLayout } from "@/lib/etiquetas/layout";
import { logoGrazingZpl } from "@/lib/etiquetas/logo-grazing-zpl";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { sanitizarTextoZpl } from "@/lib/etiquetas/texto";
import { dimensionarFonte0 } from "@/lib/etiquetas/fonte-zpl";
import { codigoSerializado } from "@/lib/etiquetas/rastreio";
export { sanitizarTextoZpl } from "@/lib/etiquetas/texto";

function pontos(mm: number, resolucaoDpi: number) {
  return Math.round(mm * (resolucaoDpi / 25.4));
}

export function gerarZplEtiqueta(dados: DadosEtiqueta) {
  validarConteudoNoLayout(dados);
  const modelo = obterModeloLayout(dados.tamanho);
  const largura = pontos(modelo.larguraMm, dados.resolucaoDpi);
  const altura = pontos(modelo.alturaMm, dados.resolucaoDpi);
  const comandos: string[] = [
    "^XA",
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
    const { larguraFonte } = dimensionarFonte0(linha.texto, linha.larguraLetra);
    // ^SN incrementa apenas o sufixo numérico de cada cópia (^PQ, replicação 1).
    // O formato fica compacto: logo e layout não são repetidos no transporte USB.
    const campo = linha.chave === "codigo" && codigoSerializado(dados.codigoRastreio)
      ? `^SN${linha.texto},1,Y^FS`
      : `^FD${linha.texto}^FS`;
    comandos.push(
      `^FO${linha.x},${linha.y}`,
      `^A0N,${linha.fonte},${larguraFonte}`,
      campo,
    );
    if (linha.negrito) {
      comandos.push(`^FO${linha.x + 1},${linha.y}`, `^A0N,${linha.fonte},${larguraFonte}`, campo);
    }
  }

  const logo = logoGrazingZpl(dados.resolucaoDpi, dados.tamanho === "MM_60X40");
  const totalBytes = logo.hexadecimal.length / 2;
  comandos.push(
    `^FO${composicao.logo.x},${composicao.logo.y}`,
    `^GFA,${totalBytes},${totalBytes},${logo.bytesPorLinha},${logo.hexadecimal}^FS`,
  );

  comandos.push(`^PQ${dados.copias},0,1,N`, "^XZ");
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
