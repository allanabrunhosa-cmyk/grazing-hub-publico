import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { MovimentacoesView } from "@/app/(protegido)/financeiro/movimentacoes/movimentacoes-view";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
import { lancamentoTeste } from "../financeiro/dados-movimentacoes";
import "@/app/globals.css";

const opcoes = { categorias: [{ id: "despesas", nome: "Ocupação", grupo: "DESPESAS_OPERACIONAIS" as const }], fornecedores: [], formasPagamento: [], contasBancarias: [{ id: "banco", nome: "Conta principal" }] };
const linhas = [lancamentoTeste(), lancamentoTeste({ id: "vendas", descricao: "Vendas de tábuas · delivery", tipo: "RECEITA", valor: 2450, status: "BAIXADO", dataPagamento: "2026-09-10T12:00:00Z", categoriaNome: "Vendas", contraparteNome: "Clientes", contaBancariaNome: "Conta principal" }), lancamentoTeste({ id: "fornecedor", descricao: "Compra de queijos e frios (1/2)", valor: 685.88, dataVencimento: "2026-09-15T12:00:00Z", categoriaNome: "Insumos", contraparteNome: "Fornecedor de frios" })];
const notaFiscal = { id: "nf-31562", numero: "31562", serie: "1", fornecedorNome: "Distribuidora de Frios" };
linhas.push(
  lancamentoTeste({ id: "descricao-longa", descricao: "Compra de embalagens personalizadas para entregas e eventos corporativos", valor: 123456.78, dataVencimento: "2026-09-18T12:00:00Z", categoriaNome: "Embalagens e materiais de acondicionamento", contraparteNome: "Fornecedor de embalagens" }),
  lancamentoTeste({ id: "valor-curto", descricao: "Tarifa", valor: 1.50, status: "BAIXADO", dataPagamento: "2026-09-18T12:00:00Z", categoriaNome: "Tarifas bancárias", contaBancariaNome: "Conta principal" }),
  lancamentoTeste({ id: "nf-queijo", descricao: `NF-e ${"1".repeat(44)} — Queijo brie`, notaFiscalItemDescricao: "Queijo brie", valor: 425.50, dataVencimento: "2026-09-15T12:00:00Z", categoriaNome: "Insumos", notaFiscal }),
  lancamentoTeste({ id: "nf-presunto", descricao: "Presunto parma", valor: 260.38, dataVencimento: "2026-09-15T12:00:00Z", categoriaNome: "Insumos", notaFiscal }),
);
if (new URLSearchParams(location.search).has("historica")) linhas.push(lancamentoTeste({ id: "historica-ficticia", descricao: "Despesa histórica fictícia", valor: 70, dataVencimento: "1000-01-01", categoriaNome: "Ocupação" }));
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-6 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-heading text-display">Movimentações</h1><p className="text-sm text-muted-foreground">Seu extrato de receitas e despesas, realizadas e previstas</p></div><LancamentoDialog {...opcoes} /></div><MovimentacoesView linhas={linhas} avulsas={[]} saldoInicial={5000} {...opcoes} /><Toaster /></main>);
