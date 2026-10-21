import { describe, expect, it } from "vitest";
import { validarCliente, validarGrupo, validarProduto, validarFiscal, limitesEfetivos, simularConfiguracao, decimal, type ProdutoEntrada } from "@/lib/vendas/dominio";
const cliente = { id: "", versao: 0, nome: "Cliente", tipo: "PF", documento: "", email: "", telefone: "", contato: "", observacoes: "", enderecos: [], ativo: true };
const grupo = { id: "", versao: 0, nome: "Extras", tipo: "EXTRAS", minimo: 9, maximo: 3, repetir: false, ativo: true, opcoes: [{ id: "opcao", nome: "Brie 100g", preco: "29.50", quantidade: "1", produtoId: null, ativo: true }] };
export const produtoTeste: ProdutoEntrada = { id: "", versao: 0, nome: "Tábua padrão", especificacao: null, descricao: null, tipo: "PADRAO", codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, ativo: true, categorias: [], grupos: [], preco: "149.00", componentes: [] };
describe("cadastro comercial de Vendas", () => {
  it("slots de entrega aceitam zero ou pendência e recusam frações, letras e excesso", () => {
    expect(validarProduto({ ...produtoTeste, slotsEntrega: null }).slotsEntrega).toBeNull();
    expect(validarProduto({ ...produtoTeste, slotsEntrega: 0 }).slotsEntrega).toBe(0);
    expect(validarProduto({ ...produtoTeste, slotsEntrega: 999999 }).slotsEntrega).toBe(999999);
    for (const slotsEntrega of [-1, 0.5, "2a", 1000000]) expect(() => validarProduto({ ...produtoTeste, slotsEntrega })).toThrow();
  });
  it("mantém Extras opcional, ilimitado e repetível mesmo com legado divergente", () => {
    expect(validarGrupo(grupo)).toMatchObject({ minimo: 0, maximo: null, repetir: true });
    expect(limitesEfetivos(grupo, { grupoId: "g", usarPadrao: false, minimo: 2, maximo: 3 })).toEqual({ minimo: 0, maximo: null });
  });
  it("aceita Extras acima de 99 e calcula o preço sem arredondar cada soma", () => {
    const g = validarGrupo(grupo);
    const s = simularConfiguracao("0", [{ ...g, id: "g", vinculo: { grupoId: "g", usarPadrao: false, minimo: 10, maximo: 3 } }], { opcao: 1000 });
    expect(s).toEqual({ valido: true, totalCentavos: 2950000, erros: [] });
  });
  it("exige quantidade obrigatória e soma escolhas ao preço-base", () => {
    const g = { ...validarGrupo({ ...grupo, tipo: "COMPLEMENTAR", minimo: 1, maximo: 1, repetir: false }), id: "quantidade", vinculo: { grupoId: "quantidade", usarPadrao: true, minimo: 0, maximo: null } };
    expect(simularConfiguracao("0", [g], {}).valido).toBe(false);
    expect(simularConfiguracao("0", [g], { opcao: 1 }).totalCentavos).toBe(2950);
    expect(simularConfiguracao("0", [g], { opcao: 2 }).valido).toBe(false);
  });
  it("recusa opções externas, inativas, frações, negativos e excesso de precisão", () => {
    const g = { ...validarGrupo(grupo), vinculo: { grupoId: "g", usarPadrao: true, minimo: 0, maximo: null } };
    for (const escolhas of [{ outro: 1 }, { opcao: -1 }, { opcao: 0.5 }, { opcao: NaN }, { opcao: Number.MAX_SAFE_INTEGER }] as Record<string, number>[]) expect(simularConfiguracao("0", [g], escolhas).valido).toBe(false);
    expect(simularConfiguracao("0", [{ ...g, opcoes: g.opcoes.map(o => ({ ...o, ativo: false })) }], { opcao: 1 }).valido).toBe(false);
  });
  it("preserva as identidades e exige um preço único preciso", () => {
    expect(validarProduto(produtoTeste)).toMatchObject({ tipo: "PADRAO", preco: "149.00" });
    expect(validarProduto({ ...produtoTeste, tipo: "PERSONALIZADO", preco: "139" })).toMatchObject({ tipo: "PERSONALIZADO", preco: "139" });
    expect(() => validarProduto({ ...produtoTeste, precos: [] })).toThrow("Reabra");
    expect(() => validarProduto({ ...produtoTeste, precoComplemento: "1" })).toThrow("Reabra");
    for (const preco of ["1.001", "-1", "texto", "1e3", ""]) expect(() => validarProduto({ ...produtoTeste, preco })).toThrow();
  });
  it("permite clientes sem documento, mas verifica tipo e endereços", () => {
    expect(validarCliente(cliente).documento).toBeNull();
    expect(() => validarCliente({ ...cliente, tipo: "PJ", documento: "12345678901" })).toThrow("14 dígitos");
    expect(() => validarCliente({ ...cliente, email: "invalido" })).toThrow("e-mail");
    expect(() => validarCliente({ ...cliente, enderecos: [{ nome: "Casa", logradouro: "Rua A", numero: "10", cidade: "São Paulo", uf: "XX" }] })).toThrow("UF");
  });
  it("dados fiscais incompletos ficam como rascunho, sem preenchimento presumido", () => {
    expect(validarFiscal({}, false).ncm).toBe("");
    expect(() => validarFiscal({}, true)).toThrow("Preencha");
    expect(() => validarFiscal({ ncm: "123" }, false)).toThrow("NCM");
    expect(validarFiscal({ ncm: "04069020", origem: "0", cfop: "5101", csosn: "102", pis: "01", cofins: "01" }, true).origem).toBe("0");
  });
  it("quantidades conservam decimais e não aceita preço malformado", () => {
    expect(decimal("0.000000001", "Quantidade")).toBe("0.000000001");
    for (const valor of ["1.001", "1e3", "Infinity", "-1", "", "texto"]) expect(() => decimal(valor, "Preço", true)).toThrow();
    expect(() => validarGrupo({ ...grupo, tipo: "COMPOSICAO", minimo: 3, maximo: 2 })).toThrow("máximo");
  });
});
