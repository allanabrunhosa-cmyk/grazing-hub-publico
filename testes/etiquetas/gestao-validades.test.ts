import { describe, expect, it } from "vitest";
import { condicaoValidade, filtroValidade, situacaoValidade } from "@/lib/etiquetas/gestao-validades";
import { validarPlanejamentoRaspberry, lerPlanejamentoRaspberry } from "@/lib/etiquetas/raspberry";
import { secaoEtiquetas } from "@/lib/etiquetas/navegacao";

describe("validades sem alterar snapshots ou estoque", () => {
  const agora = "2026-09-16T12:00:00Z";
  it("separa limites exatos sem lacunas ou sobreposição", () => {
    expect(situacaoValidade("2026-09-16T11:59:59Z", agora)).toBe("Vencida");
    expect(situacaoValidade(agora, agora)).toBe("Vence em até 48h");
    expect(situacaoValidade("2026-09-18T12:00:00Z", agora)).toBe("Vence em até 48h");
    expect(situacaoValidade("2026-09-18T12:00:01Z", agora)).toBe("Dentro do prazo");
    expect(condicaoValidade("proximas", new Date(agora))).toEqual({ gte: new Date(agora), lte: new Date("2026-09-18T12:00:00Z") });
    expect(condicaoValidade("todas", new Date(agora))).toBeUndefined();
  });
  it("normaliza parâmetros desconhecidos sem aceitar rotas arbitrárias", () => {
    expect(filtroValidade("invalido")).toBe("todas");
    expect(secaoEtiquetas("https://externo.invalid")).toBe("etiquetas");
    expect(secaoEtiquetas("configuracoes")).toBe("configuracoes");
  });
});

describe("preparação Raspberry Pi, sem credenciais e sem transporte", () => {
  it("aceita somente metadados explícitos e remove propriedades extras", () => {
    expect(validarPlanejamentoRaspberry({ estacao: " Cozinha ", fila: "zebra_cozinha", conexao: "USB", token: "nao-persistir" })).toEqual({ estacao: "Cozinha", fila: "zebra_cozinha", conexao: "USB" });
    expect(validarPlanejamentoRaspberry(null)).toBeNull();
    expect(lerPlanejamentoRaspberry(undefined)).toBeNull();
  });
  it.each([
    { estacao: "", fila: "zebra", conexao: "USB" },
    { estacao: "Cozinha", fila: "fila; comando", conexao: "USB" },
    { estacao: "https://rede.invalid", fila: "zebra", conexao: "USB" },
    { estacao: "Cozinha", fila: "zebra", conexao: "INTERNET" },
  ])("recusa configuração inválida: %j", (entrada) => expect(() => validarPlanejamentoRaspberry(entrada)).toThrow());
});
