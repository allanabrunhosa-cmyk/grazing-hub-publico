import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { periodoDoMes, periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { lancamentoTeste } from "../financeiro/dados-movimentacoes";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
const nomesLongos = parametros.has("nomes-longos");
const nomePessoal = nomesLongos ? "Pessoal e despesas operacionais da equipe fictícia com identificação longa" : "Pessoal";
const nomeBeneficios = nomesLongos ? "Benefícios e alimentação da equipe fictícia em períodos de produção" : "Benefícios";
const nomeAlimentacao = nomesLongos ? "Alimentação complementar da equipe fictícia com descrição longa da categoria" : "Alimentação";
const mesAtual = periodoMesAteHoje().de.slice(0, 7);
const periodoAtual = periodoDoMes(mesAtual)!;
const referenciaAnterior = new Date(`${mesAtual}-15T12:00:00`);
referenciaAnterior.setMonth(referenciaAnterior.getMonth() - 1);
const mesAnterior = `${referenciaAnterior.getFullYear()}-${String(referenciaAnterior.getMonth() + 1).padStart(2, "0")}`;
const periodoAnterior = periodoDoMes(mesAnterior)!;
const plano = [
  { id: "vendas", nome: "Vendas fictícias", grupo: "RECEITA_BRUTA" as const },
  { id: "pai", nome: nomePessoal, grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "filho", nome: `${nomePessoal} › ${nomeBeneficios}`, paiId: "pai", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "neto", nome: `${nomePessoal} › ${nomeBeneficios} › ${nomeAlimentacao}`, paiId: "filho", grupo: "DESPESAS_OPERACIONAIS" as const },
];
const receitas = [
  { id: "receita-anterior", dia: periodoAnterior.ate, valor: 111.11, status: "BAIXADO" as const },
  { id: "receita-inicio", dia: periodoAtual.de, valor: 1000.10, status: "BAIXADO" as const },
  { id: "receita-meio", dia: `${mesAtual}-15`, valor: 1000.20, status: "BAIXADO" as const },
  { id: "receita-fim", dia: periodoAtual.ate, valor: 1000.30, status: "PENDENTE" as const },
].map(({ id, dia, valor, status }) => lancamentoTeste({
  id, tipo: "RECEITA", descricao: `Venda fictícia ${id}`, valor, status,
  categoriaId: "vendas", categoriaNome: "Vendas fictícias", categoriaGrupo: "RECEITA_BRUTA",
  dataCompetencia: `${dia}T12:00:00Z`, dataVencimento: `${dia}T12:00:00Z`,
  dataPagamento: status === "BAIXADO" ? `${dia}T12:00:00Z` : null,
}));
const despesas = Array.from({ length: 16 }, (_, indice) => {
  const dia = indice % 2 ? periodoAtual.ate : periodoAtual.de;
  return lancamentoTeste({
    id: `despesa-${indice}`, categoriaId: "neto", categoriaNome: plano[3].nome,
    descricao: indice === 0
      ? `Alimentação fictícia com descrição extensa: ${"REFERENCIA".repeat(24)}`
      : `Alimentação fictícia ${indice + 1}`,
    valor: 150 + indice + 0.25,
    status: indice % 2 ? "PENDENTE" : "BAIXADO",
    dataCompetencia: `${dia}T12:00:00Z`, dataVencimento: `${dia}T12:00:00Z`,
    dataPagamento: indice % 2 ? null : `${dia}T12:00:00Z`,
  });
});
const vazio = parametros.has("vazio");
const caso = parametros.get("caso");
const receitasDoCenario = caso === "negativo"
  ? receitas.filter(receita => receita.id === "receita-anterior" || receita.id === "receita-inicio")
  : caso === "zero"
    ? receitas.filter(receita => receita.id === "receita-anterior" || receita.id === "receita-inicio")
      .map(receita => receita.id === "receita-inicio" ? { ...receita, valor: 2524 } : receita)
    : receitas;

createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
    <p className="text-sm text-muted-foreground">Prévia isolada com dados fictícios. Sem acesso ao banco.</p>
    <h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
    <FluxoCaixaView saldoInicialTotal={500} lancamentos={vazio ? [] : [...receitasDoCenario, ...despesas]}
      planoContas={vazio ? [] : plano} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} />
    <Toaster />
  </main>,
);
