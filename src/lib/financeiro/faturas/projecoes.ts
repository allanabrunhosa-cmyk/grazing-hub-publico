import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";
import type { LancamentoParaDre } from "../calcularDre";

export type ParcelaLiquidada = {id:string;valor:number;pagamento:{id:string;data:string;contaIdOriginal:string;revertidoEm:string|null}};
export type ProjecaoFatura = {faturaId:string;cartao:string;liquidacoes:ParcelaLiquidada[]};
// Projeções de leitura, nunca novos lançamentos. A despesa integral continua na competência.
export function projetarCaixaFatura(l:LancamentoRow,p:ProjecaoFatura|null):LancamentoRow[]{
  if(!p)return [l];
  const liquidacoes=p.liquidacoes.filter(q=>!q.pagamento.revertidoEm);
  const pago=liquidacoes.reduce((s,q)=>s+Math.round(q.valor*100),0);
  const restante=Math.round(l.valor*100)-pago;
  const base={...l,faturaId:p.faturaId,notaFiscal:null};
  return [
    ...liquidacoes.filter(q=>q.valor!==0).map(q=>({...base,id:`fatura:${l.id}:${q.id}`,valor:q.valor,status:"BAIXADO" as const,dataPagamento:q.pagamento.data,contaBancariaId:q.pagamento.contaIdOriginal,pagamentoFaturaId:q.pagamento.id,cartaoNome:p.cartao})),
    ...(restante!==0?[{...base,id:`fatura:${l.id}:pendente`,valor:restante/100,status:"PENDENTE" as const,dataPagamento:null,cartaoNome:p.cartao}]:[]),
  ];
}
export function projetarDreFatura(l:LancamentoParaDre,liquidacoes:ParcelaLiquidada[]|null):LancamentoParaDre {
  return liquidacoes===null?l:{...l,liquidacoesCartao:liquidacoes.filter(q=>!q.pagamento.revertidoEm).map(q=>({valor:q.valor,data:q.pagamento.data}))};
}
