import { describe, expect, it } from "vitest";
import { entregasVazias, validarConfiguracaoEntregas, precificarEntrega, pendenciasEntregas } from "@/lib/vendas/entregas-dominio";
import { selecionarVeiculoEntrega, slotsDosItens, slotsPorUnidade, slotsDoRascunho } from "@/lib/vendas/entregas-veiculos";
const endereco = { cep: "01234567", logradouro: "Rua sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const config = () => ({ ...entregasVazias(), modelo: "SLOTS" as const, origem: endereco, origemTipo: "PERSONALIZADA" as const,
  veiculos: [{ id: "m", nome: "Moto", perfil: "MOTO" as const, ativo: true, slotsMinimos: 0, slotsMaximos: 3 }, { id: "c", nome: "Carro", perfil: "CARRO" as const, ativo: true, slotsMinimos: 4, slotsMaximos: 20 }],
  faixas: [{ id: "a", limiteMetros: 7000, preco: "0", precos: { m: "22.00", c: "24.00" } }, { id: "b", limiteMetros: 8000, preco: "0", precos: { m: "24.00", c: "27.00" } }] });
describe("Frete por veículo e slots", () => {
  it("deriva a cobertura e desativa regras retiradas sem usar o preço legado", () => {
    const c = validarConfiguracaoEntregas({ ...config(), maximoMetros: 1, gratisAPartir: "1", pedidoMinimo: "999", veiculo: "CARRO" });
    expect(c).toMatchObject({ maximoMetros: 8000, veiculo: null, gratisAPartir: null, pedidoMinimo: null, excecoes: [], regrasVeiculo: [], veiculoPadraoId: null });
    expect(precificarEntrega(c, endereco, "0", 7000, "m").frete).toBe("22.00");
    expect(precificarEntrega(c, endereco, "5000", 7000, "c").frete).toBe("24.00");
    expect(precificarEntrega(c, endereco, "0", 7001, "c").frete).toBe("27.00");
    expect(precificarEntrega(c, endereco, "0", 8001, "c").estado).toBe("FORA_AREA");
    expect(precificarEntrega(c, endereco, "0", 1, "inexistente").frete).toBeNull();
  });
  it.each([[0, "m"], [3, "m"], [4, "c"], [20, "c"]])("escolhe exatamente pela ocupação %i", (slots, id) => {
    expect(selecionarVeiculoEntrega(config(), [], null, Number(slots))).toMatchObject({ id, escolha: "SLOTS", slotsOcupados: slots });
  });
  it("não inventa capacidade, ocupação ou veículo fora das faixas; simulador escolhe explicitamente", () => {
    expect(selecionarVeiculoEntrega(config(), [], null, null).perfil).toBeNull();
    expect(selecionarVeiculoEntrega(config(), [], null, 21).perfil).toBeNull();
    expect(selecionarVeiculoEntrega(config(), [], "c").perfil).toBe("CARRO");
    expect(selecionarVeiculoEntrega(config(), [], "m", 4)).toMatchObject({ id: "m", perfil: "MOTO", escolha: "OPERADOR", slotsOcupados: 4 });
    expect(() => validarConfiguracaoEntregas({ ...config(), veiculos: config().veiculos.map(v => ({ ...v, slotsMinimos: 1 })) })).toThrow("sobrepor");
  });
  it("escolha ativa independe da ocupação/capacidade sem alterar o catálogo", () => {
    const c = config(), antes = structuredClone(c); c.veiculos[1].slotsMinimos = null as unknown as number; c.veiculos[1].slotsMaximos = null as unknown as number;
    for (const slots of [null, 0, 21]) expect(selecionarVeiculoEntrega(c, [], "c", slots)).toMatchObject({ id: "c", perfil: "CARRO", escolha: "OPERADOR", slotsOcupados: slots });
    expect(c.veiculos[0]).toEqual(antes.veiculos[0]); expect(() => selecionarVeiculoEntrega(c, [], "inexistente", null)).toThrow("indisponível"); expect(() => selecionarVeiculoEntrega({ ...c, veiculos: c.veiculos.map(v => ({ ...v, ativo: false })) }, [], "c", null)).toThrow("indisponível"); expect(() => selecionarVeiculoEntrega(c, [], "c", -1)).toThrow("inválida");
  });
  it("dispensa somente capacidade na consulta com escolha ativa, mantendo validação global", () => {
    const c = config(); c.veiculos[0].slotsMinimos = null as unknown as number;
    expect(pendenciasEntregas(c, "")).toContain("Definir capacidades de slots dos veículos"); expect(pendenciasEntregas(c, "", "m")).toEqual([]); expect(pendenciasEntregas(c, "", "inexistente")).toContain("Definir capacidades de slots dos veículos");
    expect(pendenciasEntregas({ ...c, faixas: [], origem: { ...endereco, numero: "" } }, "", "m")).toEqual(["Cadastrar faixas de frete", "Completar endereço da origem"]);
    expect(pendenciasEntregas({ ...c, faixas: [{ ...c.faixas[0], precos: {} }] }, "", "m")).toContain("Preencher frete de cada veículo");
  });
  it("soma produtos, escolhas vinculadas e quantidades fracionárias sem subdimensionar", () => {
    expect(slotsPorUnidade(2, "1", [{ slots: 1, quantidade: 2, multiplicador: "0.5" }])).toBe("3.000000");
    expect(slotsDosItens([{ quantidade: "0.5", produtoSnapshot: { slotsEntrega: "3.000000" } }, { quantidade: "1.25", produtoSnapshot: { slotsEntrega: "2.000000" } }])).toBe(4);
    expect(slotsDosItens([{ quantidade: "0.1", produtoSnapshot: { slotsEntrega: 1 } }])).toBe(1);
    expect(slotsDosItens([{ quantidade: "1", produtoSnapshot: {} }])).toBeNull();
    expect(slotsPorUnidade(1, "1", [{ slots: null, quantidade: 1, multiplicador: "1" }])).toBeNull();
  });
  it("a prévia usa os mesmos produtos/escolhas e não quebra durante a digitação", () => {
    const produtos = [{ id: "p", slotsEntrega: 2 }, { id: "o", slotsEntrega: 1 }];
    const grupos = [{ opcoes: [{ id: "op", produtoId: "o", quantidade: "1" }] }];
    expect(slotsDoRascunho([{ produtoId: "p", quantidade: "2", escolhas: { op: 1 } }], produtos, grupos)).toBe(6);
    expect(slotsDoRascunho([{ produtoId: "p", quantidade: "", escolhas: {} }], produtos, grupos)).toBeNull();
  });
  it("valida precisão, limites e referências de preços no servidor", () => {
    expect(() => validarConfiguracaoEntregas({ ...config(), veiculos: [{ ...config().veiculos[0], slotsMinimos: 0.5 }] })).toThrow("inteiro");
    expect(() => validarConfiguracaoEntregas({ ...config(), faixas: [{ ...config().faixas[0], precos: { outro: "1" } }] })).toThrow("inexistente");
    expect(() => validarConfiguracaoEntregas({ ...config(), faixas: [{ ...config().faixas[0], precos: { m: "1.001" } }] })).toThrow();
  });
});
