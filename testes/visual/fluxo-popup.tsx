import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { lancamentoTeste } from "../financeiro/dados-movimentacoes";
import "@/app/globals.css";

const dia = periodoMesAteHoje().ate;
const descricoes = [
  `NF-e ${"1234567890".repeat(5)} — COMPRA FICTÍCIA COM DESCRIÇÃO EXTENSA DO PRODUTO E OBSERVAÇÕES`,
  "Compra fictícia curta",
  `Referência sem espaços: ${"REFERENCIA".repeat(20)}`,
];
const lancamentos = Array.from({ length: 18 }, (_, indice) => lancamentoTeste({
  id: `ficticio-${indice}`, descricao: descricoes[indice % descricoes.length],
  valor: indice === 0 ? 1234567.89 : 140 + indice, categoriaGrupo: "CMV",
  categoriaId: "cmv", categoriaNome: "Compra fictícia",
  status: indice % 2 ? "PENDENTE" : "BAIXADO",
  dataCompetencia: `${dia}T12:00:00Z`, dataVencimento: `${dia}T12:00:00Z`,
  dataPagamento: indice % 2 ? null : `${dia}T12:00:00Z`,
  faturaId: indice === 2 ? "fatura-ficticia" : undefined,
  pedidoVendaId: indice === 3 ? "pedido-ficticio" : undefined,
}));
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-4 p-6">
  <p className="text-sm text-muted-foreground">Prévia isolada com 18 movimentações fictícias. Sem acesso ao banco.</p>
  <h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
  <FluxoCaixaView saldoInicialTotal={0} lancamentos={lancamentos} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} />
  <Toaster />
</main>);
