import { describe, expect, it } from "vitest";
import { AgregadorDashboardFiscal } from "@/lib/fiscal-dashboard/agregacao";
import { normalizarFiltrosDashboard } from "@/lib/fiscal-dashboard/dominio";
import { cnpjEmitenteDashboard, saidaDashboard, xmlDashboard } from "./fixtures";
import { evidenciaServicoDashboard } from "@/lib/fiscal-dashboard/servicos";

describe("Período do DRE e despesas fiscais", () => {
  it("lê data e ambiente de elementos XML, sem aceitar comentários ou ambiguidades", () => {
    const evidencia = evidenciaServicoDashboard('<NFSe><!-- <tpAmb>2</tpAmb><dhEmi>2020-01-01</dhEmi> --><dhEmi>2026-10-01T00:10:00-03:00</dhEmi><tpAmb>1</tpAmb></NFSe>', cnpjEmitenteDashboard);
    expect(evidencia).toMatchObject({ dia: "2026-10-01", ambiente: "PRODUCAO", documento: true });
    expect(evidenciaServicoDashboard('<NFSe><tpAmb>1</tpAmb><DPS><tpAmb>2</tpAmb></DPS></NFSe>', cnpjEmitenteDashboard)).toMatchObject({ ambiente: null, ambienteInformado: true });
    expect(evidenciaServicoDashboard('<DPS><dhEmi>2026-10-01</dhEmi></DPS>', cnpjEmitenteDashboard).documento).toBe(false);
  });
  it("inclui limites e múltiplos meses pelas datas oficiais", () => {
    const filtros = normalizarFiltrosDashboard({ de: "2026-09-30", ate: "2026-10-01" });
    const a = new AgregadorDashboardFiscal(filtros, cnpjEmitenteDashboard);
    a.adicionarSaida(saidaDashboard({ id: "setembro", xml: xmlDashboard({ data: "2026-09-30T23:59:59-03:00" }) }));
    a.adicionarSaida(saidaDashboard());
    a.adicionarSaida(saidaDashboard({ id: "fora", xml: xmlDashboard({ data: "2026-10-02T00:00:00-03:00" }) }));
    const r = a.concluir();
    expect(r.metricas.faturamento).toMatchObject({ valor: "250.74", quantidade: 2 });
    expect(r.movimentoDiario.map(d => d.dia)).toEqual(["2026-09-30", "2026-10-01"]);
  });
  it("aceita limites vazios sem inventar um mês para o histórico", () => {
    const a = new AgregadorDashboardFiscal(normalizarFiltrosDashboard({ de: "", ate: "" }), cnpjEmitenteDashboard);
    a.adicionarSaida(saidaDashboard({ xml: xmlDashboard({ data: "2025-08-01T00:10:00-03:00" }) }));
    expect(a.concluir().metricas.faturamento.valor).toBe("125.37");
    expect(a.concluir().movimentoDiario[0].dia).toBe("2025-08-01");
  });
  it.each([{ de: "2026-02-30" }, { de: "0000-01-01" }, { de: "2026-10-03", ate: "2026-10-01" }, { ate: "2026-10-01T00:00:00Z" }, { de: ["2026-10-01", "2026-10-02"] }])("recusa filtro inválido sem substituir a data: %j", filtros => {
    expect(() => normalizarFiltrosDashboard(filtros)).toThrow();
  });
  it("soma serviços em centavos e mantém canceladas fora das despesas e do movimento", () => {
    const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard);
    const nota = { id: "servico", numero: "12", status: "ACEITA", dataFiscal: "2026-10-02", valor: "100.01", comprovado: true };
    a.adicionarServico(nota); a.adicionarServico({ ...nota, id: "cancelada", status: "CANCELADA", valor: "900.00" });
    a.adicionarServico({ ...nota, id: "outro-mes", dataFiscal: "2026-09-30" });
    const r = a.concluir();
    expect(r.metricas.entradas).toMatchObject({ valor: "100.01", quantidade: 1 });
    expect(r.documentosPorTipo?.NFS_ENTRADA).toBe(2);
    expect(r.ultimosDocumentos.map(d => d.status).sort()).toEqual(["CANCELADO", "RECEBIDA"]);
    expect(r.movimentoDiario.find(d => d.dia === "2026-10-02")?.entradas).toBe("100.01");
  });
  it("diferencia serviço incompleto de zero e conserva oito recentes por tipo", () => {
    const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard);
    a.adicionarServico({ id: "incompleta", numero: null, status: "PENDENTE", dataFiscal: null, valor: null, comprovado: false });
    for (let i = 0; i < 12; i++) a.adicionarSaida(saidaDashboard({ id: `saida-${i}` }));
    a.adicionarServico({ id: "nfse", numero: "1", status: "PENDENTE", dataFiscal: "2026-10-01", valor: "10.00", comprovado: true });
    const r = a.concluir();
    expect(r.metricas.entradas.valor).toBeNull(); expect(r.metricas.entradas.quantidade).toBeNull();
    expect(r.ultimosDocumentos).toHaveLength(9);
    expect(r.documentosPorTipo).toMatchObject({ NF_SAIDA: 12, NFS_ENTRADA: 1 });
  });
});
