import { describe, expect, it } from "vitest";
import { projetarOpcoesPostaisUnicas } from "@/lib/vendas/cliente-enderecos-opcoes";

const postal = { pais: "Brasil", cep: "01001000", logradouro: "Avenida Sintética", numero: "1000", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
describe("projeção de opções postais fotografadas", () => {
  it("agrupa pela chave estrita com mapa para todos os índices sem alterar fontes", () => {
    const primeira = { ...postal, tipo: "PF", nomeCompleto: "Pessoa principal", documento: "11111111266" };
    const selecionada = { ...postal, tipo: "PJ", razaoSocial: "Empresa adicional", documento: "11222333000181", logradouro: "AV. SINTETICA", cep: "01001-000" };
    const fontes = [primeira, { ...postal, numero: "2000" }, selecionada];
    const antes = structuredClone(fontes);
    const resultado = projetarOpcoesPostaisUnicas(fontes, 2);
    expect(resultado.indiceOpcaoPorOriginal).toEqual([0, 1, 0]);
    expect(resultado.opcoes.map(o => [o.indiceOriginal, o.indicesOriginais])).toEqual([[2, [0, 2]], [1, [1]]]);
    expect(resultado.opcoes[0].endereco).toBe(selecionada);
    expect(fontes).toEqual(antes);
  });
  it("conserva a primeira ocorrência quando o grupo não está selecionado", () => {
    const fontes = [postal, { ...postal }, { ...postal, numero: "2000" }];
    expect(projetarOpcoesPostaisUnicas(fontes, 2).opcoes[0]).toMatchObject({ indiceOriginal: 0, indicesOriginais: [0, 1] });
    expect(projetarOpcoesPostaisUnicas(fontes, -1).opcoes[0].indiceOriginal).toBe(0);
  });
  it("não agrupa campos incompletos nem interpreta texto original como endereço comprovado", () => {
    const parcial = { ...postal, numero: "", textoOriginal: "Endereço parcial da origem" };
    expect(projetarOpcoesPostaisUnicas([parcial, { ...parcial }, postal], 1).indiceOpcaoPorOriginal).toEqual([0, 1, 2]);
  });
  it("mantém salas, números, CEPs e países distintos e não altera valores congelados", () => {
    const fontes = Object.freeze([Object.freeze(postal), Object.freeze({ ...postal, complemento: "Sala 3" }), Object.freeze({ ...postal, numero: "1000-1" }), Object.freeze({ ...postal, cep: "01002000" }), Object.freeze({ ...postal, pais: "Portugal" })]);
    expect(projetarOpcoesPostaisUnicas(fontes, 0).indiceOpcaoPorOriginal).toEqual([0, 1, 2, 3, 4]);
    expect(projetarOpcoesPostaisUnicas([], 0)).toEqual({ opcoes: [], indiceOpcaoPorOriginal: [] });
  });
});
