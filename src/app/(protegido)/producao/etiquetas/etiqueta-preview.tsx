import { comporEtiqueta, ErroLayoutEtiqueta, obterModeloLayout, type ComposicaoEtiqueta } from "@/lib/etiquetas/layout";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";

export function EtiquetaPreview({ dados }: { dados: DadosEtiqueta }) {
  const modelo = obterModeloLayout(dados.tamanho);
  const escala = dados.resolucaoDpi / 25.4;
  let composicao: ComposicaoEtiqueta;
  try {
    composicao = comporEtiqueta(dados);
  } catch (erro) {
    if (!(erro instanceof ErroLayoutEtiqueta)) throw erro;
    return <div role="alert" className="rounded-xl border bg-card p-4 text-sm">
      <p className="font-medium">Prévia indisponível</p>
      <p className="mt-2 text-destructive">{erro.message}</p>
    </div>;
  }
  return (
    <div className="mx-auto w-full max-w-[36rem] overflow-auto rounded-2xl bg-neutral-200 p-4 dark:bg-neutral-950">
      <svg
        className="mx-auto w-full max-w-[480px] bg-white text-black shadow-lg"
        role="img"
        viewBox={`0 0 ${Math.round(modelo.larguraMm * escala)} ${Math.round(modelo.alturaMm * escala)}`}
        aria-label={`Prévia de etiqueta ${modelo.larguraMm} por ${modelo.alturaMm} milímetros`}
      >
        {composicao.divisorias.map((linha) => <line key={linha.chave} x1={linha.x1} x2={linha.x2} y1={linha.y} y2={linha.y} stroke="currentColor" strokeWidth={linha.espessura} />)}
        {composicao.linhas.map((linha) => <text key={linha.chave} x={linha.x} y={linha.y + linha.fonte * 0.85}
          fontSize={linha.fonte} fontFamily="Arial, sans-serif"
          fontWeight={linha.negrito ? 700 : 400}
          textLength={linha.texto.length * linha.larguraLetra} lengthAdjust="spacingAndGlyphs">
          {linha.texto}
        </text>)}
        <image href="/marca/grazing-table-co-monocromatica.png" x={composicao.logo.x} y={composicao.logo.y} width={composicao.logo.largura} height={composicao.logo.altura} preserveAspectRatio="xMidYMid meet" />
      </svg>
      <p className="mt-3 text-center text-xs text-neutral-700 dark:text-neutral-300">
        Mesmos textos, divisórias e logo do ZPL. Confira a saída física na impressora.
      </p>
    </div>
  );
}
