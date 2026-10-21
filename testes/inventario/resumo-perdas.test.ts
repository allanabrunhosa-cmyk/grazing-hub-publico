import { describe, expect, it } from "vitest";
import { filtrarPeriodoPerdas, resumirPerdas } from "@/lib/estoque/resumo-perdas";
import type { PerdaRow } from "@/app/(protegido)/inventario/types";

const perda: PerdaRow = { id: "1", data: "2026-09-11T15:00:00Z", insumoNome: "Queijo", localNome: "Estoque", motivo: "QUEBRA", motivoPersonalizado: null, quantidade: 1, unidade: "KG", valorEstimado: 0.1, observacao: null, responsavelNome: "Ana" };

describe("resumo de perdas", () => {
  it("soma centavos e calcula motivos e maiores registros sem somar unidades diferentes", () => {
    const resumo = resumirPerdas([perda, { ...perda, id: "2", valorEstimado: 0.2, unidade: "UN" }, { ...perda, id: "3", motivo: "OUTRO", valorEstimado: 0.7 }]);
    expect(resumo.total).toBe(1);
    expect(resumo.motivos).toEqual([
      { motivo: "OUTRO", nome: "Outro", valor: 0.7, registros: 1, percentual: 70 },
      { motivo: "QUEBRA", nome: "Quebra", valor: 0.3, registros: 2, percentual: 30 },
    ]);
    expect(resumo.maiores.map(item => item.id)).toEqual(["3", "2", "1"]);
  });
  it("trata período vazio e valores zerados sem percentuais fictícios", () => {
    expect(resumirPerdas([])).toMatchObject({ total: 0, registros: 0, motivos: [], maiores: [] });
    expect(resumirPerdas([{ ...perda, valorEstimado: 0 }])).toMatchObject({ total: 0, semValor: 1, maiores: [], motivos: [{ percentual: 0 }] });
  });
  it("separa categorias cadastradas com o mesmo motivo legado sem misturar os valores", () => {
    const resumo = resumirPerdas([
      { ...perda, categoriaPerdaId: "categoria-a", categoriaNome: "Embalagem avariada", motivo: "OUTRO", valorEstimado: 10 },
      { ...perda, id: "2", categoriaPerdaId: "categoria-b", categoriaNome: "Transporte", motivo: "OUTRO", valorEstimado: 20 },
    ]);
    expect(resumo.motivos.map(item => [item.nome, item.valor])).toEqual([["Transporte", 20], ["Embalagem avariada", 10]]);
  });
  it("inclui o dia final inteiro no fuso de Brasília e aceita limites abertos", () => {
    const linhas = [{ ...perda, id: "antes", data: "2026-09-11T02:59:59Z" }, { ...perda, id: "inicio", data: "2026-09-11T03:00:00Z" }, { ...perda, id: "fim", data: "2026-09-12T02:59:59Z" }, { ...perda, id: "depois", data: "2026-09-12T03:00:00Z" }];
    const filtrar = (de: string, ate: string) => filtrarPeriodoPerdas(linhas, de, ate, linha => linha.data).map(linha => linha.id);
    expect(filtrar("2026-09-11", "2026-09-11")).toEqual(["inicio", "fim"]);
    expect(filtrar("", "2026-09-10")).toEqual(["antes"]);
    expect(filtrar("2026-09-12", "")).toEqual(["depois"]);
    expect(filtrar("", "")).toHaveLength(4);
    expect(filtrar("2026-09-12", "2026-09-11")).toEqual([]);
    expect(filtrar("2026-02-30", "")).toEqual([]);
  });
});
