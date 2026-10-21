import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { PlanoContasView } from "@/app/(protegido)/financeiro/plano-de-contas/plano-contas-view";
import { ContasBancariasView } from "@/app/(protegido)/financeiro/bancario/contas-bancarias-view";
import "@/app/globals.css";
const conta = { id: "ficticia", nome: "Conta fictícia", saldoInicial: 1000, saldoAtual: 1000, dataSaldoInicial: "2026-09-01", ativo: true };
const categoria = { grupo: "RECEITA_BRUTA" as const, ativo: true, excluidoEm: null, centroCustoId: null, centroCustoNome: null, quantidadeLancamentos: 0, quantidadeItensNota: 0, quantidadeItensFatura: 0, quantidadeRegrasCartao: 0, quantidadeSubcategorias: 0 };
function Previa() {
  const [plano, setPlano] = useState(false);
  return <ThemeProvider attribute="class" defaultTheme="light"><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><div className="estrutura-sistema"><Sidebar /><div className="painel-sistema"><CabecalhoConteudo sessao={{ nome: "Equipe fictícia" }} /><main className="conteudo-sistema space-y-6"><p className="text-sm text-muted-foreground">Prévia fictícia sem movimentação real.</p><Button variant="outline" onClick={() => setPlano(!plano)}>{plano ? "Ver contas fictícias" : "Ver plano fictício"}</Button>{plano ? <PlanoContasView categorias={[{ ...categoria, id: "raiz", nome: "Receitas fictícias", paiId: null, quantidadeSubcategorias: 1 }, { ...categoria, id: "filha", nome: "Eventos fictícios", paiId: "raiz" }]} centrosCusto={[]} /> : <ContasBancariasView contas={[conta]} cartoes={[{ id: "cartao", nome: "Cartão fictício", ativo: true, contaBancariaId: conta.id, contaBancariaNome: conta.nome, diaFechamento: 10, diaVencimento: 20 }]} movimentacoesPorConta={{}} />}</main></div></div><Toaster /></ProvedorAcesso></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<Previa />);
