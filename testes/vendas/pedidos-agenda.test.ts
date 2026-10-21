import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import { describe, it, expect } from "vitest";
import { intervaloDatasPedidos, inicioDiaNoFuso, diaNoFuso, entregaAtrasada, periodoCalendario } from "@/lib/vendas/pedidos-agenda-dominio";
import { resumirRevisaoProducao } from "@/lib/vendas/pedidos-revisao-resumo";
import { htmlResumoPedido } from "@/app/(protegido)/vendas/pedidos/[id]/operacao/impressao";
import type { ResumoOperacional } from "@/app/(protegido)/vendas/pedidos/[id]/operacao/operacao-client";
describe("Agenda e comanda", () => {
  it("filtro comercial usa dia da empresa, entrega preserva data civil e horário de verão", () => {
    expect(inicioDiaNoFuso("2026-09-26", "America/Sao_Paulo").toISOString()).toBe("2026-09-26T03:00:00.000Z");
    const comercial = intervaloDatasPedidos("2026-09-26", "2026-09-26", "confirmacao", "America/Sao_Paulo");
    expect(new Date("2026-09-27T01:00:00Z") < comercial.lt!).toBe(true);
    expect(comercial.lt!.toISOString()).toBe("2026-09-27T03:00:00.000Z");
    expect(intervaloDatasPedidos("2026-09-26", "2026-09-26", "entrega", "America/Sao_Paulo").gte!.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    const dst = intervaloDatasPedidos("2026-03-08", "2026-03-08", "confirmacao", "America/New_York");
    expect(dst.lt!.getTime() - dst.gte!.getTime()).toBe(23 * 3600000);
    expect(intervaloDatasPedidos("2026-02-30", "inválida", "confirmacao", "America/Sao_Paulo")).toEqual({});
  });
  it("troca para imediato remove previsão herdada do calendário no servidor", () => {
    const entrada = { prazo: "AGENDADO", previsaoData: "2026-10-10", previsaoJanela: "14:00–16:00", itens: [] };
    expect(validarEntradaPedido(entrada)).toMatchObject({ previsaoData: "2026-10-10", previsaoJanela: "14:00–16:00" });
    expect(validarEntradaPedido({ ...entrada, prazo: "IMEDIATO" })).toMatchObject({ previsaoData: null, previsaoJanela: null });
  });
  it("separa dia da loja de UTC e não inventa hora para janela textual", () => {
    const agora = new Date("2026-09-27T02:00:00Z");
    expect(diaNoFuso(agora, "America/Sao_Paulo")).toBe("2026-09-26");
    expect(entregaAtrasada("2026-09-26", "manhã", "America/Sao_Paulo", agora)).toBe(false);
    expect(entregaAtrasada("2026-09-26", "14:00–16:00", "America/Sao_Paulo", agora)).toBe(true);
    expect(entregaAtrasada("2026-09-27", "14:00", "America/Sao_Paulo", agora)).toBe(false);
    expect(periodoCalendario("2028-02-10", "mes").dias).toHaveLength(29);
    expect(periodoCalendario("2026-09-26", "semana")).toMatchObject({ inicio: "2026-09-21", fim: "2026-09-27" });
  });
  it("comanda longa A4/80mm preserva revisão e escapa texto, sem dados pessoais/financeiros", () => {
    const p: ResumoOperacional = { id: "p", numero: 15, versao: 4, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", previsaoData: "2026-10-10", previsaoJanela: "14:00–16:00", observacoes: '<script>inseguro</script>', destinatarioSnapshot: { cpf: "documento-privado" }, enderecoSnapshot: { logradouro: "endereco-privado" }, historico: [], referenciaPedido: "takeat-ficticio", fusoHorario: "America/Manaus", revisoesProducao: [{ versao: 4, descricao: "Adicionado um kit; anteriores preservados." }], itens: Array.from({ length: 100 }, (_, n) => ({ id: String(n), quantidade: "2", unidadeSnapshot: "UN", produtoSnapshot: { nome: `Kit ${n}` }, escolhasSnapshot: [{ opcaoNome: "Extra", quantidade: 1 }] })) };
    for (const formato of ["A4", "80mm"] as const) {
      const html = htmlResumoPedido(p, formato, new Date("2026-09-26T15:00:00Z"));
      expect(html).toContain("Kit 99"); expect(html).toContain("versão 4"); expect(html).toContain("takeat-ficticio"); expect(html).toContain("11:00:00");
      expect(html).toContain("Em preparação");
      expect(htmlResumoPedido({ ...p, status: "CANCELADO" }, formato)).toContain("PEDIDO CANCELADO — NÃO PREPARAR");
      expect(html).toContain("break-inside:avoid"); expect(html).toContain("&lt;script&gt;"); expect(html).not.toMatch(/<script>|documento-privado|endereco-privado|R\$/);
    }
    expect(resumirRevisaoProducao({ itens: [], total: "100", cpf: "privado" }, { itens: [{ quantidade: "1", produtoSnapshot: { nome: "Kit" } }], total: "200" })).toBe("Itens anteriores: —. Itens atuais: 1 × Kit.");
  });
});
