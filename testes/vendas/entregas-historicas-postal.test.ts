import { describe, expect, it, vi } from "vitest";
import { consultarBairrosPorCep } from "@/lib/vendas/entregas-historicas-postal";

const data = new Date("2026-10-15T15:00:00Z");
const endereco = { logradouro: "Rua sintética que não deve sair no snapshot", bairro: "Bairro sintético", cidade: "Cidade sintética", uf: "SP" };
const dependencias = () => ({ consultarCep: vi.fn(async () => ({ endereco })), pausar: vi.fn<(ms: number) => Promise<void>>(async () => {}), agora: () => data });

describe("consulta postal do histórico de entregas", () => {
  it("normaliza a formatação e consulta cada CEP distinto uma única vez", async () => {
    const deps = dependencias();
    const snapshot = await consultarBairrosPorCep(["01310100", "01310-100", " 01310100 ", "04538132"], deps);
    expect(deps.consultarCep.mock.calls).toEqual([["01310100"], ["04538132"]]);
    expect(deps.pausar).toHaveBeenCalledExactlyOnceWith(300);
    expect(snapshot).toMatchObject({ versao: 1, origem: "VIACEP", consultadoEm: data.toISOString() });
    expect(Object.keys(snapshot.resultados)).toEqual(["01310100", "04538132"]);
  });

  it("valida o lote completo antes de qualquer consulta", async () => {
    for (const invalido of ["123", "013101000", "abc01310100", "01310.100", "", "0000e000"]) {
      const deps = dependencias();
      await expect(consultarBairrosPorCep(["01310100", invalido], deps)).rejects.toThrow("oito dígitos");
      expect(deps.consultarCep).not.toHaveBeenCalled();
      expect(deps.pausar).not.toHaveBeenCalled();
    }
  });

  it("mantém concorrência um e pausa de 300ms entre consultas", async () => {
    const eventos: string[] = []; let ativas = 0, maximo = 0;
    await consultarBairrosPorCep(["01310100", "04538132", "05001000"], {
      consultarCep: async cep => { ativas++; maximo = Math.max(maximo, ativas); eventos.push(`consulta:${cep}`); await Promise.resolve(); ativas--; return { endereco }; },
      pausar: async ms => { eventos.push(`pausa:${ms}`); }, agora: () => data,
    });
    expect(maximo).toBe(1);
    expect(eventos).toEqual(["consulta:01310100", "pausa:300", "consulta:04538132", "pausa:300", "consulta:05001000"]);
  });

  it("retorna somente os campos postais autorizados", async () => {
    const snapshot = await consultarBairrosPorCep(["01310100"], dependencias());
    expect(snapshot.resultados["01310100"]).toEqual({ cep: "01310100", bairro: "Bairro sintético", cidade: "Cidade sintética", uf: "SP", consultadoEm: data.toISOString() });
    expect(JSON.stringify(snapshot)).not.toContain("Rua sintética");
    expect(snapshot.resultados["01310100"]).not.toHaveProperty("logradouro");
  });

  it("registra falhas e continua consultando os demais CEPs", async () => {
    const pausar = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const snapshot = await consultarBairrosPorCep(["01310100", "04538132", "05001000"], {
      consultarCep: async cep => { if (cep === "01310100") return { erro: "CEP não encontrado." }; if (cep === "04538132") throw new Error("Falha simulada"); return { endereco }; },
      pausar, agora: () => data,
    });
    expect(snapshot.resultados["01310100"]).toEqual({ erro: "CEP não encontrado." });
    expect(snapshot.resultados["04538132"]).toEqual({ erro: "Consulta postal indisponível. Tente novamente." });
    expect(snapshot.resultados["05001000"]).toMatchObject({ bairro: "Bairro sintético" });
    expect(pausar).toHaveBeenCalledTimes(2);
  });

  it("preserva bairro vazio em CEP genérico e rejeita município inválido", async () => {
    const snapshot = await consultarBairrosPorCep(["01310100", "04538132"], {
      consultarCep: async cep => ({ endereco: { ...endereco, bairro: "", ...(cep === "04538132" ? { cidade: "", uf: "" } : {}) } }),
      pausar: async () => {}, agora: () => data,
    });
    expect(snapshot.resultados["01310100"]).toMatchObject({ bairro: "", cidade: "Cidade sintética" });
    expect(snapshot.resultados["04538132"]).toEqual({ erro: "Consulta postal sem cidade ou UF válidas." });
  });

  it("retorna lote vazio sem rede nem espera", async () => {
    const deps = dependencias();
    expect(await consultarBairrosPorCep([], deps)).toEqual({ versao: 1, origem: "VIACEP", consultadoEm: data.toISOString(), resultados: {} });
    expect(deps.consultarCep).not.toHaveBeenCalled(); expect(deps.pausar).not.toHaveBeenCalled();
  });
});
