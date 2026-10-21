import { createRoot } from "react-dom/client";
import { NotaFiscalDialog } from "@/app/(protegido)/notas-fiscais/nota-fiscal-dialog";
import { ImportarXmlDialog } from "@/app/(protegido)/notas-fiscais/importar-xml-dialog";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
import { notaTeste, opcoesTeste } from "../notas-fiscais/dados";
import "@/app/globals.css";

const semXml = new URLSearchParams(location.search).has("semXml");
const categorias = [
  { id: "queijos", nome: "Queijos e frios", grupo: "CMV" as const },
  { id: "aluguel", nome: "Aluguel", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "limpeza", nome: "Material de limpeza", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "vendas", nome: "Venda de tábuas", grupo: "RECEITA_BRUTA" as const },
  { id: "juros", nome: "Rendimentos", grupo: "RECEITAS_NAO_OPERACIONAIS" as const },
];
const opcoesFinanceiras = { categorias, fornecedores: [], formasPagamento: [], contasBancarias: [] };
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-5xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Manifesto de Notas</h1>
    <p className="text-sm text-muted-foreground">Teste visual local com dados fictícios. Nenhum envio à SEFAZ ou gravação no banco.</p>
    <NotaFiscalDialog nota={{ ...notaTeste, temXmlCompleto: !semXml }} {...opcoesTeste} categoriasFinanceiras={categorias.filter((categoria) => categoria.grupo !== "RECEITA_BRUTA" && categoria.grupo !== "RECEITAS_NAO_OPERACIONAIS")} trigger={<Button>Ver nota</Button>} />
    <ImportarXmlDialog />
    <LancamentoDialog {...opcoesFinanceiras} />
    <h2 className="text-xl">DRE</h2>
    <DreView lancamentos={[]} />
    <h2 className="text-xl">Fluxo de caixa</h2>
    <FluxoCaixaView saldoInicialTotal={0} lancamentos={[]} {...opcoesFinanceiras} />
    <Toaster />
  </main>
);
