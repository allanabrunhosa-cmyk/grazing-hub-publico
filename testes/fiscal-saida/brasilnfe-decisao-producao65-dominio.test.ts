import { describe, expect, it } from "vitest";
import { habilitacaoCorrespondeBrasilNfe, restaurarDecisaoProducao65BrasilNfe, restaurarHabilitacaoEmissaoBrasilNfe, selarDecisaoProducao65BrasilNfe, validarDecisaoProducao65BrasilNfe, type EntradaDecisaoProducao65BrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional-dominio";

const entrada = (modoRegistro: EntradaDecisaoProducao65BrasilNfe["modoRegistro"] = "SESSAO_NORMAL"): EntradaDecisaoProducao65BrasilNfe => ({
  versao: 1, tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL", motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL", confirmarResponsabilidade: true, modoRegistro,
});
const contexto = { ambiente: "PRODUCAO" as const, versaoConfiguracao: 9, emitenteHash: "a".repeat(64) };
const autoria = { autor: { userId: "responsavel-exclusivamente-sintetico", nome: "Pessoa exclusivamente fictícia" }, registradaEm: "2026-10-20T23:40:00.000Z", cscProducaoVerificadoEm: "2026-10-20T23:38:00.000Z" };
const selar = (modo?: EntradaDecisaoProducao65BrasilNfe["modoRegistro"]) => selarDecisaoProducao65BrasilNfe(entrada(modo), { ...contexto, ...autoria });
const habilitacao = () => ({ ambiente: "PRODUCAO", habilitada: true, revisao: 3, versaoConfiguracao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash, modelos: [55, 65] });
const criadaEm = new Date("2026-10-20T23:40:00.001Z");

describe("Decisão administrativa exclusiva para produção65", () => {
  it.each(["SESSAO_NORMAL", "AUTOMACAO_ASSISTIDA"] as const)("exige conteúdo fixo, confirmação e modo explícito: %s", modo => {
    expect(validarDecisaoProducao65BrasilNfe(entrada(modo))).toEqual(entrada(modo));
  });
  it.each([
    { versao: 2 }, { tipo: "HOMOLOGACAO_COMPROVADA" }, { motivo: "IGNORAR_REGRAS" }, { confirmarResponsabilidade: false },
    { modoRegistro: undefined }, { modoRegistro: "USUARIO" }, { modelo: 55 }, { ambiente: "HOMOLOGACAO" },
    { responsavel: autoria.autor }, { executor: autoria.autor }, { origem: "INSTRUCAO_RESPONSAVEL" }, { hashConteudo: "a".repeat(64) },
  ])("rejeita entrada alterada ou com autoria/selo fornecidos pelo cliente: %j", mudanca => {
    expect(() => validarDecisaoProducao65BrasilNfe({ ...entrada(), ...mudanca })).toThrow();
  });
  it("rejeita campo ausente, objeto herdado, lista e chaves simbólicas", () => {
    const incompleta: Partial<EntradaDecisaoProducao65BrasilNfe> = entrada(); delete incompleta.modoRegistro;
    for (const valor of [null, [], incompleta, Object.create(entrada()), { ...entrada(), [Symbol("campo-oculto")]: true }]) {
      expect(() => validarDecisaoProducao65BrasilNfe(valor)).toThrow();
    }
  });
  it.each([
    ["SESSAO_NORMAL", "SESSAO_ADMINISTRATIVA", "Sessão normal"],
    ["AUTOMACAO_ASSISTIDA", "INSTRUCAO_RESPONSAVEL", "Codex"],
  ] as const)("registra responsável autenticado e distingue executor no modo%s", (modo, origem, identificacao) => {
    const d = selar(modo);
    expect(d).toMatchObject({ ...entrada(modo), modelo: 65, ambiente: "PRODUCAO", origem,
      responsavel: { usuarioId: autoria.autor.userId, nome: autoria.autor.nome },
      executor: { usuarioId: autoria.autor.userId, nome: autoria.autor.nome, modo, identificacao },
      cscProducaoVerificadoEm: autoria.cscProducaoVerificadoEm });
    expect(d.hashConteudo).toMatch(/^[a-f0-9]{64}$/);
    expect(restaurarDecisaoProducao65BrasilNfe(d, contexto)).toEqual(d);
    expect(d).not.toHaveProperty("documentosHomologados"); expect(d).not.toHaveProperty("protocolo");
    expect(d).not.toHaveProperty("csc"); expect(d).not.toHaveProperty("autorizarUmaTransmissao");
  });
  it.each([
    { versaoConfiguracao: 0 }, { versaoConfiguracao: 1.5 }, { emitenteHash: "nao-confirmado" },
    { autor: { userId: "", nome: autoria.autor.nome } }, { autor: { userId: autoria.autor.userId, nome: "" } },
    { autor: { userId: autoria.autor.userId, nome: "<script>" } }, { registradaEm: "2026-02-30T23:40:00.000Z" },
    { cscProducaoVerificadoEm: "2026-10-20" }, { cscProducaoVerificadoEm: "2026-10-20T23:41:00.000Z" },
  ])("não sela autoria, configuração ou evidência cronológica inválida: %j", mudanca => {
    expect(() => selarDecisaoProducao65BrasilNfe(entrada(), { ...contexto, ...autoria, ...mudanca })).toThrow();
  });
  it.each([
    { modelo: 55 }, { ambiente: "HOMOLOGACAO" }, { versaoConfiguracao: 10 }, { emitenteHash: "b".repeat(64) },
    { registradaEm: "2026-10-20T23:40:00.001Z" }, { cscProducaoVerificadoEm: "2026-10-20T23:37:00.000Z" },
    { origem: "INSTRUCAO_RESPONSAVEL" }, { modoRegistro: "AUTOMACAO_ASSISTIDA" }, { hashConteudo: "b".repeat(64) },
    { responsavel: { usuarioId: "outro-usuario-sintetico", nome: autoria.autor.nome } },
    { executor: { usuarioId: autoria.autor.userId, nome: autoria.autor.nome, modo: "SESSAO_NORMAL", identificacao: "Codex" } },
    { campoDesconhecido: true },
  ])("restauro rejeita modificação de conteúdo ou selo: %j", mudanca => {
    expect(restaurarDecisaoProducao65BrasilNfe({ ...selar(), ...mudanca }, contexto)).toBeNull();
  });
  it.each([
    { ambiente: "HOMOLOGACAO" as const }, { versaoConfiguracao: 10 }, { emitenteHash: "b".repeat(64) },
  ])("decisão não abrange outro ambiente, configuração ou emitente: %j", mudanca => {
    expect(restaurarDecisaoProducao65BrasilNfe(selar(), { ...contexto, ...mudanca })).toBeNull();
  });
  it("selo independe da ordem de chaves retornada pelo JSONB e cobre autoria/modo/evidência", () => {
    const d = selar(), invertida = Object.fromEntries(Object.entries(d).reverse());
    expect(restaurarDecisaoProducao65BrasilNfe(invertida, contexto)).toEqual(d);
    const outros = [selar("AUTOMACAO_ASSISTIDA"),
      selarDecisaoProducao65BrasilNfe(entrada(), { ...contexto, ...autoria, autor: { userId: "outro-responsavel-sintetico", nome: "Outro nome fictício" } }),
      selarDecisaoProducao65BrasilNfe(entrada(), { ...contexto, ...autoria, cscProducaoVerificadoEm: "2026-10-20T23:37:00.000Z" })];
    expect(outros.every(o => o.hashConteudo !== d.hashConteudo)).toBe(true);
  });
  it("habilitação restaura a decisão somente no próprio contexto e conserva modelos55/65", () => {
    const d = selar(), h = restaurarHabilitacaoEmissaoBrasilNfe("evento-sintetico", { ...habilitacao(), decisaoProducao65: d }, criadaEm)!;
    expect(h.decisaoProducao65).toEqual(d);
    for (const modelo of [55, 65] as const) expect(habilitacaoCorrespondeBrasilNfe(h, { versao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash }, "PRODUCAO", modelo)).toBe(true);
    expect(habilitacaoCorrespondeBrasilNfe({ ...h, habilitada: false }, { versao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash }, "PRODUCAO", 65)).toBe(false);
  });
  it.each([{ ambiente: "HOMOLOGACAO" }, { modelos: [55] }, { versaoConfiguracao: 10 }, { emitenteHash: "b".repeat(64) }])("não restaura decisão anexada a habilitação incompatível: %j", mudanca => {
    expect(restaurarHabilitacaoEmissaoBrasilNfe("evento-sintetico", { ...habilitacao(), ...mudanca, decisaoProducao65: selar() }, criadaEm)).toBeNull();
  });
  it("campo presente inválido não vira ausência e não restaura uma habilitação sem decisão", () => {
    for (const valor of [undefined, null, {}, { ...selar(), hashConteudo: "invalido" }]) {
      expect(restaurarHabilitacaoEmissaoBrasilNfe("evento-sintetico", { ...habilitacao(), decisaoProducao65: valor }, criadaEm)).toBeNull();
    }
  });
  it("registro legado55 sem campo mantém a habilitação original e não ganha decisão retroativa", () => {
    const h = restaurarHabilitacaoEmissaoBrasilNfe("evento-legado-sintetico", { ...habilitacao(), modelos: [55] }, criadaEm)!;
    expect(h).not.toHaveProperty("decisaoProducao65");
    expect(habilitacaoCorrespondeBrasilNfe(h, { versao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash }, "PRODUCAO", 55)).toBe(true);
    expect(habilitacaoCorrespondeBrasilNfe(h, { versao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash }, "PRODUCAO", 65)).toBe(false);
  });
});
