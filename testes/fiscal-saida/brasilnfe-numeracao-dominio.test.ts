import { describe, expect, it } from "vitest";
import { projetarNumeracaoFiscalBrasilNfe, restaurarRegistroNumeracaoBrasilNfe, type AutorizacaoLocalNumeracao } from "@/lib/fiscal-saida/brasilnfe/numeracao-dominio";
const hash = "a".repeat(64), cnpj = "0".repeat(14);
const registro = () => ({ esquema: "grazing.brasilnfe.numeracao", versao: 1, versaoConfiguracao: 3, emitenteHash: hash, consultadoEm: "2026-10-14T12:00:00.000Z", resultado: { numeracoes: [{ ambiente: 2, modelo: 55, serie: "001", numero: "12", padrao: true }], avisosPresentes: false }, falha: null });
const local = (): AutorizacaoLocalNumeracao => ({ id: "documento-sintetico", ambiente: "HOMOLOGACAO", modeloDocumento: 55, chaveFiscal: ["35", "2610", cnpj, "55", "001", "000000012", "1", "00000000", "0"].join(""), numero: "12", serie: "1", protocolo: "123456789012345", eventos: [{ createdAt: new Date("2026-10-14T11:00:00Z") }] });
const projetar = (r: unknown = registro(), autorizacoes: AutorizacaoLocalNumeracao[] = []) => projetarNumeracaoFiscalBrasilNfe({ versao: 3, emitenteHash: hash, emitente: { cnpj, nome: "Emitente fictício" }, registro: r, autorizacoes });
describe("Numeração: projeção vinculada e comparação local restrita", () => {
  it("não presume contador antes de consulta", () => { const dto = projetar(null); expect(dto.consulta.situacao).toBe("NAO_CONSULTADA"); expect(dto.linhas).toEqual([]); });
  it.each([{ versaoConfiguracao: 4 }, { emitenteHash: "b".repeat(64) }])("invalida consulta após configuração/emitente mudar", mudanca => { const dto = projetar({ ...registro(), ...mudanca }); expect(dto.consulta.situacao).toBe("OBSOLETA"); expect(dto.consulta.consultadoEm).toBeNull(); expect(dto.linhas).toEqual([]); });
  it("detecta contador que não supera autorização local na mesma série/ambiente/emitente", () => {
    const dto = projetar(registro(), [local()]); expect(dto.linhas[0]).toMatchObject({ proximoNumero: "12", serie: "001", ultimaAutorizadaLocal: { numero: "12" }, divergencia: "CONTADOR_NAO_SUPERA_AUTORIZADA_LOCAL" });
  });
  it.each([{ ambiente: "PRODUCAO" }, { modeloDocumento: 65 }, { serie: "2" }, { chaveFiscal: "1".repeat(44) }, { protocolo: null }])("não mistura autorização de outra identidade: %j", mudanca => {
    const dto = projetar(registro(), [{ ...local(), ...mudanca }]); expect(dto.linhas[0].ultimaAutorizadaLocal).toBeNull(); expect(dto.linhas[0].divergencia).toBeNull();
  });
  it("auditoria falha não vira contador ou êxito e elimina textos extras", () => {
    const r = { ...registro(), resultado: null, falha: { categoria: "HTTP", httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null, Error: "segredo-ficticio" }, Token: "segredo-ficticio" };
    const dto = projetar(r); expect(dto.consulta).toMatchObject({ situacao: "FALHOU", httpStatus: 403 }); expect(dto.linhas).toEqual([]); expect(JSON.stringify(dto)).not.toContain("segredo-ficticio");
  });
  it.each([{ resultado: { numeracoes: [{ ambiente: 2, modelo: 55, serie: "1", numero: "0", padrao: true }], avisosPresentes: false } }, { resultado: { numeracoes: [{ ambiente: 1, modelo: 10, serie: "1", numero: "1", padrao: true }], avisosPresentes: false } }, { consultadoEm: "texto-ficticio" }])("recusa metadados fora da lista permitida", mudanca => { expect(restaurarRegistroNumeracaoBrasilNfe({ ...registro(), ...mudanca })).toBeNull(); });
  it("conserva somente a contagem dos outros modelos; não cria linhas ou valida seus contadores", () => {
    const r = registro();
    const dto = projetar({ ...r, resultado: { ...r.resultado, itensForaEscopo: 6, outrosModelos: [{ Numero: "SEGREDO-FICTICIO", Serie: "SEGREDO-FICTICIO" }] } });
    expect(dto.consulta).toMatchObject({ situacao: "CONCLUIDA", itensForaEscopo: 6 }); expect(dto.linhas).toHaveLength(1); expect(dto.linhas[0].modelo).toBe(55);
    expect(JSON.stringify(dto)).not.toContain("SEGREDO-FICTICIO");
  });
  it.each([0, -1, 1.5, 1001, "6", null, { token: "SEGREDO-FICTICIO" }])("recusa contagem fora do contrato sem converter em sucesso: %j", itensForaEscopo => {
    const r = registro(); expect(restaurarRegistroNumeracaoBrasilNfe({ ...r, resultado: { ...r.resultado, itensForaEscopo } })).toBeNull();
  });
  it("limita a soma das entradas aceitas e descartadas ao tamanho máximo da lista", () => {
    const r = registro(); expect(restaurarRegistroNumeracaoBrasilNfe({ ...r, resultado: { ...r.resultado, itensForaEscopo: 1000 } })).toBeNull();
  });
  it("registros antigos continuam sem contagem nem detalhe inventado", () => {
    const dto = projetar(); expect(dto.consulta).not.toHaveProperty("itensForaEscopo");
    const r = { ...registro(), resultado: null, falha: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null } };
    expect(projetar(r).consulta).toMatchObject({ situacao: "FALHOU", httpStatus: 200 }); expect(projetar(r).consulta.falha).not.toHaveProperty("itemNumeracao");
  });
  it("detalhe enumerado é preservado sem valores ou mensagens externos", () => {
    const itemNumeracao = { posicao: 3, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL", valor: "SEGREDO-FICTICIO", mensagem: "<a href='https://example.invalid'>SEGREDO-FICTICIO</a>" };
    const dto = projetar({ ...registro(), resultado: null, falha: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null, itemNumeracao } });
    expect(dto.consulta.falha?.itemNumeracao).toEqual({ posicao: 3, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL" });
    expect(JSON.stringify(dto)).not.toContain("SEGREDO-FICTICIO"); expect(dto.linhas).toEqual([]); expect(dto.consulta.situacao).toBe("FALHOU");
  });
  it.each([{ posicao: 0 }, { posicao: -1 }, { posicao: 1.5 }, { posicao: 1001 }, { posicao: "SEGREDO-FICTICIO" }, { campo: "SEGREDO-FICTICIO" }, { tipoObservado: "<b>SEGREDO-FICTICIO</b>" }, { motivo: "SEGREDO-FICTICIO" }])("suprime detalhe incompatível sem apagar a falha: %j", alteracao => {
    const itemNumeracao = { posicao: 3, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL", ...alteracao };
    const dto = projetar({ ...registro(), resultado: null, falha: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null, itemNumeracao } });
    expect(dto.consulta.situacao).toBe("FALHOU"); expect(dto.consulta.falha).not.toHaveProperty("itemNumeracao"); expect(JSON.stringify(dto)).not.toContain("SEGREDO-FICTICIO");
  });
  it("invalida também a contagem e o detalhe após mudança de configuração", () => {
    const r = registro(); const dto = projetar({ ...r, versaoConfiguracao: 2, resultado: { ...r.resultado, itensForaEscopo: 6 } });
    expect(dto.consulta.situacao).toBe("OBSOLETA"); expect(dto.consulta).not.toHaveProperty("itensForaEscopo");
    const falha = projetar({ ...r, versaoConfiguracao: 2, resultado: null, falha: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null, itemNumeracao: { posicao: 3, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL" } } });
    expect(falha.consulta.falha).toBeNull(); expect(falha.consulta.situacao).toBe("OBSOLETA");
  });
});
