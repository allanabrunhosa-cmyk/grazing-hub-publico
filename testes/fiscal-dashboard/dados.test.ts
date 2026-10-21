import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AgregadorDashboardFiscal } from "@/lib/fiscal-dashboard/agregacao";
import { centavosFiscais, diaFiscal, extrairEvidenciaFiscal, moedaFiscal, normalizarFiltrosDashboard } from "@/lib/fiscal-dashboard/dominio";
import { resumirIntegracaoDashboard } from "@/lib/fiscal-dashboard/integracao";
import { cancelamentoDashboard, cnpjEmitenteDashboard, saidaDashboard, xmlDashboard } from "./fixtures";

const agregador = () => new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard);
describe("Métricas fiscais oficiais", () => {
  it("usa vNF autorizado e competência original com offset, sem estimar valores comerciais", () => {
    const a = agregador(); a.adicionarSaida(saidaDashboard());
    const dados = a.concluir();
    expect(dados.metricas.faturamento).toEqual({ valor: "125.37", quantidade: 1, motivo: null });
    expect(dados.movimentoDiario[0]).toEqual({ dia: "2026-10-01", saidas: "125.37", entradas: "0.00" });
    expect(dados.metricas.ticketMedio.valor).toBe("125.37");
    expect(dados.receitaPorDocumento).toEqual([{ modelo: 55, valor: "125.37", quantidade: 1 }, { modelo: 65, valor: "0.00", quantidade: 0 }]);
  });
  it("não mistura homologação e produção, nem outros meses", () => {
    const a = agregador();
    a.adicionarSaida(saidaDashboard({ ambiente: "HOMOLOGACAO", xml: xmlDashboard({ ambiente: "2" }) }));
    a.adicionarSaida(saidaDashboard({ xml: xmlDashboard({ data: "2026-09-30T23:59:59-03:00", mesChave: "2609" }) }));
    expect(a.concluir().metricas.faturamento.valor).toBe("0.00");
  });
  it("um valor ausente torna a soma indisponível, preservando a contagem comprovada", () => {
    const a = agregador();
    a.adicionarSaida(saidaDashboard({ xml: xmlDashboard({ valor: null }) }));
    expect(a.concluir().metricas.faturamento).toMatchObject({ valor: null, quantidade: 1 });
    expect(a.concluir().movimentoDiario[0].saidas).toBeNull();
    expect(a.concluir().metricas.ticketMedio.valor).toBeNull();
  });
  it("data de emissão ausente nunca vira criação, atualização ou confirmação do pedido", () => {
    const a = agregador(); a.adicionarSaida(saidaDashboard({ xml: xmlDashboard({ data: null }) }));
    expect(a.concluir().metricas.faturamento).toMatchObject({ valor: null, quantidade: null });
    expect(a.concluir().movimentoDiario.every(d => d.saidas === null)).toBe(true);
  });
  it.each([
    { protocolo: "protocolo-divergente" }, { chaveFiscal: "9".repeat(44) },
    { xml: xmlDashboard({ ambiente: "2" }) }, { xml: xmlDashboard({ cnpj: "11111111111111" }) },
    { xml: xmlDashboard({ status: "301" }) },
  ])("não agrega autorização contraditória ou incompleta: %j", opcoes => {
    const a = agregador(); a.adicionarSaida(saidaDashboard(opcoes));
    expect(a.concluir().metricas.faturamento.valor).toBeNull();
    expect(a.concluir().pendencias.some(p => p.codigo === "SAIDAS_SEM_COMPROVACAO")).toBe(true);
  });
  it("canceladas não faturam e data interna de retorno não comprova cancelamento mensal", () => {
    const a = agregador(); a.adicionarSaida(saidaDashboard({ status: "CANCELADO" }));
    expect(a.concluir().metricas.faturamento.valor).toBe("0.00");
    expect(a.concluir().metricas.canceladas).toMatchObject({ valor: null, quantidade: null });
    expect(a.concluir().ultimosDocumentos[0]).toMatchObject({ status: "CANCELADO", dataFiscal: "2026-10-01" });
  });
  it("conta cancelamento pela confirmação oficial, mantendo ausência de vNF explícita", () => {
    const a = agregador(); a.adicionarSaida(saidaDashboard({ status: "CANCELADO", xml: cancelamentoDashboard() }));
    expect(a.concluir().metricas.canceladas).toMatchObject({ valor: null, quantidade: 1 });
    expect(extrairEvidenciaFiscal(cancelamentoDashboard()).diaCancelamento).toBe("2026-10-01");
    expect(extrairEvidenciaFiscal(cancelamentoDashboard({ status: "136" })).cancelado).toBe(false);
  });
  it("cancelada com XML de outro emitente/rejeitado não publica valor ou data como comprovados", () => {
    const a = agregador(); a.adicionarSaida(saidaDashboard({ status: "CANCELADO", xml: xmlDashboard({ cnpj: "11111111111111", status: "301" }) }));
    expect(a.concluir().ultimosDocumentos).toHaveLength(0);
    expect(a.concluir().pendencias).toContainEqual(expect.objectContaining({ codigo: "CANCELADAS_SEM_COMPROVACAO" }));
  });
  it("diferencia zero comprovado e média sem documentos", () => {
    const dados = agregador().concluir();
    expect(dados.metricas.faturamento.valor).toBe("0.00");
    expect(dados.metricas.canceladas.valor).toBe("0.00");
    expect(dados.metricas.ticketMedio.valor).toBeNull();
    expect(dados.metricas.ticketMedio.motivo).toContain("Sem documentos");
  });
  it("pendências sem ambiente não entram em valores de nenhum ambiente", () => {
    const a = agregador(); a.adicionarSaida(saidaDashboard({ ambiente: "NAO_CONFIGURADO", status: "SEM_EMISSOR", xml: null }));
    expect(a.concluir().metricas.faturamento.valor).toBe("0.00");
    expect(a.concluir().pendencias).toContainEqual(expect.objectContaining({ codigo: "SAIDAS_SEM_AMBIENTE", quantidade: 1 }));
  });
  it("mantém memória do resultado limitada aos dias e oito documentos, sem teto de documentos processados", () => {
    const a = agregador();
    for (let i = 0; i < 15001; i++) a.adicionarSaida(saidaDashboard({ id: `sintetico-${i}` }));
    const dados = a.concluir();
    expect(dados.metricas.faturamento.quantidade).toBe(15001);
    expect(dados.metricas.faturamento.valor).toBe("1880675.37");
    expect(dados.ultimosDocumentos).toHaveLength(8);
    expect(dados.movimentoDiario).toHaveLength(31);
  }, 15000);
});

describe("Precisão, calendário e evidência XML", () => {
  it("mantém centavos exatos além do inteiro seguro e arredonda média uma única vez", () => {
    expect(moedaFiscal(centavosFiscais("9007199254740991.99")!)).toBe("9007199254740991.99");
    const a = agregador(); a.adicionarSaida(saidaDashboard({ xml: xmlDashboard({ valor: "0.01" }) }));
    a.adicionarSaida(saidaDashboard({ id: "zero", xml: xmlDashboard({ valor: "0.00" }) }));
    expect(a.concluir().metricas.ticketMedio.valor).toBe("0.01");
  });
  it.each(["NaN", "1,50", "-1.00", "2.345", "1e3", "Infinity"])("recusa valor inválido %s", valor => expect(centavosFiscais(valor)).toBeNull());
  it("valida dias reais e conserva competência do XML mesmo em fronteiras UTC", () => {
    expect(diaFiscal("2026-02-30T12:00:00-03:00")).toBeNull();
    expect(diaFiscal("2024-02-29")).toBe("2024-02-29");
    expect(diaFiscal("2026-09-30T23:59:59-03:00")).toBe("2026-09-30");
    expect(normalizarFiltrosDashboard({ mes: "2026-13", ambiente: "TODOS" }, new Date("2026-11-01T01:00:00Z"))).toEqual({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(normalizarFiltrosDashboard({ mes: ["2026-10", "2026-09"] }, new Date("2026-10-11T12:00:00Z")).mes).toBe("2026-10");
  });
  it.each(["<nfeProc>", "<html>erro</html>", "<!DOCTYPE nfeProc [<!ENTITY x SYSTEM 'file:///privado'>]><nfeProc>&x;</nfeProc>"])("não reconhece XML inadequado %s", xml => expect(extrairEvidenciaFiscal(xml).autorizado).toBe(false));
});

describe("Diagnóstico administrativo e certificado", () => {
  const loja = { id: "singleton", nome: "Emitente sintético", cnpj: cnpjEmitenteDashboard, enderecoEstruturado: null };
  const config = { ambiente: "HOMOLOGACAO", tokenConfigurado: true, userTokenConfigurado: true, diagnostico: null as unknown, emitenteHash: null as string | null };
  it("credenciais configuradas não comprovam conexão, serviço contratado ou certificado", () => {
    const dto = resumirIntegracaoDashboard(config, loja, "HOMOLOGACAO");
    expect(dto).toMatchObject({ credenciaisConfiguradas: true, situacao: "NAO_VERIFICADA", servicos: { nfe: "NAO_CONFIRMADO" }, certificado: { situacao: "NAO_VERIFICADO", validoAte: null }, emissaoHabilitada: false });
    expect(JSON.stringify(dto)).not.toContain("segredo-sintetico");
  });
  it("usa somente diagnóstico do mesmo emitente e ambiente, sem atribuir validade fiscal", () => {
    const salvo = { ...config, emitenteHash: createHash("sha256").update(JSON.stringify(loja)).digest("hex"), diagnostico: {
      verificadaEm: "2026-10-11T12:00:00.000Z", acessoAutenticado: true, emitenteCorrespondente: true,
      servicosEmissao: { nfe: "ATIVO", nfce: "INATIVO", verificadosEm: "2026-10-11T12:00:00.000Z" },
      certificadoValido: true, validadeCertificado: "2099-01-01", token: "NAO_SERIALIZAR",
    } };
    expect(resumirIntegracaoDashboard(salvo, loja, "HOMOLOGACAO")).toMatchObject({ situacao: "CONECTADA", servicos: { nfe: "ATIVO", nfce: "INATIVO" }, certificado: { situacao: "NAO_VERIFICADO" } });
    expect(resumirIntegracaoDashboard(salvo, loja, "PRODUCAO").servicos.nfe).toBe("NAO_CONFIRMADO");
    expect(resumirIntegracaoDashboard(salvo, { ...loja, nome: "Cadastro alterado" }, "HOMOLOGACAO").situacao).toBe("DESATUALIZADA");
    expect(JSON.stringify(resumirIntegracaoDashboard(salvo, loja, "HOMOLOGACAO"))).not.toContain("NAO_SERIALIZAR");
  });
});
