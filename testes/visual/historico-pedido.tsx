import React, {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {ThemeProvider} from "@/components/theme-provider";
import {Button} from "@/components/ui/button";
import {PainelHistoricoPedido,type EntregaOriginalHistorica} from "@/app/(protegido)/vendas/pedidos/historico-pedido-conteudo";
import {MensagemPopupPedido} from "@/app/(protegido)/vendas/pedidos/mensagem-popup";
import {criarHistoricoPedidoFixture} from "./historico-pedido-fixture";
import "@/app/globals.css";

const consulta=new URLSearchParams(location.search),registro=criarHistoricoPedidoFixture();
const entregaOriginal:EntregaOriginalHistorica|undefined=consulta.get("entrega")==="confirmada"?{modalidade:"ENTREGA",enderecoOriginal:"Rua sintética do destino original, 42\nComplemento e referência originais de entrega\nBairro fictício, Cidade sintética — SP"}:consulta.get("entrega")==="retirada"?{modalidade:"RETIRADA",enderecoOriginal:null}:undefined;
if(consulta.get("estado")==="vazio"){registro.itens=[];registro.notas_originais=null;registro.excecoes=[];}
function Previa(){
 const [aberto,setAberto]=useState(true);
 useEffect(()=>{const fechar=()=>setAberto(false);window.addEventListener("gestor-consulta-simulada",fechar);return()=>window.removeEventListener("gestor-consulta-simulada",fechar);},[]);
 return <main className="space-y-4 p-4"><h1 className="text-title font-semibold">Prévia sintética de pedido histórico</h1><p>Dados fictícios. Consulta isolada, sem banco ou ações externas.</p><Button onClick={()=>setAberto(true)}>Abrir pedido histórico fictício</Button>{aberto&&(consulta.get("estado")==="erro"?<MensagemPopupPedido titulo="Histórico indisponível" mensagem="A fonte deste pedido precisa de conferência."/>:<PainelHistoricoPedido registro={registro} entregaOriginal={entregaOriginal}/>)}</main>;
}
document.body.dataset.identidade="pedidos";
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" forcedTheme={consulta.get("tema")==="escuro"?"dark":"light"}><Previa/></ThemeProvider>);
