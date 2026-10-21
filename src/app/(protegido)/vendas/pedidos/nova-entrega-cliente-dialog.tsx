"use client";

import { useState, type ComponentProps } from "react";
import type { EntregaCliente } from "@/lib/vendas/dominio";
import { indiceEnderecoPostalDuplicado, pendenciaEnderecoPostal } from "@/lib/vendas/cliente-enderecos";
import { CamposDestinatarioCliente } from "./cadastro-cliente-form";
import { CamposEnderecoPedido, enderecoPedidoVazio } from "./endereco-pedido-form";
import { DialogAdicionarEndereco } from "./endereco-cliente-ui";

export function NovaEntregaClienteDialog({ entregas, inicial, consultarCep, confirmar, fechar }: { entregas: EntregaCliente[]; inicial?: EntregaCliente; consultarCep?: ComponentProps<typeof CamposEnderecoPedido>["consultarCep"]; confirmar: (entrega: EntregaCliente) => void; fechar: () => void }) {
  const [valor, setValor] = useState<EntregaCliente>(() => inicial ?? { destinatario: { nome: "", contato: "" }, endereco: enderecoPedidoVazio() });
  const [ocupado, setOcupado] = useState(false);
  function validar() {
    if (!valor.destinatario.nome.trim()) return "Informe o Nome Completo do destinatário.";
    const pendencia = pendenciaEnderecoPostal(valor.endereco);
    if (pendencia) return pendencia;
    const duplicado = indiceEnderecoPostalDuplicado(entregas.map(entrega => entrega.endereco), valor.endereco);
    return duplicado === null ? null : `Este endereço já está cadastrado em Entrega ${duplicado + 1}. Selecione o endereço existente.`;
  }
  return <DialogAdicionarEndereco titulo="Adicionar endereço de entrega" ocupado={ocupado} validar={validar} confirmar={() => confirmar(valor)} fechar={fechar}>
    <CamposDestinatarioCliente obrigatorio valor={valor.destinatario} alterar={destinatario => setValor(atual => ({ ...atual, destinatario }))} />
    <CamposEnderecoPedido obrigatorio valor={valor.endereco} alterar={endereco => setValor(atual => ({ ...atual, endereco }))} consultarCep={consultarCep} onConsultandoCepChange={setOcupado} />
  </DialogAdicionarEndereco>;
}
