"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";

import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPedidoBadge } from "@/app/(protegido)/compras/status-badge";
import {
  formatarNumeroPedido,
  resumoItensPedido,
  statusExibicaoLabels,
  statusExibicaoPedido,
  type PedidoRow,
  type StatusExibicaoPedido,
} from "@/app/(protegido)/compras/types";

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

type FiltroPedido = "TODOS" | StatusExibicaoPedido | "EXCLUIDOS";

const FILTROS: { valor: FiltroPedido; label: string }[] = [
  { valor: "TODOS", label: "Todos" },
  { valor: "PENDENTE", label: statusExibicaoLabels.PENDENTE },
  { valor: "ATRASADO", label: statusExibicaoLabels.ATRASADO },
  { valor: "RECEBIDO", label: statusExibicaoLabels.RECEBIDO },
  { valor: "EXCLUIDOS", label: "Excluídos" },
];

const correspondeSituacao = ({ pedido, status }: { pedido: PedidoRow; status: StatusExibicaoPedido }, valor: FiltroPedido) =>
  valor === "EXCLUIDOS" ? !!pedido.excluidoEm : !pedido.excluidoEm &&
    (valor === "TODOS" || (valor === "RECEBIDO" ? status === "RECEBIDO" || status === "RECEBIDO_COM_DIVERGENCIA" : status === valor));

export function PedidosTable({ pedidos, onSelecionar }: { pedidos: PedidoRow[]; onSelecionar: (pedido: PedidoRow) => void }) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<FiltroPedido>("TODOS");
  const [ordenacao, setOrdenacao] = useState<{ coluna: "numero" | "fornecedor" | "entrega" | "status"; direcao: "asc" | "desc" } | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  function alternarOrdenacao(coluna: "numero" | "fornecedor" | "entrega" | "status") {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const linhas = useMemo(
    () => pedidos.map((pedido) => ({ pedido, status: statusExibicaoPedido(pedido, hoje) })),
    [pedidos, hoje]
  );

  const porBusca = useMemo(() => {
    const termo = normalizar(query.trim());
    const resultado = linhas.filter(({ pedido, status }) => {
      if (!termo) return true;
      const alvo = normalizar(
        [
          formatarNumeroPedido(pedido.numero),
          pedido.fornecedorNome,
          statusExibicaoLabels[status],
          ...pedido.itens.flatMap((i) => [i.insumoNome, i.insumoEspecificacao ?? ""]),
        ].join(" ")
      );
      return alvo.includes(termo);
    });

    return resultado;
  }, [linhas, query]);
  const filtradas = useMemo(() => {
    const resultado = porBusca.filter(linha => correspondeSituacao(linha, filtro));
    if (!ordenacao) return resultado;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => {
      switch (ordenacao.coluna) {
        case "numero":
          return sinal * (a.pedido.numero - b.pedido.numero);
        case "fornecedor":
          return sinal * a.pedido.fornecedorNome.localeCompare(b.pedido.fornecedorNome, "pt-BR");
        case "entrega":
          return sinal * ((a.pedido.previsaoEntrega ?? "").localeCompare(b.pedido.previsaoEntrega ?? ""));
        case "status":
          return sinal * statusExibicaoLabels[a.status].localeCompare(statusExibicaoLabels[b.status], "pt-BR");
      }
    });
     
  }, [porBusca, filtro, ordenacao]);

  return (
    <Card className="gap-4 py-4">
      <div className="flex flex-wrap items-center gap-2 px-4">
        <CampoBusca
          value={query}
          onChange={setQuery}
          placeholder="Buscar por fornecedor, insumo, nº, status..."
        />
        <FiltroOpcoesContadas nome="Situação dos pedidos de compra" valor={filtro} onValueChange={setFiltro}
          opcoes={FILTROS.map(opcao => ({ valor: opcao.valor, nome: opcao.label,
            quantidade: porBusca.filter(linha => correspondeSituacao(linha, opcao.valor)).length }))} />
      </div>

      {filtro === "EXCLUIDOS" && <p className="px-4 text-sm text-muted-foreground">Pedidos excluídos, preservados para consulta. Seus itens, recebimentos e responsáveis permanecem no histórico.</p>}

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <ShoppingCart className="size-8 text-muted-foreground" />
          <p className="font-medium">{pedidos.length === 0 ? "Nenhum pedido registrado ainda." : "Nenhum pedido encontrado."}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                active={ordenacao?.coluna === "numero"}
                direction={ordenacao?.direcao}
                onClick={() => alternarOrdenacao("numero")}
              >
                Número
              </SortableTableHead>
              <SortableTableHead
                active={ordenacao?.coluna === "fornecedor"}
                direction={ordenacao?.direcao}
                onClick={() => alternarOrdenacao("fornecedor")}
              >
                Fornecedor
              </SortableTableHead>
              <TableHead className="hidden md:table-cell">Itens</TableHead>
              <SortableTableHead
                className="hidden sm:table-cell"
                active={ordenacao?.coluna === "entrega"}
                direction={ordenacao?.direcao}
                onClick={() => alternarOrdenacao("entrega")}
              >
                Entrega
              </SortableTableHead>
              <SortableTableHead
                active={ordenacao?.coluna === "status"}
                direction={ordenacao?.direcao}
                onClick={() => alternarOrdenacao("status")}
              >
                Status
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map(({ pedido, status }) => (
              <TableRow key={pedido.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelecionar(pedido)}>
                <TableCell className="font-medium">{formatarNumeroPedido(pedido.numero)}</TableCell>
                <TableCell>{pedido.fornecedorNome}</TableCell>
                <TableCell className="hidden max-w-xs truncate md:table-cell">{resumoItensPedido(pedido.itens)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {pedido.previsaoEntrega ? new Date(pedido.previsaoEntrega).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  <StatusPedidoBadge status={status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
