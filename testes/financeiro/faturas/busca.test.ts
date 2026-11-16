import { describe, expect, it } from "vitest";
import { filtroBuscaFatura, filtroBuscaItemFatura } from "@/lib/financeiro/faturas/busca";

describe("Busca de faturas e itens antes da consulta e das contagens", () => {
  it.each(["308", "308,00", "R$ 308,00"])("inclui valor Decimal completo em %s", termo => {
    expect(filtroBuscaItemFatura(termo).OR).toContainEqual({ valor: { in: ["308.00", "-308.00"] } });
    expect(filtroBuscaFatura(termo).OR).toContainEqual({ totalInformado: { in: ["308.00", "-308.00"] } });
  });
  it("mantém as alternativas textuais e respeita sinal de estorno", () => {
    expect(filtroBuscaItemFatura("-12,34").OR).toContainEqual({ valor: { in: ["-12.34"] } });
    expect(filtroBuscaItemFatura("Loja").OR).toEqual([
      { descricaoOriginal: { contains: "Loja", mode: "insensitive" } },
      { estabelecimentoNormalizado: { contains: "Loja", mode: "insensitive" } },
    ]);
    expect(filtroBuscaFatura("Banco").OR).toHaveLength(1);
    expect(filtroBuscaItemFatura("308,001").OR).toHaveLength(2);
    expect(filtroBuscaFatura(" ")).toEqual({});
    expect(filtroBuscaItemFatura()).toEqual({});
  });
});
