import { useId } from "react";
import type { resumirPerdas } from "@/lib/estoque/resumo-perdas";

type Motivo = ReturnType<typeof resumirPerdas>["motivos"][number];
const PALETA = ["var(--primary)", "var(--warning)", "var(--ds-processo-entregue)", "var(--success)", "var(--destructive)"];
const chaveDoMotivo = (motivo: Motivo) => "chave" in motivo ? motivo.chave! : motivo.motivo;
const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function caminhoFatia(inicio: number, percentual: number) {
  const ponto = (valor: number) => {
    const radianos = (valor / 100 * 360 - 90) * Math.PI / 180;
    return `${50 + 49 * Math.cos(radianos)} ${50 + 49 * Math.sin(radianos)}`;
  };
  return `M 50 50 L ${ponto(inicio)} A 49 49 0 ${percentual > 50 ? 1 : 0} 1 ${ponto(inicio + percentual)} Z`;
}

export function GraficoMotivosPerdas({ motivos, chavesReferencia }: { motivos: Motivo[]; chavesReferencia: string[] }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // O conjunto anterior ao filtro mantém a identidade visual quando muda o período.
  const chaves = [...new Set([...chavesReferencia, ...motivos.map(chaveDoMotivo)])].sort();
  const estilos = new Map(chaves.map((chave, indice) => [chave, { cor: PALETA[indice % PALETA.length], textura: Math.floor(indice / PALETA.length), id: `${id}-motivo-${indice}` }]));
  const positivos = motivos.filter(motivo => motivo.valor > 0);
  let inicio = 0;

  return <figure className="flex min-w-0 flex-wrap items-center gap-5">
    <svg viewBox="0 0 100 100" role="img" aria-label={positivos.length ? "Gráfico em pizza da participação dos motivos no valor das perdas. Valores detalhados na legenda." : "Gráfico sem valores positivos no período."} className="mx-auto size-28 shrink-0">
      <defs>{motivos.map(motivo => {
        const estilo = estilos.get(chaveDoMotivo(motivo))!;
        const tamanho = 6 + Math.floor((estilo.textura - 1) / 3) * 2;
        return <pattern key={estilo.id} id={estilo.id} width={Math.max(6, tamanho)} height={Math.max(6, tamanho)} patternUnits="userSpaceOnUse" patternTransform={estilo.textura % 3 === 1 ? "rotate(45)" : undefined}>
          <rect width="100%" height="100%" fill={estilo.cor} />
          {estilo.textura > 0 && (estilo.textura % 3 === 2
            ? <circle cx="3" cy="3" r="1.2" fill="var(--card)" />
            : <path d={estilo.textura % 3 === 0 ? `M 0 0 H ${tamanho} M 0 0 V ${tamanho}` : `M 0 0 V ${tamanho}`} stroke="var(--card)" strokeWidth="1.5" />)}
        </pattern>;
      })}</defs>
      {positivos.length ? positivos.map(motivo => {
        const estilo = estilos.get(chaveDoMotivo(motivo))!;
        const caminho = caminhoFatia(inicio, motivo.percentual);
        inicio += motivo.percentual;
        return positivos.length === 1
          ? <circle key={estilo.id} cx="50" cy="50" r="49" fill={`url(#${estilo.id})`} stroke="var(--card)" strokeWidth="1" />
          : <path key={estilo.id} d={caminho} fill={`url(#${estilo.id})`} stroke="var(--card)" strokeWidth="1" />;
      }) : <circle cx="50" cy="50" r="49" fill="var(--muted)" />}
    </svg>
    <figcaption className="min-w-0 flex-1 basis-32">
      {motivos.length ? <ul aria-label="Valores por motivo de perda" className="space-y-3">{motivos.map(motivo => {
        const estilo = estilos.get(chaveDoMotivo(motivo))!;
        return <li key={estilo.id} className="flex items-start gap-2 text-sm">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 size-4 shrink-0"><circle cx="8" cy="8" r="7" fill={`url(#${estilo.id})`} /></svg>
          <div className="min-w-0 flex-1"><p className="[overflow-wrap:anywhere]">{motivo.nome}</p><p className="text-xs text-muted-foreground">{moeda(motivo.valor)} · {motivo.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p></div>
        </li>;
      })}</ul> : <p className="text-sm text-muted-foreground">Sem perdas para mostrar.</p>}
      {motivos.length > 0 && positivos.length === 0 && <p className="mt-3 text-xs text-muted-foreground">Sem valor positivo para calcular as fatias.</p>}
    </figcaption>
  </figure>;
}
