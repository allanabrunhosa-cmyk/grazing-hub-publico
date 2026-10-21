"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardFiscalDto } from "@/lib/fiscal-dashboard/tipos";
import { formatarMoedaFiscal, formatarDataFiscal } from "./formatacao";

type Pintor = (ctx: CanvasRenderingContext2D, largura: number, altura: number, cores: Record<string, string>, fonte: string) => void;

/** Gráficos de dados em canvas, com escala responsiva e equivalente textual. */
function useGrafico(pintar: Pintor) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const elemento = canvas.current;
    if (!elemento) return;
    const desenhar = () => {
      const { width: largura, height: altura } = elemento.getBoundingClientRect();
      if (!largura || !altura) return;
      const densidade = window.devicePixelRatio || 1;
      elemento.width = Math.round(largura * densidade);
      elemento.height = Math.round(altura * densidade);
      const ctx = elemento.getContext("2d");
      if (!ctx) return;
      ctx.scale(densidade, densidade);
      const css = getComputedStyle(elemento);
      const cores = Object.fromEntries(["primary", "success", "warning", "destructive", "border", "muted", "muted-foreground", "foreground", "card", "chart-2"].map(nome => [nome, css.getPropertyValue(`--${nome}`).trim()]));
      pintar(ctx, largura, altura, cores, css.fontFamily);
    };
    const tamanho = new ResizeObserver(desenhar);
    tamanho.observe(elemento);
    const tema = new MutationObserver(desenhar);
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    desenhar();
    return () => { tamanho.disconnect(); tema.disconnect(); };
  }, [pintar]);
  return canvas;
}

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const moedaEixo = (valor: number) => `R$ ${compacto.format(valor)}`;

export function GraficoMovimentoFiscal({ dados }: { dados: DashboardFiscalDto["movimentoDiario"] }) {
  const [diaAtivo, setDiaAtivo] = useState<number | null>(null);
  const mesesDistintos = dados[0]?.dia.slice(0, 7) !== dados.at(-1)?.dia.slice(0, 7);
  const rotuloDia = (dia: string) => mesesDistintos ? formatarDataFiscal(dia) : dia.slice(-2);
  const escolhido = diaAtivo === null ? null : dados[diaAtivo];
  const disponivel = dados.some(dia => dia.saidas !== null || dia.entradas !== null);
  const canvas = useGrafico((ctx, largura, altura, cores, fonte) => {
    const margens = { esquerda: 56, direita: 8, cima: 12, baixo: 28 };
    const w = largura - margens.esquerda - margens.direita;
    const h = altura - margens.cima - margens.baixo;
    const maximo = dados.reduce((maximo, dia) => Math.max(maximo, Number(dia.saidas ?? 0), Number(dia.entradas ?? 0)), 1) * 1.15;
    const primeiroDia = Date.parse(dados[0]?.dia ?? "1970-01-01");
    const duracao = Math.max(86400000, Date.parse(dados.at(-1)?.dia ?? "1970-01-01") - primeiroDia);
    const x = (i: number) => margens.esquerda + (Date.parse(dados[i].dia) - primeiroDia) * w / duracao;
    const y = (valor: number) => margens.cima + h - valor / maximo * h;
    ctx.font = `11px ${fonte}`;
    ctx.fillStyle = cores["muted-foreground"];
    ctx.strokeStyle = cores.border;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const alturaLinha = margens.cima + h * i / 4;
      ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(margens.esquerda, alturaLinha); ctx.lineTo(largura - margens.direita, alturaLinha); ctx.stroke();
      ctx.textAlign = "right";
      if (disponivel) ctx.fillText(moedaEixo(maximo * (1 - i / 4)), margens.esquerda - 8, alturaLinha + 4);
    }
    ctx.setLineDash([]); ctx.textAlign = "center";
    let ultimoRotulo = -Infinity;
    dados.forEach((dia, i) => { const ponto = x(i); if (i === 0 || i === dados.length - 1 || ponto - ultimoRotulo >= (mesesDistintos ? 85 : 40) && ponto < largura - 48) { ctx.fillText(rotuloDia(dia.dia), ponto, altura - 7); ultimoRotulo = ponto; } });
    for (const [campo, cor] of [["saidas", cores.success], ["entradas", cores.warning]] as const) {
      // Lacunas interrompem a linha; não são convertidas a dias com zero.
      const trechos: { i: number; valor: number }[][] = [];
      dados.forEach((dia, i) => {
        if (dia[campo] === null) { if (trechos.at(-1)?.length) trechos.push([]); return; }
        if (!trechos.length) trechos.push([]);
        trechos.at(-1)!.push({ i, valor: Number(dia[campo]) });
      });
      for (const trecho of trechos.filter(t => t.length)) {
        ctx.beginPath(); ctx.moveTo(x(trecho[0].i), y(0));
        trecho.forEach(ponto => ctx.lineTo(x(ponto.i), y(ponto.valor)));
        ctx.lineTo(x(trecho.at(-1)!.i), y(0)); ctx.closePath();
        ctx.fillStyle = cor; ctx.globalAlpha = 0.08; ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); trecho.forEach((ponto, i) => { if (i === 0) ctx.moveTo(x(ponto.i), y(ponto.valor)); else ctx.lineTo(x(ponto.i), y(ponto.valor)); });
        ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    if (diaAtivo !== null && dados[diaAtivo]) {
      ctx.beginPath(); ctx.moveTo(x(diaAtivo), margens.cima); ctx.lineTo(x(diaAtivo), y(0)); ctx.strokeStyle = cores["muted-foreground"]; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      for (const [campo, cor] of [["saidas", cores.success], ["entradas", cores.warning]] as const) {
        if (dados[diaAtivo][campo] !== null) { ctx.beginPath(); ctx.arc(x(diaAtivo), y(Number(dados[diaAtivo][campo])), 4, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill(); }
      }
    }
  });
  return <div className="space-y-2">
    <div className="relative h-40 rounded-[var(--ds-controle-raio)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-44" tabIndex={0} role="group" aria-label="Movimento diário. Use as setas para consultar cada dia." onKeyDown={e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return;
      e.preventDefault();
      setDiaAtivo(e.key === "Escape" ? null : e.key === "Home" ? 0 : e.key === "End" ? dados.length - 1 : Math.min(dados.length - 1, Math.max(0, (diaAtivo ?? 0) + (e.key === "ArrowLeft" ? -1 : 1))));
    }} onPointerLeave={() => setDiaAtivo(null)} onPointerMove={e => {
      const caixa = e.currentTarget.getBoundingClientRect();
      if (!dados.length) return;
      const primeiro = Date.parse(dados[0].dia), duracao = Date.parse(dados.at(-1)!.dia) - primeiro;
      const alvo = primeiro + (e.clientX - caixa.left - 56) / (caixa.width - 64) * duracao;
      let menor = 0, maior = dados.length - 1;
      while (menor < maior) { const meio = Math.floor((menor + maior) / 2); if (Date.parse(dados[meio].dia) < alvo) menor = meio + 1; else maior = meio; }
      setDiaAtivo(menor > 0 && Math.abs(Date.parse(dados[menor - 1].dia) - alvo) < Math.abs(Date.parse(dados[menor].dia) - alvo) ? menor - 1 : menor);
    }}><canvas ref={canvas} aria-hidden="true" className="h-full w-full" />{escolhido && <p className="absolute top-0 right-0 rounded-[var(--ds-controle-raio)] border bg-card px-2 py-1 text-xs shadow-sm">Dia {rotuloDia(escolhido.dia)} · Saídas {formatarMoedaFiscal(escolhido.saidas)} · Despesas {formatarMoedaFiscal(escolhido.entradas)}</p>}{!disponivel && <div className="absolute inset-0 flex items-center justify-center bg-card/90 px-6 text-center text-sm text-muted-foreground">Movimento indisponível · faltam evidências fiscais neste recorte.</div>}</div>
    <div className="flex justify-center gap-5 text-xs"><span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 bg-success" />Saídas</span><span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 bg-warning" />Despesas</span></div>
    <p aria-live="polite" className="sr-only">{escolhido ? `Consulta do dia ${rotuloDia(escolhido.dia)}: saídas ${formatarMoedaFiscal(escolhido.saidas)}, despesas ${formatarMoedaFiscal(escolhido.entradas)}` : "Passe pelo gráfico ou use as setas para consultar os valores."}</p>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-ring">Ver valores diários</summary><div className="max-h-48 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Valores oficiais por dia; traço significa indisponível.</caption><thead><tr><th>Dia</th><th>Saídas</th><th>Despesas</th></tr></thead><tbody>{dados.map(dia => <tr key={dia.dia}><td>{formatarDataFiscal(dia.dia)}</td><td>{formatarMoedaFiscal(dia.saidas)}</td><td>{formatarMoedaFiscal(dia.entradas)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

export function GraficoReceitaFiscal({ dados, total }: { dados: DashboardFiscalDto["receitaPorDocumento"]; total: string | null }) {
  const incompleto = total === null || dados.some(item => item.valor === null);
  const soma = dados.reduce((valor, item) => valor + Number(item.valor ?? 0), 0);
  const quantidade = dados.reduce((valor, item) => valor + item.quantidade, 0);
  const canvas = useGrafico((ctx, largura, altura, cores) => {
    const raio = Math.min(largura, altura) / 2 - 19;
    const centro = { x: largura / 2, y: altura / 2 };
    ctx.lineWidth = 25; ctx.strokeStyle = cores.muted;
    ctx.beginPath(); ctx.arc(centro.x, centro.y, raio, 0, 2 * Math.PI); ctx.stroke();
    if (incompleto || soma === 0) return;
    let angulo = -Math.PI / 2;
    dados.forEach((item, i) => {
      const arco = Number(item.valor ?? 0) / soma * 2 * Math.PI;
      if (arco > 0) { ctx.beginPath(); ctx.arc(centro.x, centro.y, raio, angulo, angulo + arco); ctx.strokeStyle = i === 0 ? cores.primary : cores["chart-2"]; ctx.stroke(); }
      angulo += arco;
    });
  });
  return <div className="space-y-3">
    <div className="relative mx-auto h-40 w-40 sm:h-44 sm:w-44"><canvas aria-hidden="true" ref={canvas} className="h-full w-full" /><div className="absolute inset-0 flex flex-col items-center justify-center px-9 text-center"><p className="font-heading text-stat tabular-nums">{incompleto ? "—" : quantidade}</p><p className="text-xs text-muted-foreground">{incompleto ? "Dados incompletos" : quantidade === 1 ? "documento" : "documentos"}</p></div></div>
    <div className="grid grid-cols-2 gap-3 text-xs">{dados.map((item, i) => <div key={item.modelo} className="space-y-1 text-center"><p className="flex items-center justify-center gap-1.5"><span aria-hidden="true" className={`size-2 rounded-sm ${i === 0 ? "bg-primary" : "bg-chart-2"}`} />{item.modelo === 55 ? "NF-e" : "NFC-e"}</p><p className="font-semibold tabular-nums">{formatarMoedaFiscal(item.valor)}</p></div>)}</div>
    {(incompleto || soma === 0) && <p className="text-center text-xs text-muted-foreground">{incompleto ? "Divisão indisponível enquanto houver dados fiscais incompletos." : "Nenhuma receita autorizada neste período."}</p>}
  </div>;
}
