"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResultadoEntrega } from "@/lib/vendas/entregas";
import { MapaEntrega } from "./mapa-entrega";
import { AtribuicaoMapas } from "./atribuicao-mapas";
const moeda = (v: string | null) => v == null ? "Não calculado" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function ResultadoCalculoEntrega({ resultado: r }: { resultado: ResultadoEntrega }) {
  const [expirado, setExpirado] = useState(() => new Date(r.validoAte).getTime() <= Date.now());
  useEffect(() => { const t = setTimeout(() => setExpirado(true), Math.max(0, new Date(r.validoAte).getTime() - Date.now())); return () => clearTimeout(t); }, [r.validoAte]);
  if (expirado) return <p role="status" className="text-sm text-muted-foreground">Cálculo vencido. Calcule novamente; os dados de mapas não são mantidos.</p>;
  const m = r.memoria;
  const porSlots = r.selecaoVeiculo?.modelo === "SLOTS";
  return <Card className="max-w-4xl"><CardHeader><CardTitle>{m.motivo}</CardTitle></CardHeader><CardContent className="space-y-4">
    {r.selecaoVeiculo && <p className="text-sm">Veículo: {r.selecaoVeiculo.nome} · Perfil: {r.selecaoVeiculo.perfil ?? "Pendente"} · {r.selecaoVeiculo.escolha === "SLOTS" ? "Capacidade por slots" : r.selecaoVeiculo.escolha === "REGRA" ? "Regra por embalagem" : r.selecaoVeiculo.escolha === "OPERADOR" ? "Escolhido no pedido" : "Padrão"}</p>}
    {r.rota && <div className="space-y-2 border-b pb-4"><p className="text-sm">Origem informada: {r.rota.origem.descricao}</p><p className="text-sm">Destino informado: {r.rota.destino.descricao}</p><p className="font-medium">{(r.rota.distanciaMetros / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} km por rota · {Math.ceil(r.rota.duracaoSegundos / 60)} min de percurso estimado</p><p className="text-xs text-muted-foreground">Estimativa de ida, sem trânsito em tempo real. Não é quilometragem medida nem cotação do entregador. A duração não altera o prazo combinado.</p>{r.veiculo === "MOTO" && <p className="text-xs text-muted-foreground">Rotas de moto estão em versão beta e podem omitir caminhos adequados. Confira o percurso antes de operar.</p>}<AtribuicaoMapas /><MapaEntrega polyline={r.rota.polyline} /></div>}
    {!r.rota && <p className="text-sm text-muted-foreground">Distância e duração não disponíveis. Nenhuma distância fictícia foi aplicada.</p>}
    <dl className="grid gap-3 text-sm sm:grid-cols-2">{(porSlots ? [["Preço da faixa",m.precoFaixa],["Frete final",m.frete]] : [["Produtos após descontos",m.subtotalProdutos],["Preço da faixa",m.precoFaixa],["Frete fixo",m.fixo],["Acréscimo",m.acrescimo],["Piso do frete",m.piso],["Pedido mínimo",m.pedidoMinimo],["Antes da gratuidade",m.antesGratuidade],["Desconto no frete",m.descontoFrete],["Frete final",m.frete]]).map(([k,v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{moeda(v)}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">Faixa: {m.faixaDescricao ?? m.faixaId ?? "—"}{!porSlots && <> · Exceção: {m.excecaoNome ?? m.excecaoId ?? "—"}</>} · Configuração da loja v{r.versao} · {new Date(r.calculadoEm).toLocaleString("pt-BR")} · Validade técnica de 10 minutos</p>
  </CardContent></Card>;
}
