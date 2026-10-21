import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { resumirIntegracaoDashboard, type EventoHabilitacaoDashboard } from "@/lib/fiscal-dashboard/integracao";
const loja = { id: "singleton", nome: "Empresa exclusivamente sintética", cnpj: "00000000000000", enderecoEstruturado: null };
const hashEmitente = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
const configuracao = { versao: 3, ambiente: "HOMOLOGACAO", tokenConfigurado: true, userTokenConfigurado: true, diagnostico: null, emitenteHash: hashEmitente };
const evento = (dados = {}, id = "controle-ficticio", data = "2026-10-15T12:00:00.000Z"): EventoHabilitacaoDashboard => ({ id, createdAt: new Date(data), dados: { revisao: 1, ambiente: "PRODUCAO", habilitada: true, modelos: [55], versaoConfiguracao: 3, emitenteHash: hashEmitente, ...dados } });
it("resume a habilitação manual de NF-e pelo controle atual, separada da NFC-e e da consulta de serviços", () => {
  const r = resumirIntegracaoDashboard(configuracao, loja, "PRODUCAO", [evento()]);
  expect(r.emissaoHabilitada).toBe(true); expect(r.emissaoManual).toEqual({ nfe: true, nfce: false, atualizadaEm: "2026-10-15T12:00:00.000Z" });
  expect(r.servicos.nfe).toBe("NAO_CONFIRMADO"); expect(r.situacao).toBe("NAO_VERIFICADA");
});
it("a suspensão mais recente prevalece sobre uma habilitação histórica", () => {
  const r = resumirIntegracaoDashboard(configuracao, loja, "PRODUCAO", [evento(), evento({ habilitada: false, revisao: 2 }, "suspensao-ficticia", "2026-10-15T13:00:00.000Z")]);
  expect(r.emissaoHabilitada).toBe(false); expect(r.emissaoManual?.nfe).toBe(false);
});
it("registro mais recente inválido não restaura a habilitação antiga no painel", () => {
  const r = resumirIntegracaoDashboard(configuracao, loja, "PRODUCAO", [evento(), evento({ modelos: [55, 65], decisaoProducao65: { hashConteudo: "a".repeat(64) } }, "decisao-invalida", "2026-10-20T13:00:00.000Z")]);
  expect(r.emissaoHabilitada).toBe(false); expect(r.emissaoManual).toEqual({ nfe: false, nfce: false, atualizadaEm: null });
});
it.each(["versao", "emitente", "ambiente"])("não reaproveita a habilitação após alteração de %s", alteracao => {
  const r = resumirIntegracaoDashboard(alteracao === "versao" ? { ...configuracao, versao: 4 } : configuracao, alteracao === "emitente" ? { ...loja, nome: "Outro emitente sintético" } : loja, alteracao === "ambiente" ? "HOMOLOGACAO" : "PRODUCAO", [evento()]);
  expect(r.emissaoHabilitada).toBe(false); expect(r.emissaoManual?.nfe).toBe(false);
});
it("retorna somente projeção fixa, sem texto livre dos eventos nem credenciais", () => {
  const r = resumirIntegracaoDashboard(configuracao, loja, "PRODUCAO", [evento({ mensagemExterna: "SEGREDO_SINTETICO_NAO_PROJETAR", token: "TOKEN_SINTETICO_NAO_PROJETAR" })]);
  expect(r.emissaoManual?.nfe).toBe(true); expect(JSON.stringify(r)).not.toContain("NAO_PROJETAR");
});
