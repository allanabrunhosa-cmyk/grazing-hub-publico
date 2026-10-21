import { describe, expect, it } from "vitest";
import { validarInformacoesPedido } from "@/lib/vendas/pedidos-edicao";

const endereco = { pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "Cidade fictícia", uf: "sp" };
describe("Edição de informações sem efeitos comerciais", () => {
  it("normaliza apenas os campos explícitos e não aceita instruções de produção", () => {
    expect(validarInformacoesPedido({ cobranca: endereco, motivo: " Atualizar cobrança " })).toEqual({ cobranca: { ...endereco, uf: "SP" }, motivo: "Atualizar cobrança" });
    for (const campo of ["itens", "observacoes", "frete", "desconto", "outrosCustos", "endereco", "atendimento", "pagamentoInformado", "clienteAtualizacao"]) expect(() => validarInformacoesPedido({ [campo]: [], motivo: "Fictício" })).toThrow("cancele o pedido e crie um novo");
  });
  it("exige data e horário juntos, data real e justificativa limitada", () => {
    expect(validarInformacoesPedido({ previsaoData: "2026-10-12", previsaoJanela: "Manhã", motivo: "Solicitação fictícia" })).toMatchObject({ previsaoData: "2026-10-12", previsaoJanela: "Manhã" });
    expect(() => validarInformacoesPedido({ previsaoData: "2026-10-12", motivo: "Fictício" })).toThrow("juntos");
    expect(() => validarInformacoesPedido({ previsaoData: "2026-02-30", previsaoJanela: "Manhã", motivo: "Fictício" })).toThrow("Data prevista inválida");
    expect(() => validarInformacoesPedido({ cobranca: endereco, motivo: " ".repeat(2) })).toThrow("motivo");
    expect(() => validarInformacoesPedido({ cobranca: endereco, motivo: "a".repeat(1001) })).toThrow("1000");
    expect(() => validarInformacoesPedido({ cobranca: { ...endereco, numero: "a".repeat(31) }, motivo: "Fictício" })).toThrow("30 caracteres");
    expect(() => validarInformacoesPedido({ cobranca: { ...endereco, cep: "" }, motivo: "Fictício" })).toThrow("endereço de cobrança");
  });
  it("valida telefone antes de gravar destinatário e conserva campos ausentes", () => {
    expect(() => validarInformacoesPedido({ destinatario: { nome: "Pessoa fictícia", contato: "+5511" }, motivo: "Fictício" })).toThrow("telefone");
    const salvo = validarInformacoesPedido({ destinatario: { nome: "Pessoa fictícia", contato: "+5511976586412" }, motivo: "Fictício" });
    expect(salvo.destinatario?.contato).toBe("+5511976586412");
    expect(salvo).not.toHaveProperty("previsaoData");
    expect(salvo).not.toHaveProperty("cobranca");
  });
});
