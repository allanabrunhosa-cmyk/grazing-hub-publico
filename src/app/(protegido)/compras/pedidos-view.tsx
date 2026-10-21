"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { List, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { PedidosTable } from "@/app/(protegido)/compras/pedidos-table";
import { PedidosCalendario } from "@/app/(protegido)/compras/pedidos-calendario";
import { CHAVE_RASCUNHO_NOVO_PEDIDO, PedidoDialog } from "@/app/(protegido)/compras/pedido-dialog";
import { PedidoDetalheDialog } from "@/app/(protegido)/compras/pedido-detalhe-dialog";
import { RecebimentoDialog } from "@/app/(protegido)/compras/recebimento-dialog";
import { ReabrirPedidoDialog } from "./reabrir-pedido-dialog";
import { ExcluirPedidoDialog } from "./excluir-pedido-dialog";
import { reagendarPedidoAction } from "@/app/(protegido)/compras/reagendar-pedido";
import type { FornecedorOption, InsumoComFornecedorOption, PedidoRow } from "@/app/(protegido)/compras/types";

const semAssinatura = () => () => undefined;

function temRascunhoNovoPedido() {
  try {
    return sessionStorage.getItem(CHAVE_RASCUNHO_NOVO_PEDIDO) != null;
  } catch {
    return false;
  }
}

export function PedidosView({
  pedidos,
  fornecedores,
  insumos,
  cotacoes,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
  entidadeInicialId,
}: {
  pedidos: PedidoRow[];
  fornecedores: FornecedorOption[];
  insumos: InsumoComFornecedorOption[];
  cotacoes: { insumoId: string; fornecedorId: string; precoUnitario: number }[];
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
  entidadeInicialId?: string;
}) {
  const pedidoInicial = pedidos.find(p => p.id === entidadeInicialId);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [pedidoReabrindo, setPedidoReabrindo] = useState<PedidoRow | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  // O link abre consulta e conserva o rascunho no storage para a ação Novo pedido.
  const [rascunhoIgnorado, setRascunhoIgnorado] = useState(Boolean(pedidoInicial));
  const [dataNovoPedido, definirDataNovoPedido] = useState<string>();
  const [reagendando, iniciarReagendamento] = useTransition();
  const reagendamentoEmCurso = useRef(false);
  const [erroReagendamento, definirErroReagendamento] = useState("");
  const [datasAlteradas, definirDatasAlteradas] = useState<{ base: PedidoRow[]; datas: Record<string, string> }>({ base: pedidos, datas: {} });
  const [pedidoEditando, setPedidoEditando] = useState<PedidoRow | null>(null);
  const [pedidoDetalhe, setPedidoDetalhe] = useState<PedidoRow | null>(pedidoInicial ?? null);
  const [leituraInicial, setLeituraInicial] = useState(Boolean(pedidoInicial));
  const [pedidoRecebendo, setPedidoRecebendo] = useState<PedidoRow | null>(null);
  const [pedidoExcluindo, setPedidoExcluindo] = useState<PedidoRow | null>(null);
  const temRascunho = useSyncExternalStore(semAssinatura, temRascunhoNovoPedido, () => false);

  const [excluidosAgora, definirExcluidosAgora] = useState<Record<string, string>>({});
  const atualizados = pedidos.map(p => {
    const dataAlterada = datasAlteradas.base === pedidos ? datasAlteradas.datas[p.id] : undefined;
    return { ...p, previsaoEntrega: dataAlterada ?? p.previsaoEntrega, excluidoEm: p.excluidoEm ?? excluidosAgora[p.id] };
  });
  const visiveis = atualizados.filter(p => !p.excluidoEm);
  function novoPedido(data?: string) {
    definirDataNovoPedido(data);
    setRascunhoIgnorado(false);
    setNovoAberto(true);
  }
  function reagendar(pedido: PedidoRow, data: string) {
    if (reagendamentoEmCurso.current || pedido.previsaoEntrega?.slice(0, 10) === data) return;
    reagendamentoEmCurso.current = true;
    definirErroReagendamento("");
    iniciarReagendamento(async () => {
      try {
        const resultado = await reagendarPedidoAction({ pedidoId: pedido.id, previsaoAnterior: pedido.previsaoEntrega?.slice(0, 10) ?? null, previsaoEntrega: data });
        if ("erro" in resultado) { definirErroReagendamento(resultado.erro); return; }
        // A resposta revalidada do servidor prevalece quando os pedidos são recarregados.
        definirDatasAlteradas(anteriores => ({ base: pedidos, datas: { ...(anteriores.base === pedidos ? anteriores.datas : {}), [pedido.id]: resultado.previsaoEntrega } }));
        toast.success("Entrega reagendada para " + data.split("-").reverse().join("/"));
      } catch {
        definirErroReagendamento("Não foi possível reagendar o pedido. A data anterior foi mantida. Tente novamente.");
      } finally { reagendamentoEmCurso.current = false; }
    });
  }

  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Compras" descricao="Planeje as compras de estoque e uso e consumo e acompanhe cada entrega." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Visualização dos pedidos" className="flex gap-1.5">
        <Button type="button" size="sm" aria-pressed={viewMode === "lista"} variant={viewMode === "lista" ? "default" : "outline"} className="gap-1.5" onClick={() => setViewMode("lista")}>
          <List className="size-4" />
          Lista
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === "calendario" ? "default" : "outline"}
          aria-pressed={viewMode === "calendario"}
          className="gap-1.5"
          onClick={() => setViewMode("calendario")}
        >
          <CalendarDays className="size-4" />
          Calendário
        </Button>
        </div>
        <Button type="button" size="sm" className="ml-auto gap-1.5" onClick={() => novoPedido()}>
          <Plus className="size-4" />
          Novo pedido
        </Button>
      </div>
      {erroReagendamento && <p role="alert" className="text-sm text-destructive">{erroReagendamento}</p>}

      {viewMode === "lista" ? (
        <PedidosTable pedidos={atualizados} onSelecionar={pedido => { setLeituraInicial(false); setPedidoDetalhe(pedido); }} />
      ) : (
        <PedidosCalendario pedidos={visiveis} onSelecionar={pedido => { setLeituraInicial(false); setPedidoDetalhe(pedido); }} onNovoPedido={novoPedido} onReagendar={reagendar} salvando={reagendando} />
      )}

      {(novoAberto || (temRascunho && !rascunhoIgnorado)) && <PedidoDialog open onOpenChange={(aberto) => {
        setNovoAberto(aberto);
        if (!aberto) setRascunhoIgnorado(true);
      }} previsaoEntregaInicial={dataNovoPedido} fornecedores={fornecedores} insumos={insumos} cotacoes={cotacoes} podeCadastrarFornecedor={podeCadastrarFornecedor} podeCadastrarInsumo={podeCadastrarInsumo} />}

      {pedidoEditando && (
        <PedidoDialog
          key={pedidoEditando.id}
          open
          onOpenChange={(open) => !open && setPedidoEditando(null)}
          fornecedores={fornecedores}
          insumos={insumos}
          cotacoes={cotacoes}
          pedido={pedidoEditando}
          podeCadastrarFornecedor={podeCadastrarFornecedor}
          podeCadastrarInsumo={podeCadastrarInsumo}
        />
      )}

      {pedidoDetalhe && (
        <PedidoDetalheDialog
          key={pedidoDetalhe.id}
          pedido={pedidoDetalhe}
          open
          somenteLeitura={leituraInicial}
          onOpenChange={(open) => { if (!open) { setPedidoDetalhe(null); setLeituraInicial(false); } }}
          onReabrir={() => { setPedidoReabrindo(pedidoDetalhe); setPedidoDetalhe(null); }}
          onEditar={() => {
            setPedidoEditando(pedidoDetalhe);
            setPedidoDetalhe(null);
          }}
          onReceber={() => {
            setPedidoRecebendo(pedidoDetalhe);
            setPedidoDetalhe(null);
          }}
          onExcluir={() => {
            setPedidoExcluindo(pedidoDetalhe);
            setPedidoDetalhe(null);
          }}
        />
      )}

      {pedidoRecebendo && (
        <RecebimentoDialog
          key={pedidoRecebendo.id}
          pedido={pedidoRecebendo}
          insumos={insumos}
          open
          onOpenChange={(open) => !open && setPedidoRecebendo(null)}
          podeCadastrarInsumo={podeCadastrarInsumo}
        />
      )}

      {pedidoReabrindo && <ReabrirPedidoDialog pedido={pedidoReabrindo} onOpenChange={aberto => !aberto && setPedidoReabrindo(null)} />}
      {pedidoExcluindo && <ExcluirPedidoDialog key={pedidoExcluindo.id} pedido={pedidoExcluindo} aoFechar={() => setPedidoExcluindo(null)} aoExcluir={() => {
        definirExcluidosAgora(anteriores => ({ ...anteriores, [pedidoExcluindo.id]: new Date().toISOString() }));
        setPedidoExcluindo(null);
      }} />}

    </div>
  );
}
