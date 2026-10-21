import { describe, expect, it } from "vitest";
import { validarClienteCadastro } from "@/lib/vendas/cliente-pedido";
import type { ClienteEntrada } from "@/lib/vendas/dominio";

const endereco = { nome: "Cobrança", destinatario: "", pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "Casa", bairro: "Centro fictício", cidade: "Cidade fictícia", uf: "SP" };
const cliente: ClienteEntrada = { id: "cliente-ficticio", versao: 7, nome: "Nome antigo", primeiroNome: "Ana", sobrenome: "Fictícia", tipo: "PF", documento: null, email: null, telefone: "+55 11 99999-0000", contato: null, observacoes: null, enderecos: [endereco, { ...endereco, nome: "Outro", numero: "2" }], ativo: true, regrasPagamento: { formasPagamentoIds: [], boletoDiasAposEntrega: 0, limiteCreditoAberto: "0" } };
describe("cadastro de clientes com regras do Novo pedido", () => {
  it("preserva versão, endereços e regras enquanto normaliza identidade", () => {
    expect(validarClienteCadastro(cliente)).toMatchObject({ id: cliente.id, versao: 7, nome: "Nome antigo", telefone: "+5511999990000", enderecos: [{ nome: "Cobrança" }, { nome: "Outro" }], regrasPagamento: cliente.regrasPagamento });
  });
  it("aceita identidade e país legados sem apagar o nome completo", () => {
    expect(validarClienteCadastro({ ...cliente, nome: "Nome Fictício Legado", primeiroNome: undefined, sobrenome: undefined, enderecos: [{ ...endereco, pais: undefined }] })).toMatchObject({ primeiroNome: "Nome", sobrenome: "Fictício Legado", nome: "Nome Fictício Legado", enderecos: [{ pais: "Brasil" }] });
  });
  it("aceita complemento vazio em todas as abas de cobrança e na entrega padrão", () => {
    expect(validarClienteCadastro({ ...cliente, enderecos: cliente.enderecos.map(e => ({ ...e, complemento: "" })), entregaPadrao: { destinatario: { nome: "Pessoa fictícia", contato: "" }, endereco: { ...endereco, complemento: "" } } })).toMatchObject({ enderecos: [{ complemento: "" }, { complemento: "" }], entregaPadrao: { endereco: { complemento: "" } } });
  });
  it("recusa telefone incompleto e cadastro sem endereço", () => {
    expect(() => validarClienteCadastro({ ...cliente, telefone: "11999990000" })).toThrow(/DDI/);
    expect(() => validarClienteCadastro({ ...cliente, enderecos: [] })).toThrow(/cobrança/);
  });
  it("exige CNPJ e razão social para pessoa jurídica", () => {
    expect(() => validarClienteCadastro({ ...cliente, tipo: "PJ", enderecos: [{ ...endereco, tipo: "PJ", razaoSocial: "Empresa fictícia" }] })).toThrow(/CNPJ/);
  });
  it("identifica a empresa pelo nome fantasia, preservando contato e identidade legada", () => {
    const pj = { ...cliente, tipo: "PJ" as const, nome: "Fantasia fictícia", documento: "12345678000190", razaoSocial: "Razão fictícia", contato: "Contato Fictício" };
    expect(validarClienteCadastro(pj)).toMatchObject({ nome: "Fantasia fictícia", contato: "Contato Fictício", primeiroNome: "Ana", sobrenome: "Fictícia" });
    expect(validarClienteCadastro({ ...pj, primeiroNome: undefined, sobrenome: undefined })).toMatchObject({ nome: "Fantasia fictícia", primeiroNome: null, sobrenome: null });
    expect(() => validarClienteCadastro({ ...pj, nome: "" })).toThrow(/nome fantasia/);
  });
  it("recusa tipo ainda não escolhido e não persiste propriedades transitórias", () => {
    expect(() => validarClienteCadastro({ ...cliente, tipoEscolhido: false })).toThrow(/tipo de cliente/);
    const validado = validarClienteCadastro({ ...cliente, tipoEscolhido: true, nomeContato: "Contato", sobrenomeContato: "Fictício" });
    expect(validado).not.toHaveProperty("tipoEscolhido");
    expect(validado).toMatchObject({ nomeContato: "Contato", sobrenomeContato: "Fictício" });
  });
  it("valida também os campos obrigatórios dos endereços adicionais", () => {
    expect(() => validarClienteCadastro({ ...cliente, enderecos: [endereco, { ...endereco, numero: "" }] })).toThrow(/obrigatórios/);
  });
  it("recusa cobrança postal repetida mesmo com outro titular e nome", () => {
    expect(() => validarClienteCadastro({ ...cliente, enderecos: [endereco, { ...endereco, nome: "Outro titular", tipo: "PF", nomeCompleto: "Outra Pessoa" }] })).toThrow(/repetid|duplicad|já existe|mesmo endereço/);
  });
  it("recusa entrega parcial e repetida, mas permite o mesmo nome em outro endereço", () => {
    const entrega = { destinatario: { nome: "Pessoa fictícia", contato: "" }, endereco };
    expect(() => validarClienteCadastro({ ...cliente, entregaPadrao: { ...entrega, endereco: { ...endereco, numero: "" } } })).toThrow(/obrigatórios/);
    expect(() => validarClienteCadastro({ ...cliente, entregaPadrao: { ...entrega, enderecos: [entrega, { ...entrega, destinatario: { nome: "Outra Pessoa", contato: "" } }], selecionado: 0 } })).toThrow(/repetid|duplicad|já existe|mesmo endereço/);
    expect(validarClienteCadastro({ ...cliente, entregaPadrao: { ...entrega, enderecos: [entrega, { ...entrega, endereco: { ...endereco, numero: "2" } }], selecionado: 1 } }).entregaPadrao?.enderecos).toHaveLength(2);
  });
});
