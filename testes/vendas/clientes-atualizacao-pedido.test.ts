import { describe, expect, it } from "vitest";
import { validarAtualizacaoClientePedido } from "@/lib/vendas/cliente-pedido";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";

const cliente = { id: "cliente-ficticio", versao: 3, nome: "Nome anterior", primeiroNome: "Ana", sobrenome: "Fictícia", tipo: "PF", documento: null, email: "ana@example.invalid", telefone: "+55 11 99999-0000", contato: null };
const endereco = { nome: "Cobrança", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", numero: "1", complemento: "Casa", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
describe("atualização do cadastro pelo pedido", () => {
  it("normaliza identidade e telefone sem exigir ou inventar alterações de endereço", () => {
    const d = validarAtualizacaoClientePedido(cliente);
    expect(d).toMatchObject({ id: cliente.id, versao: 3, nome: "Nome anterior", telefone: "+5511999990000", email: cliente.email });
    expect(d).not.toHaveProperty("enderecos"); expect(d).not.toHaveProperty("entregaPadrao");
  });
  it("não aceita status, regras de pagamento ou observações como edição pelo pedido", () => {
    const d = validarAtualizacaoClientePedido({ ...cliente, ativo: false, observacoes: "Alteração indevida", regrasPagamento: { limiteCreditoAberto: "0" } });
    expect(d).not.toHaveProperty("ativo"); expect(d).not.toHaveProperty("regrasPagamento"); expect(d).not.toHaveProperty("observacoes");
  });
  it("valida cobrança e entrega padrão somente quando informadas", () => {
    expect(validarAtualizacaoClientePedido({ ...cliente, enderecos: [endereco], entregaPadrao: { destinatario: { nome: "Destinatária fictícia", contato: "11999990000" }, endereco } })).toMatchObject({ enderecos: [endereco], entregaPadrao: { endereco: { numero: "1" } } });
    expect(() => validarAtualizacaoClientePedido({ ...cliente, enderecos: [] })).toThrow(/cobrança/);
    expect(() => validarAtualizacaoClientePedido({ ...cliente, enderecos: [{ ...endereco, numero: "" }] })).toThrow();
  });
  it("exige revisão e identidade válidas, inclusive ao trocar PF por PJ", () => {
    expect(() => validarAtualizacaoClientePedido({ ...cliente, versao: 0 })).toThrow(/reabra/);
    expect(() => validarAtualizacaoClientePedido({ ...cliente, tipo: "PJ", nome: "" })).toThrow(/Nome:/);
    expect(() => validarAtualizacaoClientePedido({ ...cliente, telefone: "letras" })).toThrow(/telefone/);
    expect(() => validarAtualizacaoClientePedido({ ...cliente, dataNascimento: "2000-02-30" })).toThrow(/nascimento/);
    expect(validarAtualizacaoClientePedido({ ...cliente, tipo: "PJ", nome: "Empresa fictícia", razaoSocial: "Razão fictícia", documento: "12345678000190", nomeContato: "Ana", sobrenomeContato: "Contato" })).toMatchObject({ nome: "Empresa fictícia", contato: "Ana Contato" });
  });
  it("recusa atualização de outro cliente e não mistura criação com atualização", () => {
    const pedido = { clienteId: "outro", clienteAtualizacao: cliente, itens: [], desconto: "0", frete: "0" };
    expect(() => validarEntradaPedido(pedido)).toThrow(/cliente selecionado/);
  });
});
