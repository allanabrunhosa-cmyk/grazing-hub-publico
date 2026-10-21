"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { estadosOperacao, type ComandoOperacao, type FatoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import { quantidadeExecucao } from "@/lib/vendas/pedidos-execucao-dominio";
import type { HorariosPedidos } from "@/lib/vendas/pedidos-horarios-dominio";
import { OcorrenciasPedido } from "../../ocorrencias-pedido";
import { executarOperacaoPedidoAction } from "../../actions";
import { imprimirResumoPedido } from "./impressao";
import type { CoberturaPedido } from "@/lib/vendas/pedidos-composicao";

export type ResumoOperacional = { inicioPreparoIfood?: string | null; atendimento?: string | null; fusoHorario?: string; referenciaPedido?: string | null; revisoesProducao?: { versao: number; descricao: string }[]; id: string; numero: number; versao: number; status: string; statusOperacional: string; previsaoData: string | null; previsaoJanela: string | null; observacoes: string | null; destinatarioSnapshot: Record<string, string> | null; enderecoSnapshot: Record<string, string> | null; itens: { id: string; quantidade: string; observacoes?: string | null; unidadeSnapshot: string; produtoSnapshot: { nome: string }; escolhasSnapshot: { opcaoNome: string; quantidade: number }[] }[]; historico: FatoOperacao[] };
const rotulos: Record<string, string> = { INICIAR: "Início da preparação", PREPARAR: "Quantidade preparada", PRONTO: "Pronto para expedição", EXPEDIR: "Quantidade expedida", SAIR: "Saída para entrega", ENTREGAR: "Entrega registrada", OCORRENCIA: "Ocorrência aberta", RESOLVER: "Ocorrência resolvida", REAGENDAR: "Entrega reagendada" };

export function OperacaoPedido({ pedido: bruto, editar, horarios = null }: { pedido: Record<string, unknown>; editar: boolean; horarios?: HorariosPedidos | null }) {
  const p = bruto as unknown as ResumoOperacional;
  const cobertura = bruto.cobertura as CoberturaPedido | null;
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const chaves = useRef<Record<string, string>>({});
  const fatos = p.historico.filter(h => h.tipo.startsWith("OPERACAO_"));
  const aberto = p.status === "CONFIRMADO" && p.statusOperacional !== "ENTREGUE";
  function executar(comando: ComandoOperacao) {
    const assinatura = JSON.stringify(comando);
    const chave = chaves.current[assinatura] ??= crypto.randomUUID();
    iniciar(async () => {
      setErro("");
      try { const r = await executarOperacaoPedidoAction(p.id, p.versao, comando, chave); if ("erro" in r) { setErro(r.erro); return; } router.refresh(); }
      catch { setErro("Resultado não confirmado. Recarregue para conferir antes de repetir."); }
    });
  }
  const total = (id: string, tipo: string) => quantidadeExecucao(fatos, id, tipo).toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  return <div className="space-y-6">
    <div><h1 className="font-heading text-display">Operação do pedido #{p.numero}</h1><p>{estadosOperacao[p.statusOperacional]} · Comercial: {p.status}</p><p className="text-sm text-muted-foreground">Etapas operacionais e apontamentos físicos são separados. Registre reservas e utilização na seção de materiais. Nenhuma destas ações registra recebimento ou emissão fiscal.</p></div>
    {Boolean(bruto.coberturaPendenteRevisao) && <p className="text-sm text-muted-foreground">Há itens revisados após a fotografia inicial. Estimativa global pendente; a fotografia anterior continua preservada no histórico e cada reserva registra sua composição.</p>}
    {erro && <p role="alert" className="text-destructive">{erro}</p>}
    <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Resumo para preparação e entrega</h2>
      <p>{p.previsaoData?.slice(0, 10) ?? "Sem data"} · {p.previsaoJanela ?? "Sem janela"}</p>
      <p>{Object.values(p.destinatarioSnapshot ?? {}).filter(Boolean).join(" · ")}</p><p>{Object.values(p.enderecoSnapshot ?? {}).filter(Boolean).join(" · ")}</p><p>{p.observacoes}</p>
      {p.itens.map(i => <div key={i.id} className="space-y-2 border-t py-3"><p className="font-medium">{i.produtoSnapshot.nome} · {i.quantidade} {i.unidadeSnapshot}</p><p>{i.escolhasSnapshot.map(e => `${e.quantidade} × ${e.opcaoNome}`).join("; ")}</p><p className="text-sm">Preparado: {total(i.id, "PREPARAR")} · Expedido: {total(i.id, "EXPEDIR")}</p>
        {editar && aberto && ["EM_PREPARO", "PRONTO"].includes(p.statusOperacional) && <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">Quantidade de {i.produtoSnapshot.nome}<Input value={quantidades[i.id] ?? ""} onChange={e => setQuantidades({ ...quantidades, [i.id]: e.target.value })} inputMode="decimal" min={0} maxLength={17} casasDecimais={["KG", "G", "L", "ML", "M", "M2", "M3"].includes(i.unidadeSnapshot) ? 6 : 0} /></label><Button disabled={ocupado} onClick={() => executar({ tipo: p.statusOperacional === "EM_PREPARO" ? "PREPARAR" : "EXPEDIR", itemId: i.id, quantidade: (quantidades[i.id] ?? "").replace(",", ".") })}>{p.statusOperacional === "EM_PREPARO" ? "Registrar quantidade preparada" : "Registrar quantidade expedida"}</Button></div>}
      </div>)}
      <Button variant="outline" onClick={() => { if (!imprimirResumoPedido(p)) setErro("Permita a janela de impressão no navegador."); }}>Imprimir resumo operacional</Button>
      {editar && aberto && <div className="flex flex-wrap gap-2">{p.statusOperacional === "PENDENTE" && <Button disabled={ocupado} onClick={() => executar({ tipo: "INICIAR" })}>Iniciar preparação</Button>}{p.statusOperacional === "EM_PREPARO" && <Button disabled={ocupado} onClick={() => executar({ tipo: "PRONTO" })}>Concluir preparação</Button>}{p.statusOperacional === "PRONTO" && <Button disabled={ocupado} onClick={() => executar({ tipo: p.atendimento === "RETIRADA" ? "ENTREGAR" : "SAIR" })}>{p.atendimento === "RETIRADA" ? "Registrar retirada" : "Registrar saída para entrega"}</Button>}{p.statusOperacional === "EM_ENTREGA" && <Button disabled={ocupado} onClick={() => executar({ tipo: "ENTREGAR" })}>Registrar entrega</Button>}</div>}
    </section>
    <OcorrenciasPedido pedido={p} editar={editar} horarios={horarios} />
    {cobertura && <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Composição e custo analítico</h2><p className="text-sm">{cobertura.cobertura.comEstimativa} de {cobertura.cobertura.total} itens com estimativa completa · {new Date(cobertura.calculadoEm).toLocaleString("pt-BR", { timeZone: p.fusoHorario ?? "America/Sao_Paulo" })}</p><p className="text-sm text-muted-foreground">{cobertura.base} Após iniciar preparação, esta fotografia é preservada.</p>{cobertura.itens.map(i => <div key={i.itemId} className="space-y-1 border-t py-3"><p className="font-medium">{i.produto} · {i.quantidade}</p><p>Estimativa: {i.custoEstimado === null ? "Pendente" : Number(i.custoEstimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Custo apurado: pendente · Disponibilidade prometida: não definida</p>{i.necessidades.map((n, indice) => <p key={indice} className="text-sm">{n.nome}: {n.quantidade ?? "Conversão pendente"} {n.unidade}{n.tipo === "PRODUTO_INTERMEDIARIO" ? " · preparação: modo de consumo pendente; ingredientes não baixados novamente" : ""}</p>)}{i.pendencias.map(m => <p key={m} className="text-sm text-muted-foreground">{m}</p>)}<p className="text-sm text-muted-foreground">{i.bloqueioFisico}</p></div>)}<p className="text-sm">Reservas e apontamentos físicos são apresentados na seção de materiais. Custo apurado e reconhecimento contábil de CMV continuam pendentes.</p></section>}
    <section className="space-y-2 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Histórico operacional</h2>{fatos.map(f => <p key={f.id} className="border-t py-2 text-sm">{rotulos[f.depois.comando?.tipo ?? ""] ?? f.tipo} · {f.usuarioNome} · {new Date(f.createdAt).toLocaleString("pt-BR", { timeZone: p.fusoHorario ?? "America/Sao_Paulo" })}{f.depois.comando?.quantidade ? ` · Quantidade: ${f.depois.comando.quantidade}` : ""}{f.motivo ? ` · ${f.motivo}` : ""}</p>)}</section>
  </div>;
}
