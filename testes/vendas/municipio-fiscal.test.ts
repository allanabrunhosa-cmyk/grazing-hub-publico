import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarCepVenda } from "@/lib/vendas/cep";
import { validarCliente, validarEntregaPadraoCliente } from "@/lib/vendas/dominio";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import { codigoMunicipioCompativel } from "@/lib/vendas/municipio";
afterEach(() => vi.unstubAllGlobals());
const endereco = { nome: "Cobrança sintética", destinatario: "", pais: "Brasil", cep: "00000000", logradouro: "Rua sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" };
const cliente = { id: "sintetico", versao: 1, nome: "Pessoa sintética", tipo: "PF", documento: null, email: null, telefone: null, contato: null, observacoes: null, ativo: true, enderecos: [endereco] };

describe("metadado municipal fiscal opcional", () => {
  it("conserva o IBGE fornecido pelo CEP sem truncar código inválido", async () => {
    const buscar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ logradouro: "Rua sintética", bairro: "Centro", localidade: "São Paulo", uf: "SP", ibge: "3550308" }) });
    vi.stubGlobal("fetch", buscar);
    expect(await consultarCepVenda("00000000")).toMatchObject({ endereco: { codigoMunicipio: "3550308", uf: "SP" } });
    expect(buscar).toHaveBeenCalledOnce();
    buscar.mockResolvedValueOnce({ ok: true, json: async () => ({ uf: "SP", ibge: "3550308extra" }) });
    expect((await consultarCepVenda("00000000")).endereco).not.toHaveProperty("codigoMunicipio");
  });
  it("resposta postal sem IBGE ou incompatível mantém cadastro comercial utilizável", async () => {
    for (const ibge of [undefined, "3106200", "abc1234", "9999999"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ uf: "SP", logradouro: "Rua sintética", ibge }) }));
      const r = await consultarCepVenda("00000000");
      expect(r).toMatchObject({ endereco: { logradouro: "Rua sintética" } });
      expect(r.endereco).not.toHaveProperty("codigoMunicipio");
    }
  });
  it("cliente e entrega padrão preservam metadado válido e aceitam ausência legada", () => {
    expect(validarCliente(cliente).enderecos[0].codigoMunicipio).toBe("3550308");
    expect(validarCliente({ ...cliente, enderecos: [{ ...endereco, codigoMunicipio: undefined }] }).enderecos[0]).not.toHaveProperty("codigoMunicipio");
    expect(validarEntregaPadraoCliente({ destinatario: { nome: "Pessoa sintética", contato: "" }, endereco })?.endereco.codigoMunicipio).toBe("3550308");
  });
  it("pedido mantém IBGE da cobrança selecionada e da entrega sem reconsultar CEP", () => {
    const r = validarEntradaPedido({ itens: [], endereco, cobranca: { ...endereco, codigoMunicipio: "3106200", uf: "MG" }, enderecosCobranca: [endereco, { ...endereco, uf: "MG", codigoMunicipio: "3106200" }], cobrancaSelecionada: 1 });
    expect(r.endereco?.codigoMunicipio).toBe("3550308"); expect(r.cobranca?.codigoMunicipio).toBe("3106200");
    expect(r.enderecosCobranca?.map(e => e.codigoMunicipio)).toEqual(["3550308", "3106200"]);
    expect(validarEntradaPedido({ itens: [], endereco: { ...endereco, codigoMunicipio: undefined } }).endereco).not.toHaveProperty("codigoMunicipio");
  });
  it.each(["355030", "35503080", "35abc08", "3106200", 3550308])("servidor recusa código inválido/incompatível %s", codigoMunicipio => {
    expect(() => validarCliente({ ...cliente, enderecos: [{ ...endereco, codigoMunicipio }] })).toThrow(/Código IBGE/);
    expect(() => validarEntradaPedido({ itens: [], endereco: { ...endereco, codigoMunicipio } })).toThrow(/Código IBGE/);
    expect(() => validarEntregaPadraoCliente({ destinatario: { nome: "Pessoa sintética", contato: "" }, endereco: { ...endereco, codigoMunicipio } })).toThrow(/Código IBGE/);
  });
  it("IBGE brasileiro não é aplicado a endereço exterior", () => {
    expect(codigoMunicipioCompativel("3550308", "SP", "Portugal")).toBe(false);
    expect(() => validarEntradaPedido({ itens: [], endereco: { ...endereco, pais: "Portugal" } })).toThrow(/Código IBGE/);
    expect(validarEntradaPedido({ itens: [], endereco: { ...endereco, pais: "Portugal", codigoMunicipio: undefined } }).endereco).not.toHaveProperty("codigoMunicipio");
  });
});
