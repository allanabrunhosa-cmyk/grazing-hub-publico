import { createRoot } from "react-dom/client";
import { ContasBancariasView } from "@/app/(protegido)/financeiro/bancario/contas-bancarias-view";
import { Toaster } from "sonner";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
if (parametros.has("escuro")) document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-5xl space-y-6 p-6">
  <p className="text-sm text-muted-foreground">Prévia local com dados fictícios, sem gravações financeiras.</p>
  <ContasBancariasView podeEditarSaldo={!parametros.has("comum")} contas={[
    { id: "banco", nome: "Conta corrente — teste", saldoInicial: 1500.50, dataSaldoInicial: "2026-09-10", saldoAtual: 1400.50, ativo: true },
    { id: "caixa", nome: "Caixa — teste", saldoInicial: -50, dataSaldoInicial: null, saldoAtual: -50, ativo: false },
  ]} movimentacoesPorConta={{ banco: [
    { id: "atual", tipo: "SAIDA", valor: 100, data: "2026-09-10T12:00:00Z", descricao: "Compra de materiais", contaBancariaNome: "Conta corrente — teste" },
    { id: "antiga", tipo: "ENTRADA", valor: 500, data: "2026-09-09T12:00:00Z", descricao: "Recebimento anterior", contaBancariaNome: "Conta corrente — teste" },
  ] }} />
  <Toaster />
</main>);
