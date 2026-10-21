import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { conferirFciFiscal, validarDecisaoFciFiscal } from "@/lib/tributacao/fci";
import { AVISO_DECLARACAO_FCI, selarDeclaracaoResponsavelFci, validarDeclaracaoResponsavelFci } from "@/lib/tributacao/declaracao-fci";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import { autorFicticio, classificacaoFicticia, contextoFicticio, declaracaoFicticia, fciFicticia } from "./declaracao-fci-fixtures";
import { massaPayloadLocal } from "../fiscal-saida/brasilnfe-payload-local-fixtures";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
describe("Declaração administrativa exclusiva de origem/FCI/GTIN", () => {
  it.each(["HOMOLOGACAO", "PRODUCAO"] as const)("admite o alcance administrativo55/%s sem inventar CI ou controle FCI", ambiente => {
    const entrada = fciFicticia(), antes = structuredClone(entrada), validada = validarDecisaoFciFiscal(entrada);
    expect(conferirFciFiscal("5", validada, { ...contextoFicticio(), ambiente })).toEqual({ numero: null, pendencias: [] });
    expect(validada).toMatchObject({ numero: null, apuracaoCompleta: false, conteudoImportacao: null, valorParcelaImportada: "2.125", valorSaidaReferencia: null, periodoApuracao: "2026-08" }); expect(entrada).toEqual(antes);
    expect(AVISO_DECLARACAO_FCI).toContain("Não representa apuração");
  });
  it.each([{ produtoId: "outro-produto" }, { estabelecimento: "outro-estabelecimento" }, { emitenteCnpj: "11111111111111" }, { materiaisHash: "b".repeat(64) }, { classificacaoVersaoId: "outra-versao" }, { classificacaoVersaoNumero: 5 }, { ufDestino: "MG" }, { modelo: "65" as const }, { data: "2026-10-14" }, { gtin: "4006381333931" }, { ambiente: undefined }])("não estende o alcance silenciosamente %j", extra => {
    const r = conferirFciFiscal("5", fciFicticia(), { ...contextoFicticio(), ...extra }); expect(r.numero).toBeNull(); expect(r.pendencias).toHaveLength(1);
  });
  it.each(["0", "3", "8"])("não altera regra global da origem%s", origem => { expect(conferirFciFiscal(origem, fciFicticia(), contextoFicticio()).pendencias).toHaveLength(1); });
  it("rascunho sem selo não vale como declaração administrativa executável", () => { expect(conferirFciFiscal("5", fciFicticia(false), contextoFicticio()).pendencias).toHaveLength(1); });
  it("recusa nFCI, apuração completa ou dispensa normativa na mesma declaração", () => {
    for (const extra of [{ numero: "ABCDE123-ABCD-1234-ABCD-1234567890AB" }, { apuracaoCompleta: true }, { dispensa: { ufEmitente: "SP", ufDestino: "SP", modelos: ["55"] } }]) expect(() => validarDecisaoFciFiscal({ ...fciFicticia(), ...extra })).toThrow();
  });
  it("recusa selo adulterado, campos livres e declaração aplicada a outro produto", () => {
    const d = declaracaoFicticia();
    for (const extra of [{ materiaisHash: "b".repeat(64) }, { produtoId: "produto-nao-autorizado" }, { Token: "segredo-sintetico" }, { vigenciaInicio: "2026-99-99" }]) expect(() => validarDeclaracaoResponsavelFci({ ...d, ...extra })).toThrow();
    expect(() => validarDadosFiscais("CLASSIFICACAO", { ...classificacaoFicticia(), produtoId: "outro-produto" })).toThrow("Alcance exclusivo");
  });
  it("separa responsável original do executor da revisão seguinte", () => {
    const d = declaracaoFicticia(), nova = selarDeclaracaoResponsavelFci(d, { id: "nova-versao-ficticia", numero: 5 }, { userId: "executor-ficticio", nome: "Executor exclusivamente sintético" }, "2026-10-15T13:00:00.000Z");
    expect(nova.registro!.responsavel.usuarioId).toBe(autorFicticio.userId); expect(nova.registro!.executor.usuarioId).toBe("executor-ficticio"); expect(nova.registro!.executor.identificacao).toBe("Codex"); expect(nova.registro!.hashConteudo).not.toBe(d.registro!.hashConteudo);
  });
  it("não converte a classificação ou outros parâmetros pendentes em aprovação", () => {
    const c = classificacaoFicticia(), validada = validarDadosFiscais("CLASSIFICACAO", c); expect(validada).toEqual(c); expect(validada).toMatchObject({ estado: "PENDENTE", pendencias: ["Demais parâmetros aguardam revisão consolidada explícita."] });
  });
  it("snapshot versionado confere a declaração específica e omite nFCI e metadados no wire", () => {
    const m = massaPayloadLocal(), payload = structuredClone(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).payload!);
    const d = declaracaoFicticia(false); d.emitenteCnpj = m.cadastro.cnpj;
    const fci = fciFicticia(); fci.declaracaoResponsavel = selarDeclaracaoResponsavelFci(d, { id: "classificacao-nova-ficticia", numero: 4 }, autorFicticio, "2026-10-15T12:00:00.000Z");
    payload.Produtos[0].CodProdutoServico = d.produtoId; payload.Produtos[0].OrigemProduto = 5; payload.Produtos[0].EAN = "SEM GTIN";
    const fotografia = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, emitenteUf: "SP", crt: 1, documento: payload, previa: { contexto: { data: "2026-10-15", estabelecimento: "singleton", ufDestino: "SP" }, linhas: [{ produtoId: d.produtoId, fci, classificacaoVersao: { id: "classificacao-nova-ficticia", versao: 4, materiaisHash: d.materiaisHash } }] } } } };
    const r = prepararPayloadSnapshotBrasilNfeLocal(fotografia, 55, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" });
    const wire = JSON.parse(serializarPayloadLocalBrasilNfe(r)); expect(wire.Produtos[0]).not.toHaveProperty("nFCI"); expect(JSON.stringify(wire)).not.toMatch(/declaracaoResponsavel|valorParcelaImportada|registro|responsavel-ficticio/);
    fotografia.payload.tributacao.previa.linhas[0].classificacaoVersao.materiaisHash = "b".repeat(64);
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(fotografia, 55, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).toThrow("FCI");
  });
  it("proposta em produção pode ser revista localmente, mas o contexto normal de envio a recusa", () => {
    const m = massaPayloadLocal(), payload = structuredClone(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).payload!); payload.TipoAmbiente = 1;
    const fotografia = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, crt: 1, documento: payload, revisaoConsolidada: { tipo: "PROPOSTAS_PARA_REVISAO", aprovacaoInterna: false } } } };
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(fotografia, 55, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO" })).toThrow("versões ativas");
    expect(prepararPayloadSnapshotBrasilNfeLocal(fotografia, 55, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO", somentePrevia: true }).montagemConcluida).toBe(true);
  });
});
