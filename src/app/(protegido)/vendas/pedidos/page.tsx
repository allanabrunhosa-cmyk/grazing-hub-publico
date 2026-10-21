import { ConteudoGestorPedidos } from "./gestor-conteudo";
import type { GestorFiltros } from "./gestor-dominio";

export default function PedidosPage({ searchParams }: { searchParams: Promise<GestorFiltros> }) {
  return <ConteudoGestorPedidos searchParams={searchParams} />;
}
