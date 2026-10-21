import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ambientePedidosIsolado } from "@/lib/vendas/pedidos-liberacao";
import { matrizPoliticaPendente, validarMatrizPolitica } from "@/lib/vendas/pedidos-politica";

describe("Liberação de Pedidos", () => {
  it("não permite usar flag isolada em base operacional ou remota", () => {
    const antiga = process.env.DATABASE_URL, flag = process.env.PEDIDOS_AMBIENTE_ISOLADO;
    try {
      process.env.PEDIDOS_AMBIENTE_ISOLADO = "1";
      for (const u of ["postgresql://localhost/grazing_hub", "postgresql://servidor.invalid/teste_pedidos", "invalida"]) { process.env.DATABASE_URL = u; expect(ambientePedidosIsolado()).toBe(false); }
      process.env.DATABASE_URL = "postgresql://localhost/teste_pedidos_sintetico"; expect(ambientePedidosIsolado()).toBe(true);
      delete process.env.PEDIDOS_AMBIENTE_ISOLADO; expect(ambientePedidosIsolado()).toBe(false);
    } finally { if (antiga === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = antiga; if (flag === undefined) delete process.env.PEDIDOS_AMBIENTE_ISOLADO; else process.env.PEDIDOS_AMBIENTE_ISOLADO = flag; }
  });
  it("matriz pendente não aprova classificação nem permite omitir evento", () => {
    const matriz = matrizPoliticaPendente(); expect(validarMatrizPolitica(matriz)).toHaveLength(14);
    const proposta = matriz.map(l => ({ ...l, situacao: "APROVADO" as const }));
    expect(validarMatrizPolitica(proposta)).toHaveLength(14);
    expect(validarMatrizPolitica([])).toHaveLength(14);
    expect(matriz.every(l => l.categoriaId === null && l.competencia === null)).toBe(true);
  });
});
