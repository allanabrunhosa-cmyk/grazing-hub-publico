import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {ThemeProvider} from "@/components/theme-provider";
import {Sidebar} from "@/components/layout/sidebar";
import {CabecalhoConteudo} from "@/components/layout/cabecalho-conteudo";
import {ProvedorAcesso} from "@/components/layout/acesso-contexto";
import {MovimentacoesView} from "@/app/(protegido)/financeiro/movimentacoes/movimentacoes-view";
import {Toaster} from "@/components/ui/sonner";
import {linhas,transacoes,opcoes} from "./conciliacao-acoes";
import "@/app/globals.css";
function Previa(){const [,atualizar]=useState(0);useEffect(()=>{const evento=()=>atualizar(v=>v+1);window.addEventListener("conciliacao-atualizada",evento);return ()=>window.removeEventListener("conciliacao-atualizada",evento);},[]);return <div className="space-y-6"><div><h1 className="font-heading text-display">Movimentações</h1><p className="text-sm text-muted-foreground">Seu extrato de receitas e despesas, realizadas e previstas</p></div><MovimentacoesView {...opcoes} linhas={linhas} avulsas={[]} saldoInicial={10000} conciliacao={{acesso:{importar:true,conciliar:true,criar:true,baixar:true,desfazer:true,editarMovimentacao:true,excluirMovimentacao:true},transacoes}}/></div>;}
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem><ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><div className="estrutura-sistema"><Sidebar/><div className="painel-sistema"><CabecalhoConteudo sessao={{nome:"Allan Abrunhosa",email:"allan@example.invalid",admin:true,perfilNome:"Administrador"}}/><main className="conteudo-sistema"><Previa/></main></div></div><Toaster/></ProvedorAcesso></ThemeProvider>);
