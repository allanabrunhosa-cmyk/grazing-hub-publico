import type { ResumoCancelamentoCompra } from "@/lib/financeiro/cancelamento-compra-tipos";

export function ReversaoCompraAviso({ resumo }: { resumo: ResumoCancelamentoCompra }) {
  return <div className="space-y-3 text-sm">
    <p role="status">A compra inteira será cancelada, incluindo {resumo.quantidadeLancamentos} {resumo.quantidadeLancamentos === 1 ? "lançamento financeiro" : "lançamentos financeiros"}. O histórico será preservado.</p>
    {resumo.itens.length ? <>
      <p className="font-medium">As entradas abaixo serão estornadas: estas quantidades serão retiradas do estoque, com a mesma data e o mesmo local da entrada original.</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3" aria-label="Itens que terão a entrada estornada">
        {resumo.itens.map(item => <li key={item.movimentoId}>
          <strong>{item.descricao}</strong> — {Number(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {item.unidade}
          <span className="block text-muted-foreground">{item.local} · Entrada em {new Date(item.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
        </li>)}
      </ul>
    </> : <p>Esta compra não gerou entradas de estoque.</p>}
  </div>;
}
