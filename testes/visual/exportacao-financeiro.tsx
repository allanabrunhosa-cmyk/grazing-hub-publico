import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { lancamentoTeste } from "../financeiro/dados-movimentacoes";
import "@/app/globals.css";

const dia = periodoMesAteHoje().ate;
const plano = [
  { id: "pai", nome: "Pessoal", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "filho", nome: "Pessoal › Benefícios", paiId: "pai", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "neto", nome: "Pessoal › Benefícios › Alimentação", paiId: "filho", grupo: "DESPESAS_OPERACIONAIS" as const },
];
const lancamentos = [
  lancamentoTeste({ id: "despesa", descricao: "Alimentação da equipe (fictício)", categoriaId: "neto", categoriaNome: plano[2].nome, valor: 1234.56, dataVencimento: `${dia}T12:00:00Z`, dataCompetencia: `${dia}T12:00:00Z` }),
  lancamentoTeste({ id: "receita", tipo: "RECEITA", descricao: "Venda de teste", categoriaId: "vendas", categoriaNome: "Vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 9876.54, status: "BAIXADO", dataVencimento: `${dia}T12:00:00Z`, dataCompetencia: `${dia}T12:00:00Z`, dataPagamento: `${dia}T12:00:00Z` }),
];
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-6 p-6">
  <p className="text-sm text-muted-foreground">Prévia isolada com dados fictícios. Sem acesso ao banco.</p>
  <section className="space-y-4"><h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
    <FluxoCaixaView saldoInicialTotal={500} lancamentos={lancamentos} planoContas={plano} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} />
  </section>
  <section className="space-y-4"><h2 className="text-2xl font-semibold">DRE</h2><DreView lancamentos={lancamentos} /></section>
  <Toaster />
</main>);
