import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { InsumoForm } from "@/app/(protegido)/insumos/insumo-form";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { PedidoDialog } from "@/app/(protegido)/compras/pedido-dialog";
import { Button } from "@/components/ui/button";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import { contagemTeste } from "../inventario/dados";
import { gerarHtmlContagem } from "@/app/(protegido)/inventario/contagem/impressao";
import "@/app/globals.css";

const conversoes = [{ unidade: "FD" as const, fator: 10 }, { unidade: "PCT" as const, fator: 1 }];
const insumo: InsumoRow = {
  id: "acucar", nome: "Açúcar", tipo: "INSUMO", unidade: "KG", marca: null, codigoEan: null, perecivel: false, validadePadraoDias: null,
  estoqueMinimo: 0, estoqueMaximo: null, custoMedio: 5, fornecedorPrincipalId: null, tipoEstoque: "SECO", observacoes: null,
  rendimentoQuantidade: null, rendimentoUnidade: null, ativo: true, createdAt: new Date(), updatedAt: new Date(), categoria: null,
  centroCusto: null, fornecedorPrincipal: null, fornecedoresHomologados: [], componentes: [], temFoto: false, conversoes, marcasHomologadas: ["União", "Da Barra", "Caravelas"],
};
const contagem = { ...contagemTeste, itens: [{ ...contagemTeste.itens[1], conversoes, quantidadeContada: 20 }] };
function PreviaConversoes() {
  const [pedidoAberto, definirPedidoAberto] = useState(false);
  const apenasMarcas = new URLSearchParams(location.search).has("marcas");
  if (new URLSearchParams(location.search).has("impressao")) return <iframe className="h-screen w-full" title="Contagem impressa" srcDoc={gerarHtmlContagem(contagem, contagem.itens, "")} />;
  return <main className="mx-auto max-w-6xl space-y-6 p-5"><h1 className="text-2xl font-semibold">{apenasMarcas ? "Marcas homologadas" : "Conversões de insumos"}</h1><p>Dados fictícios; nenhuma gravação no banco.</p>
    <InsumoForm insumo={insumo} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} renderFooter={({ pending }) => <Button disabled={pending}>Salvar insumo</Button>} />
    {!apenasMarcas && <><Button onClick={() => definirPedidoAberto(true)}>Testar pedido de compra</Button>
    <PedidoDialog open={pedidoAberto} onOpenChange={definirPedidoAberto} fornecedores={[{ id: "armazem", nome: "Armazém Central" }]} cotacoes={[]} insumos={[{ id: "acucar", nome: "Açúcar", unidade: "KG", custoMedio: 5, fornecedorPrincipalId: "armazem", fornecedorIds: ["armazem"], conversoes }]} />
    <h2 className="text-xl font-semibold">Contagem em kg</h2><ContagemForm contagem={contagem} /></>}<Toaster />
  </main>;
}
createRoot(document.getElementById("root")!).render(<PreviaConversoes />);
