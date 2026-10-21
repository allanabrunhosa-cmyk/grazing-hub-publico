import { describe, expect, it } from "vitest";
import { geografiaPedidoBi } from "@/lib/vendas/bi-geografia";
import { entregaProjetadaSintetica } from "./entregas-historicas.fixture";

const destino = { historico: false, atendimento: "ENTREGA", cep: "12345-678", bairro: " Bairro sintético ", cidade: "Cidade sintética", uf: "sp" };
describe("BI: proveniência geográfica", () => {
  it("projeta somente os campos postais do destino, sem inventar coordenadas ou confirmação", () => {
    expect(geografiaPedidoBi(destino)).toEqual({ modalidade: "ENTREGA", cep: "12345678", bairro: "Bairro sintético", cidade: "Cidade sintética", uf: "SP", regiao: "Bairro sintético · Cidade sintética / SP", enderecoEstado: "nao-validado", coordenadas: null });
  });
  it.each([null, "RETIRADA", "LOCAL"])("exclui endereço quando a modalidade é %s", atendimento => {
    expect(geografiaPedidoBi({ ...destino, atendimento })).toMatchObject({ cep: null, bairro: null, cidade: null, regiao: null, coordenadas: null, enderecoEstado: "ausente" });
  });
  it("não promove cobrança histórica nem um atendimento eventualmente preenchido sem prova", () => {
    expect(geografiaPedidoBi({ ...destino, historico: true })).toMatchObject({ modalidade: null, cep: null, bairro: null, cidade: null, uf: null, coordenadas: null, regiao: null });
  });
  it("aceita somente Shipping vinculado ao pedido e conserva a localização sem coordenadas", () => {
    const entregaHistorica = entregaProjetadaSintetica();
    expect(geografiaPedidoBi({ ...destino, historico: true, numeroOriginal: "55", entregaHistorica })).toMatchObject({ modalidade: "ENTREGA", cep: "12345678", bairro: null, cidade: "São Paulo", uf: "SP", enderecoEstado: "nao-validado", coordenadas: null });
    expect(geografiaPedidoBi({ ...destino, historico: true, numeroOriginal: "outro", entregaHistorica })).toMatchObject({ modalidade: null, cep: null, bairro: null });
  });
  it("retirada sem Shipping usa a instrução explícita e não herda endereço de cobrança", () => {
    expect(geografiaPedidoBi({ ...destino, historico: true, numeroOriginal: "55", entregaHistorica: entregaProjetadaSintetica(null) })).toMatchObject({ modalidade: "RETIRADA", cep: null, bairro: null, cidade: null, uf: null, enderecoEstado: "ausente", coordenadas: null });
  });
  it("conserva campos desconhecidos como nulos e rejeita tamanho/caracteres inválidos", () => {
    expect(geografiaPedidoBi({ ...destino, cep: "123", bairro: "x".repeat(121), cidade: "\nRua indevida", uf: "São Paulo" })).toMatchObject({ cep: null, bairro: null, cidade: null, uf: null, regiao: null, enderecoEstado: "ausente" });
  });
});
