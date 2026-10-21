import { createRoot } from "react-dom/client";
import { ConciliacaoView } from "@/app/(protegido)/financeiro/movimentacoes/conciliacao-view";
import { lancamentoTeste } from "../financeiro/dados-movimentacoes";
import type { ExtratoBancarioRow } from "@/lib/financeiro/conciliacao/types";
import "@/app/globals.css";
const t: ExtratoBancarioRow = { id: "banco-exemplo", contaBancariaId: "conta-exemplo", data: "2026-09-01", descricao: "PIX HORTA EXEMPLO", valor: -125.55, conciliadaEm: null, conciliadaPorNome: null, identificador: "EXEMPLO", arquivo: "extrato-ficticio.csv", lancamentoIds: [], historico: [] };
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6"><header><h1 className="font-heading text-display">Conciliação bancária</h1><p className="mt-2 text-sm text-muted-foreground">Prévia isolada · extrato em 01/09/2026 · vencimento em 25/08/2026.</p></header><ConciliacaoView
  linhas={[lancamentoTeste({ id: "despesa-exemplo", descricao: "Compra de hortifruti", fornecedorNome: "Horta Exemplo", valor: 125.55, versao: "exemplo", dataVencimento: "2026-08-25", contaBancariaId: "conta-exemplo", categoriaNome: "Insumos" })]}
  transacoes={[t, { ...t, id: "conciliada-exemplo", descricao: "BOLETO EXEMPLO CONCILIADO", conciliadaEm: "2026-09-01", valor: -300 }]}
  contasBancarias={[{ id: "conta-exemplo", nome: "Conta Exemplo" }]} categorias={[]} fornecedores={[]} formasPagamento={[]}
  acesso={{ importar: false, conciliar: true, criar: false, baixar: true, desfazer: false, editarMovimentacao: false, excluirMovimentacao: false }}
  periodo={{ de: "2026-09-01", ate: "2026-09-01" }} aoAlterarPeriodo={() => {}} /></main>);
