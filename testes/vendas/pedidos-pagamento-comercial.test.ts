import { describe, it, expect } from "vitest";
import { validarPagamentoComercial } from "@/lib/vendas/pedidos-pagamento-comercial";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import { validarClienteNovoPedido } from "@/lib/vendas/cliente-pedido";
import { paises } from "@/lib/paises";
const forma = { id: "forma-sintetica", nome: "Condição fictícia", tipo: "CARTAO_CREDITO", versao: 2, ativo: true, permiteParcelamento: true, maximoParcelas: 6 };
const boleto = { ...forma, tipo: "BOLETO", maximoParcelas: 3 };
const dadosCliente = { id: "", versao: 0, nome: "", primeiroNome: "Pessoa", sobrenome: "Fictícia", tipo: "PF" as const, documento: null, email: "pessoa@example.invalid", telefone: "+5511999990000", contato: null, observacoes: null, ativo: true, enderecos: [{ nome: "Cobrança", pais: "Brasil", destinatario: "", cep: "01001000", logradouro: "Rua Fictícia", numero: "10", complemento: "Casa", bairro: "Centro", cidade: "São Paulo", uf: "SP" }] };
describe("condição comercial de Pedido sem efeitos financeiros", () => {
  it("usa o cadastro e fotografa identidade, sem aceitar campos de snapshot forjados", () => {
    const d = validarEntradaPedido({ itens: [], pagamentoInformado: { formaId: forma.id, parcelas: 4, vencimentos: [], nome: "Forjado" } });
    expect(validarPagamentoComercial(d.pagamentoInformado!, forma, true)).toMatchObject({ nome: forma.nome, versao: 2, parcelas: 4 });
    expect(() => validarPagamentoComercial({ formaId: forma.id, parcelas: 5, vencimentos: [] }, forma)).toThrow("Parcelamento");
    expect(() => validarPagamentoComercial({ formaId: forma.id, parcelas: 2, vencimentos: [] }, { ...forma, tipo: "CARTAO_DEBITO" })).toThrow("Parcelamento");
    expect(() => validarPagamentoComercial({ formaId: forma.id, parcelas: 1, vencimentos: [] }, { ...forma, ativo: false })).toThrow("ativa");
  });
  it("boleto respeita o cadastro e exige cada vencimento na confirmação", () => {
    const p = { formaId: forma.id, parcelas: 2, vencimentos: ["2026-11-01", "2026-12-08"] };
    expect(validarPagamentoComercial(p, boleto, true).vencimentos).toEqual(p.vencimentos);
    expect(() => validarPagamentoComercial({ ...p, vencimentos: ["2026-11-01", ""] }, boleto, true)).toThrow("cada parcela");
    expect(validarPagamentoComercial({ ...p, vencimentos: ["2026-11-01", ""] }, boleto).parcelas).toBe(2);
    expect(() => validarPagamentoComercial({ ...p, parcelas: 4 }, boleto)).toThrow("Parcelamento");
    expect(() => validarEntradaPedido({ itens: [], pagamentoInformado: { ...p, vencimentos: ["2026-02-30"] } })).toThrow("Vencimento");
  });
  it("rejeita CPF com letras e e-mail inválido ou ausente, mantendo CPF opcional", () => {
    expect(() => validarClienteNovoPedido({ ...dadosCliente, documento: "abc12345678901" })).toThrow("CPF");
    for (const email of ["sem-arroba.invalid", "pessoa@", "pessoa@dominio", "a b@exemplo.invalid"]) expect(() => validarClienteNovoPedido({ ...dadosCliente, email })).toThrow("e-mail");
    expect(() => validarClienteNovoPedido({ ...dadosCliente, email: null })).toThrow("e-mail");
    expect(validarClienteNovoPedido(dadosCliente)).toMatchObject({ nome: "Pessoa Fictícia", documento: null, email: "pessoa@example.invalid" });
  });
  it("lista países e territórios por código único, com Brasil e endereços estrangeiros", () => {
    expect(paises).toHaveLength(249);
    expect(new Set(paises.map(p => p.codigo)).size).toBe(249);
    expect(paises.find(p => p.codigo === "BR")?.nome).toBe("Brasil");
    expect(paises.find(p => p.codigo === "PT")?.nome).toBe("Portugal");
  });
});
