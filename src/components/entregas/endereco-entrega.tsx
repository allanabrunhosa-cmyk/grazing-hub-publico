"use client";
import type { EnderecoEntrega } from "@/lib/vendas/entregas-dominio";
import { CamposEnderecoPedido } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";
export function CamposEnderecoEntrega({ valor, alterar, prefixo = "Endereço", somenteLeitura = false, onConsultandoCepChange, consultarCep }: { valor: EnderecoEntrega; alterar: (v: EnderecoEntrega) => void; consultarCep: (cep: string) => Promise<{ endereco?: Partial<EnderecoEntrega>; erro?: string }>; prefixo?: string; somenteLeitura?: boolean; onConsultandoCepChange?: (v: boolean) => void }) {
  return <div role="group" aria-label={prefixo}><CamposEnderecoPedido valor={valor} alterar={alterar} mostrarPais={false} complementoObrigatorio={false} somenteLeitura={somenteLeitura} consultarCep={consultarCep} onConsultandoCepChange={onConsultandoCepChange} /></div>;
}
