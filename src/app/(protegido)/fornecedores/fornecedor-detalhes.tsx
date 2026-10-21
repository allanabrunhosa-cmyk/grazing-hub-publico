"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Truck, UserRound } from "lucide-react";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { alterarStatusFornecedorAction } from "../status-cadastros-actions";
import { TableCell, TableRow } from "@/components/ui/table";
import type { FornecedorRow } from "./types";
import { formatarCpfCnpj } from "@/lib/documento-brasileiro";

function Campo({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return <div className="min-w-0">
    <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{titulo}</dt>
    <dd className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{valor || "—"}</dd>
  </div>;
}

export function FornecedorDetalhes({ fornecedor, onFechar, somenteLeitura = false }: {
  fornecedor: FornecedorRow;
  onFechar: () => void;
  somenteLeitura?: boolean;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const [larguraVisivel, setLarguraVisivel] = useState<number | null>(null);
  const beneficiario = fornecedor.tipoCadastro === "BENEFICIARIO";

  useEffect(() => {
    const area = painelRef.current?.closest<HTMLElement>('[data-slot="table-container"]');
    if (!area) return;
    const observador = new ResizeObserver(() => setLarguraVisivel(area.clientWidth));
    observador.observe(area);
    return () => observador.disconnect();
  }, []);

  return <TableRow className="bg-muted/30 hover:bg-muted/30">
    <TableCell colSpan={beneficiario ? 6 : 7} className="p-0 whitespace-normal">
      <div style={larguraVisivel ? { width: larguraVisivel } : undefined} className="sticky left-0 w-0">
        <div ref={painelRef} id={`detalhes-fornecedor-${fornecedor.id}`} role="region" aria-label={`Detalhes de ${fornecedor.nome}`}
          onKeyDown={(evento) => {
            if (evento.key === "Escape" && !evento.defaultPrevented) {
              evento.stopPropagation();
              onFechar();
            }
          }} className="animate-in fade-in slide-in-from-top-2 border-l-2 border-primary p-4 duration-200">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {beneficiario ? <UserRound className="size-7" /> : <Truck className="size-7" />}
            </div>
            {beneficiario ? (
              <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo titulo="Nome" valor={fornecedor.nome} />
                <Campo titulo="CPF ou CNPJ" valor={formatarCpfCnpj(fornecedor.cpf ?? fornecedor.cnpj ?? "")} />
                <Campo titulo="Telefone" valor={fornecedor.telefone} />
                <Campo titulo="Forma de pagamento" valor={fornecedor.formasPagamento[0]?.nome} />
                <Campo titulo="Status" valor={<StatusAtivoSalvavel motivoBloqueio={somenteLeitura ? "Consulta somente leitura." : undefined} ativo={fornecedor.ativo} nome={fornecedor.nome} salvar={ativo => alterarStatusFornecedorAction(fornecedor.id, ativo)} />} />
              </dl>
            ) : (
              <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo titulo="Nome" valor={fornecedor.nome} />
                <Campo titulo="Razão social" valor={fornecedor.razaoSocial} />
                <Campo titulo="CNPJ" valor={fornecedor.cnpj} />
                <Campo titulo="Contato" valor={fornecedor.contatoNome} />
                <Campo titulo="Telefone" valor={fornecedor.telefone} />
                <Campo titulo="E-mail" valor={fornecedor.email} />
                <Campo titulo="Site" valor={fornecedor.site} />
                <Campo titulo="Prazo de pagamento" valor={fornecedor.prazoPagamentoDias != null ? `${fornecedor.prazoPagamentoDias} dia(s)` : null} />
                <Campo titulo="Prazo de entrega" valor={fornecedor.prazoEntregaDias != null ? `${fornecedor.prazoEntregaDias} dia(s)` : null} />
                <Campo titulo="Canais de pedido" valor={fornecedor.canaisPedido.map((canal) => canal.nome).join(", ")} />
                <Campo titulo="Formas de pagamento" valor={fornecedor.formasPagamento.map((forma) => forma.nome).join(", ")} />
                <Campo titulo="Status" valor={<StatusAtivoSalvavel motivoBloqueio={somenteLeitura ? "Consulta somente leitura." : undefined} ativo={fornecedor.ativo} nome={fornecedor.nome} salvar={ativo => alterarStatusFornecedorAction(fornecedor.id, ativo)} />} />
                <div className="sm:col-span-2 lg:col-span-3"><Campo titulo="Insumos vinculados" valor={fornecedor.insumosVinculados.length ? <div className="grid gap-2 sm:grid-cols-2">{fornecedor.insumosVinculados.map((insumo) => <IdentificacaoInsumo key={insumo.id} nome={insumo.nome} especificacao={insumo.especificacao} nomeClassName="font-medium" />)}</div> : null} /></div>
                <div className="sm:col-span-2 lg:col-span-3"><Campo titulo="Observações" valor={fornecedor.observacoes} /></div>
              </dl>
            )}
          </div>
        </div>
      </div>
    </TableCell>
  </TableRow>;
}
