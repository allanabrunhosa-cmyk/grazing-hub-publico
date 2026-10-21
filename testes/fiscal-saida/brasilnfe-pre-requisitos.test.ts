import { describe, expect, it, vi } from "vitest";
import { acompanhamentoCertificadoBrasilNfe, dataCivilCertificadoBrasilNfe, restaurarPreRequisitosBrasilNfe, camposEnderecoExternoAusentesBrasilNfe, ufAusenteConferidaNoPainelBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
describe("Pré-requisitos e acompanhamento local sem segredos", () => {
  it("conferência de UF no painel é restrita, datada e não transforma a consulta incompleta em sucesso", () => {
    const dados = { verificadoEm: "2026-10-12T12:00:00.000Z", empresaCorrespondente: true, emitenteExterno: { endereco: false }, camposEnderecoAusentes: ["uf"], evidenciaPainel: { origem: "PAINEL_BRASIL_NFE", ufEmitente: "SP", observadoEm: "2026-10-12T12:00:00.000Z", registradoEm: "2026-10-12T12:00:00.000Z", servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true, certificadoValidade: "2026-11-07", csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: false, identificador: false } } } };
    const r = restaurarPreRequisitosBrasilNfe(dados, 1), hoje = new Date("2026-10-12T12:01:00Z");
    expect(ufAusenteConferidaNoPainelBrasilNfe(r, hoje)).toBe(true); expect(r.emitenteExterno.endereco).toBe(false); expect(r.transmissaoAutorizada).toBe(false);
    expect(ufAusenteConferidaNoPainelBrasilNfe(r, new Date("2026-10-20T12:00:00Z"))).toBe(false);
    for (const alteracao of [{ camposEnderecoAusentes: ["uf", "cep"] }, { empresaCorrespondente: false }, { evidenciaPainel: { ...dados.evidenciaPainel, origem: "RELATO_USUARIO_PAINEL_BRASIL_NFE" } }, { evidenciaPainel: { ...dados.evidenciaPainel, ufEmitente: "TOKEN_FICTICIO" } }]) expect(ufAusenteConferidaNoPainelBrasilNfe(restaurarPreRequisitosBrasilNfe({ ...dados, ...alteracao }, 1), hoje)).toBe(false);
  });
  it("identifica campos cadastrais ausentes por enum local, sem confundir painel e API", () => {
    const endereco = { cep: "01001000", logradouro: "Rua fictícia", numero: "1", bairro: "Bairro fictício", codigoMunicipio: null, municipio: "Cidade fictícia", uf: "SP" };
    expect(camposEnderecoExternoAusentesBrasilNfe(endereco)).toEqual(["codigoMunicipio"]);
    const r = restaurarPreRequisitosBrasilNfe({ verificadoEm: "2026-10-12T12:00:00.000Z", emitenteExterno: { endereco: false }, camposEnderecoAusentes: ["codigoMunicipio"] }, 1);
    expect(r.pendencias.join()).toContain("código IBGE"); expect(r.pendencias.join()).not.toContain("Completar endereço");
    const malicioso = restaurarPreRequisitosBrasilNfe({ verificadoEm: "2026-10-12T12:00:00.000Z", camposEnderecoAusentes: ["TOKEN_FICTICIO"] }, 1);
    expect(JSON.stringify(malicioso)).not.toContain("TOKEN_FICTICIO");
  });
  it("data civil e contagem respeitam Brasília e não normalizam datas inexistentes", () => {
    expect(dataCivilCertificadoBrasilNfe("2026-02-30")).toBeNull();
    expect(acompanhamentoCertificadoBrasilNfe("2026-11-07", new Date("2026-10-12T01:00:00Z"))).toEqual({ dias: 27, situacao: "RENOVAR" });
    expect(acompanhamentoCertificadoBrasilNfe("2026-11-07", new Date("2026-11-07T18:00:00Z"))).toEqual({ dias: 0, situacao: "VENCE_HOJE" });
    expect(acompanhamentoCertificadoBrasilNfe("2026-11-07", new Date("2026-11-08T18:00:00Z"))).toEqual({ dias: -1, situacao: "VENCIDO" });
  });
  it("não restaura textos/credenciais nem considera HTTP200 suficiente", () => {
    const r = restaurarPreRequisitosBrasilNfe({ verificadoEm: "2026-10-11T12:00:00.000Z", certificado: { situacao: "VALIDO", httpStatus: 200, validade: "nao-data" }, Token: "SEGREDO", pendencias: ["mensagem externa com SEGREDO"] }, 1);
    expect(r.certificado.situacao).toBe("NAO_CONFIRMADO"); expect(JSON.stringify(r)).not.toContain("SEGREDO"); expect(r.transmissaoAutorizada).toBe(false);
  });
  it("painel e API mantêm origens distintas e presença falsa não vira desconhecida", () => {
    const r = restaurarPreRequisitosBrasilNfe({ evidenciaPainel: { origem: "PAINEL_BRASIL_NFE", observadoEm: "2026-10-11T12:00:00.000Z", registradoEm: "2026-10-11T13:00:00.000Z", servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true, certificadoValidade: "2026-11-07", csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: false, identificador: false } } } }, 1);
    expect(r.evidenciaPainel?.servicoNfeNfceAtivo).toBe(true); expect(r.certificado.situacao).toBe("NAO_CONFERIDO"); expect(r.evidenciaPainel?.csc.homologacao.codigo).toBe(false);
    expect(r.pendencias.some(p => p.includes("CSC"))).toBe(true); expect(r.producaoBloqueada).toBe(true);
  });
  it("vencimento local conserva data/proveniência e deixa de apresentar validade vigente", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-08T18:00:00Z"));
    try {
      const r = restaurarPreRequisitosBrasilNfe({ verificadoEm: "2026-10-11T12:00:00.000Z", certificado: { situacao: "VALIDO", validade: "2026-11-07", verificadoEm: "2026-10-11T12:00:00.000Z", httpStatus: 200 } }, 1);
      expect(r.certificado).toMatchObject({ situacao: "EXPIRADO", validade: "2026-11-07", verificadoEm: "2026-10-11T12:00:00.000Z" });
      expect(r.pendencias.some(p => p.includes("Certificado"))).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
