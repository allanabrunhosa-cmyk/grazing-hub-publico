import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resumirIntegracaoDashboard } from "@/lib/fiscal-dashboard/integracao";

const loja = { id: "singleton", nome: "Emitente fictício", cnpj: "00000000000000", enderecoEstruturado: { cep: "00000000", uf: "SP" } };
// Configuração e pré-requisitos persistem a seleção nesta ordem explícita.
const hash = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
const outraOrdem = { cnpj: loja.cnpj, enderecoEstruturado: loja.enderecoEstruturado, nome: loja.nome, id: loja.id };
const configuracao = { ambiente: "HOMOLOGACAO", tokenConfigurado: true, userTokenConfigurado: true, versao: 7, diagnostico: null, emitenteHash: null,
  preRequisitosEmitenteHash: hash, preRequisitos: { versaoConfiguracao: 7, verificadoEm: "2026-10-14T12:00:00.000Z", empresaVerificadaEm: "2026-10-14T12:00:01.000Z", empresaCorrespondente: true } };

describe("Dashboard: identidade do emitente independente da ordem da projeção", () => {
  it("mantém BuscarEmpresa confirmada quando as mesmas chaves chegam em outra ordem", () => {
    expect(resumirIntegracaoDashboard(configuracao, outraOrdem, "HOMOLOGACAO")).toMatchObject({ situacao: "CONECTADA", verificadaEm: "2026-10-14T12:00:01.000Z", emissaoHabilitada: false });
  });
  it("mantém diagnóstico anterior do mesmo emitente sem exigir ordem do objeto consumidor", () => {
    const salvo = { ...configuracao, preRequisitos: undefined, preRequisitosEmitenteHash: null, emitenteHash: hash, diagnostico: { verificadaEm: "2026-10-14T12:00:00.000Z", acessoAutenticado: true, emitenteCorrespondente: true } };
    expect(resumirIntegracaoDashboard(salvo, outraOrdem, "HOMOLOGACAO").situacao).toBe("CONECTADA");
  });
  it("preserva os bloqueios por mudança de identidade, versão e ambiente", () => {
    for (const cadastro of [{ ...outraOrdem, cnpj: "11111111111111" }, { ...outraOrdem, nome: "Outro emitente fictício" }, { ...outraOrdem, enderecoEstruturado: { cep: "00000000", uf: "RJ" } }]) expect(resumirIntegracaoDashboard(configuracao, cadastro, "HOMOLOGACAO").situacao).not.toBe("CONECTADA");
    expect(resumirIntegracaoDashboard({ ...configuracao, versao: 8 }, outraOrdem, "HOMOLOGACAO").situacao).not.toBe("CONECTADA");
    expect(resumirIntegracaoDashboard(configuracao, outraOrdem, "PRODUCAO").situacao).not.toBe("CONECTADA");
  });
});
