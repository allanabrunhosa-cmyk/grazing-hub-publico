// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { apresentacaoCanalVenda } from "@/lib/vendas/canais-apresentacao";
import { TagCanalVenda } from "@/components/tag-canal-venda";
afterEach(cleanup);
describe("apresentação oficial dos canais", () => {
  it.each([["SITE", "Site", "site"], ["IFOOD", "iFood", "ifood"], ["GIULIANA FLORES", "GF", "gf"], [" GF ", "GF", "gf"], ["i-food", "iFood", "ifood"]])("normaliza %s sem alterar o selo oficial", (origem, nome, conhecido) => {
    expect(apresentacaoCanalVenda(origem)).toMatchObject({ nome, conhecido });
    render(<TagCanalVenda canal={origem} />);
    expect(screen.getByText(nome).closest('[data-canal]')?.getAttribute("data-canal")).toBe(conhecido);
  });
  it("preserva nomes desconhecidos e não classifica por semelhança", () => {
    expect(apresentacaoCanalVenda("Site parceiro")).toMatchObject({ nome: "Site parceiro", conhecido: undefined });
    expect(apresentacaoCanalVenda(null).nome).toBe("Sem canal");
  });
});
