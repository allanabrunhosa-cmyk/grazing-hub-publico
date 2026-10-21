import { describe, expect, it } from "vitest";
import { validarCliente } from "@/lib/vendas/dominio";
import { exigirPedidoConfirmavel, validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";

const cobranca = { nome: "Cobrança", destinatario: "", pais: "Brasil", cep: "01001-000", logradouro: "Rua Fictícia", numero: "10", complemento: "Sala fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const cliente = { id: "", versao: 0, nome: "Cliente Fictícia", primeiroNome: "Cliente", sobrenome: "Fictícia", tipo: "PF", documento: null, email: null, telefone: "+5511999999999", contato: null, observacoes: null, enderecos: [cobranca], ativo: true };
const pedido = { clienteId: "cliente", canalId: "canal", atendimento: "ENTREGA", prazo: "AGENDADO", previsaoData: "2026-10-10", previsaoJanela: "08:00–09:00", destinatario: { nome: "Destinatário Fictício", primeiroNome: "Destinatário", sobrenome: "Fictício", contato: "" }, endereco: { ...cobranca }, observacoes: "", desconto: "0", frete: "15.00", outrosCustos: "5.00", formaPagamentoInformada: "PIX", itens: [{ produtoId: "produto", quantidade: "1", observacoes: "Embalagem separada", escolhas: {}, precoManual: null }] };

describe("novo pedido e cadastro rápido", () => {
  it("normaliza CEP brasileiro e mantém os campos adicionais do comprador", () => {
    expect(validarCliente(cliente)).toMatchObject({ primeiroNome: "Cliente", sobrenome: "Fictícia", enderecos: [{ pais: "Brasil", cep: "01001000" }] });
  });
  it("preserva outros custos, pagamento informado e observação do item", () => {
    expect(validarEntradaPedido(pedido)).toMatchObject({ outrosCustos: "5.00", formaPagamentoInformada: "PIX", itens: [{ observacoes: "Embalagem separada" }] });
  });
  it("mantém a cobrança própria do pedido para o snapshot comercial", () => {
    expect(validarEntradaPedido({ ...pedido, cobranca: { ...cobranca, numero: "11" } }).cobranca).toMatchObject({ numero: "11", pais: "Brasil" });
  });
  it("exige cobrança e entrega completas na confirmação do novo formulário", () => {
    const entrada = validarEntradaPedido({ ...pedido, cobranca });
    expect(() => exigirPedidoConfirmavel(entrada)).not.toThrow();
    // Complemento é opcional desde 15ac9481; número continua obrigatório.
    expect(() => exigirPedidoConfirmavel({ ...entrada, endereco: { ...entrada.endereco!, complemento: "" } })).not.toThrow();
    expect(() => exigirPedidoConfirmavel({ ...entrada, endereco: { ...entrada.endereco!, numero: "" } })).toThrow("endereço para entrega");
  });
  it("recusa forma não suportada e valores sem centavos válidos", () => {
    expect(() => validarEntradaPedido({ ...pedido, formaPagamentoInformada: "DINHEIRO" })).toThrow("Forma de pagamento");
    expect(() => validarEntradaPedido({ ...pedido, outrosCustos: "5.001" })).toThrow("Outros custos");
  });
  it("permite código postal estrangeiro sem máscara brasileira", () => {
    expect(validarCliente({ ...cliente, enderecos: [{ ...cobranca, pais: "Portugal", cep: "1000-001", uf: "Lisboa" }] }).enderecos[0]).toMatchObject({ pais: "Portugal", cep: "1000-001", uf: "LISBOA" });
  });
});
