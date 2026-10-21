import { describe, expect, it } from "vitest";
import { validarEntradaPedido, exigirPagamentoConfirmacao, exigirPedidoConfirmavel } from "@/lib/vendas/pedidos-dominio";
import { indiceEnderecoCobrancaInicial, validarClienteNovoPedido } from "@/lib/vendas/cliente-pedido";
import { validarEntregaPadraoCliente } from "@/lib/vendas/dominio";

const endereco = (numero: string) => ({ pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", numero, complemento: "Sala fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" });
const orcamento = { clienteId: null, canalId: null, atendimento: "ENTREGA", prazo: "IMEDIATO", itens: [] };

describe("Contrato compartilhado Clientes / Pedidos", () => {
  it("conserva a cobrança preferida em endereços legados e inicia cadastros novos na primeira aba", () => {
    expect(indiceEnderecoCobrancaInicial([{ nome: "Casa" }, { nome: "Cobrança" }])).toBe(1);
    expect(indiceEnderecoCobrancaInicial([{ nome: "Endereço 1" }, { nome: "Endereço 2" }])).toBe(0);
  });
  it("a aba selecionada prevalece sobre cobrança divergente enviada pelo navegador", () => {
    const d = validarEntradaPedido({ ...orcamento, cobranca: endereco("999"), enderecosCobranca: [endereco("1"), endereco("2")], cobrancaSelecionada: 1 });
    expect(d.cobranca?.numero).toBe("2");
    expect(validarEntradaPedido(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it.each([-1, 2, 1.5, "1"])("rejeita seleção inválida %s", selecionado => {
    expect(() => validarEntradaPedido({ ...orcamento, enderecosCobranca: [endereco("1"), endereco("2")], cobrancaSelecionada: selecionado })).toThrow(/endereço de cobrança válido/);
  });
  it("conserva todos os endereços no cadastro inline e exige validade de cada um", () => {
    const cliente = { id: "", versao: 0, nome: "Pessoa fictícia", primeiroNome: "Pessoa", sobrenome: "fictícia", tipo: "PF" as const, documento: null, email: "pessoa@example.invalid", telefone: "+5511999991234", contato: null, observacoes: null, ativo: true, enderecos: [1, 2].map(n => ({ ...endereco(String(n)), nome: `Endereço ${n}`, destinatario: "" })) };
    expect(validarClienteNovoPedido(cliente).enderecos.map(e => e.numero)).toEqual(["1", "2"]);
    expect(() => validarClienteNovoPedido({ ...cliente, enderecos: [cliente.enderecos[0], { ...cliente.enderecos[1], numero: "" }] })).toThrow(/obrigatórios/);
  });
  it("confirma com complemento vazio na cobrança e na entrega, mantendo os demais campos obrigatórios", () => {
    const d = validarEntradaPedido({ ...orcamento, clienteId: "c", canalId: "site", destinatario: { nome: "Pessoa fictícia" }, cobranca: { ...endereco("1"), complemento: "" }, endereco: { ...endereco("2"), complemento: "" }, itens: [{ produtoId: "p", quantidade: "1" }] });
    expect(() => exigirPedidoConfirmavel(d)).not.toThrow();
    expect(() => exigirPedidoConfirmavel({ ...d, endereco: { ...d.endereco!, numero: "" } })).toThrow(/endereço/);
    expect(() => exigirPedidoConfirmavel({ ...d, cobranca: { ...d.cobranca!, cidade: "" } })).toThrow(/cobrança/);
  });
  it("orçamento sem pagamento é válido, mas a confirmação exige informação explícita", () => {
    const d = validarEntradaPedido(orcamento);
    expect(d.pagamentoInformado).toBeUndefined();
    expect(() => exigirPagamentoConfirmacao(d, "EXTERNO", false)).toThrow(/pagamento/);
    expect(() => exigirPagamentoConfirmacao(d, "EXTERNO", true)).toThrow(/pagamento/);
    expect(() => exigirPagamentoConfirmacao(d, "HUB", false)).toThrow(/pagamento/);
    expect(() => exigirPagamentoConfirmacao(d, "HUB", true)).not.toThrow();
    expect(() => exigirPagamentoConfirmacao({ ...d, pagamentoInformado: { formaId: "pix-ficticio", parcelas: 1, vencimentos: [] } }, "EXTERNO", false)).not.toThrow();
  });
  it("dados padrão de entrega excluem informações próprias do pedido", () => {
    const entrega = validarEntregaPadraoCliente({ destinatario: { nome: "Pessoa fictícia", contato: "+55(11)97658-6412" }, endereco: endereco("3"), atendimento: "RETIRADA", previsaoData: "2026-10-10" });
    expect(entrega).toEqual({ destinatario: { nome: "Pessoa fictícia", primeiroNome: "", sobrenome: "", contato: "+5511976586412" }, endereco: endereco("3") });
    expect(validarEntregaPadraoCliente(null)).toBeNull();
  });
});
