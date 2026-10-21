import { ConteudoPedido } from "../../[id]/conteudo";
import { retornoGestorSeguro } from "../../pedidos-navegacao";

export default async function PedidoInterceptado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retorno?: string; cancelar?: string }> }) {
  const consultas = await searchParams;
  return <ConteudoPedido params={params} retorno={retornoGestorSeguro(consultas.retorno)} abrirCancelamentoInicial={consultas.cancelar === "1"} />;
}
