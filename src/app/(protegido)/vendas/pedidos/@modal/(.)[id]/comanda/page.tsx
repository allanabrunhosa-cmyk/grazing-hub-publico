import { ConteudoComanda } from "../../../[id]/comanda/conteudo";
import { retornoGestorSeguro } from "../../../pedidos-navegacao";

export default async function ComandaInterceptada({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retorno?: string }> }) {
  return <ConteudoComanda params={params} retorno={retornoGestorSeguro((await searchParams).retorno)} />;
}
