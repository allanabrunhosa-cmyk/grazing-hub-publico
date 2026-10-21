import React, { useContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModalPedido, PedidoPopupContext } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { ModalNovoPedido } from "@/app/(protegido)/vendas/pedidos/@modal/(.)novo/modal-novo-pedido";
import { rotaPopupPedido } from "@/app/(protegido)/vendas/pedidos/pedidos-navegacao";
import "@/app/globals.css";

const retorno = "/vendas/pedidos?busca=exemplo-ficticio&canalId=site&pagina=3&modo=calendario&data=2026-10-01";
function FormularioFicticio({ novo }: { novo: boolean }) {
  const popup = useContext(PedidoPopupContext)!;
  const [texto, setTexto] = useState("");
  return <section className="space-y-4"><p className="text-sm text-muted-foreground">Conteúdo sintético, sem ações de servidor e sem gravação de dados.</p><label className="grid gap-1">Observação fictícia<Input value={texto} onChange={e => { setTexto(e.target.value); popup.marcarAlterado(); }} /></label><Select defaultValue="a"><SelectTrigger aria-label="Opção fictícia"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">Primeira opção</SelectItem><SelectItem value="b">Segunda opção</SelectItem></SelectContent></Select><Button onClick={() => { popup.marcarSalvo(); if (novo) popup.navegar("/vendas/pedidos/pedido-ficticio"); }}>Simular formulário salvo{novo ? " e abrir detalhe" : ""}</Button><p>O retorno mantém calendário, canal, busca e página.</p></section>;
}
function PreviaPopup() {
  const [url, setUrl] = useState(retorno);
  useEffect(() => { const receber = (e: Event) => setUrl((e as CustomEvent<string>).detail); window.addEventListener("gestor-consulta-simulada", receber); return () => window.removeEventListener("gestor-consulta-simulada", receber); }, []);
  const caminho = new URL(url, location.origin).pathname;
  const novo = caminho.endsWith("/novo"), detalhe = caminho.endsWith("/pedido-ficticio");
  return <main className="space-y-5 p-4"><h1 className="font-heading text-display">Gestor fictício — teste de popup</h1><p>Nenhum banco, sessão ou pedido real é utilizado nesta prévia. O roteador é simulado; interceptação Next será verificada no build.</p><output className="block break-all" aria-label="URL fictícia atual">{url}</output><Button onClick={() => setUrl(rotaPopupPedido("/vendas/pedidos/novo", retorno))}>Abrir Novo fictício</Button><div className="grid grid-cols-4 gap-3">{["Em preparo", "Pronto", "Em rota", "Entregues"].map(nome => <section key={nome} className="min-h-48 rounded-xl border bg-card p-3"><h2 className="font-semibold">{nome}</h2><p>Sem dados reais.</p></section>)}</div>{novo && <ModalNovoPedido retorno={retorno}><FormularioFicticio novo /></ModalNovoPedido>}{detalhe && <ModalPedido titulo="Pedido fictício #101" descricao="Somente teste de fechamento e retorno." retorno={retorno} protegerAlteracoes><FormularioFicticio novo={false} /></ModalPedido>}</main>;
}
document.body.dataset.identidade = "pedidos";
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><PreviaPopup /></ThemeProvider>);
