import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { classificacoesCompletasRegraBrasilNfe, classificacoesRegraBrasilNfe, dataCivilRegraBrasilNfe, hashRegraFiscalBrasilNfe, materializarItemRegraBrasilNfe, validarRascunhoRegraFiscalBrasilNfe, validarSelecaoRegrasDocumentoBrasilNfe, vigenteRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { prepararPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";

describe("Decisões tributárias reutilizáveis — massas sintéticas, sem HTTP/banco", () => {
  it.each(["EMPRESA", "OPERACAO", "PRODUTO", "GRUPO"] as const)("valida escopo %s sem inventar campos ou modificar entrada", alvo => {
    const entrada = rascunhoRegraSintetica(alvo), original = JSON.stringify(entrada);
    expect(validarRascunhoRegraFiscalBrasilNfe(entrada)).toEqual(entrada); expect(JSON.stringify(entrada)).toBe(original);
  });
  it.each([55, 65] as const)("conserva o modelo %s e rejeita operação divergente", modelo => {
    const entrada = rascunhoRegraSintetica("PRODUTO", modelo); expect(validarRascunhoRegraFiscalBrasilNfe(entrada).modelo).toBe(modelo);
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...entrada, operacao: modelo === 55 ? "NFC_E_VENDA" : "NF_E_VENDA" })).toThrow("inválida");
  });
  it.each(["Token", "UserToken", "CSC", "senha", "certificado", "headers", "cookie", "callback", "producao"])("recusa campo fora do contrato: %s", campo => {
    const m = rascunhoRegraSintetica();
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...m, [campo]: "segredo-refletido-somente-teste" })).toThrow("inválida");
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...m, conteudo: { ...m.conteudo, [campo]: "segredo-refletido-somente-teste" } })).toThrow("inválida");
  });
  it("recusa base monetária reutilizável, dado pessoal e cartão no perfil", () => {
    const m = rascunhoRegraSintetica(), op = rascunhoRegraSintetica("OPERACAO");
    if (m.conteudo.tipo !== "ITEM" || op.conteudo.tipo !== "OPERACAO") throw new Error("Massa inválida");
    const itemConteudo = m.conteudo, opConteudo = op.conteudo;
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...m, conteudo: { ...itemConteudo, perfil: { ...itemConteudo.perfil, icms: { tratamento: "TRIBUTADO", AliquotaICMS: "18", modalidadeBcIcms: 3, BaseCalculo: "25" } } } })).toThrow("inválida");
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...op, conteudo: { ...opConteudo, destinatario: { ...opConteudo.destinatario, CpfCnpj: "00000000000" } } })).toThrow("inválida");
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...op, conteudo: { ...opConteudo, pagamentos: { ...opConteudo.pagamentos, mapeamentos: [{ ...opConteudo.pagamentos.mapeamentos[0], cartao: { NumeroAutorizacao: "123" } }] } } })).toThrow("inválida");
  });
  it.each(["<script>alert(1)</script>", "Token=segredo", "UserToken: segredo", "Bearer=valor", "https://example.invalid", "a".repeat(40), "campo\u0000segredo"])("mensagens inválidas não refletem conteúdo no erro", segredo => {
    const m = rascunhoRegraSintetica("OPERACAO");
    if (m.conteudo.tipo !== "OPERACAO") throw new Error("Massa inválida");
    try { validarRascunhoRegraFiscalBrasilNfe({ ...m, conteudo: { ...m.conteudo, operacao: { ...m.conteudo.operacao, NaturezaOperacao: segredo } } }); expect.fail("Deveria recusar"); }
    catch (e) { expect((e as Error).message).not.toContain(segredo); expect((e as { campo: string }).campo).toBe("operacao.NaturezaOperacao"); }
  });
  it.each(["2026-02-30", "2026-02-29", "11/10/2026", "2026-10-11T00:00:00Z", "1999-12-31", "2200-01-01"])("datas civis inválidas recusadas: %s", data => { expect(() => dataCivilRegraBrasilNfe(data)).toThrow("inválida"); });
  it("vigência exige aprovação explícita e inclui ambas as datas civis, sem instante UTC", () => {
    expect(dataCivilRegraBrasilNfe("2028-02-29")).toBe("2028-02-29");
    const v = { estado: "APROVADA", vigenteDesde: "2026-10-10", vigenteAte: "2026-10-11" };
    expect(vigenteRegraFiscalBrasilNfe(v, "2026-10-10")).toBe(true); expect(vigenteRegraFiscalBrasilNfe(v, "2026-10-11")).toBe(true);
    for (const data of ["2026-10-09", "2026-10-12"]) expect(vigenteRegraFiscalBrasilNfe(v, data)).toBe(false);
    for (const estado of ["RASCUNHO", "INATIVA"]) expect(vigenteRegraFiscalBrasilNfe({ ...v, estado }, "2026-10-11")).toBe(false);
    const d = rascunhoRegraSintetica(); expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...d, vigenteAte: "2025-12-31" })).toThrow("inválida");
  });
  it("hash é estável com JSONB e muda se a regra muda", () => {
    expect(hashRegraFiscalBrasilNfe({ b: 2, a: { x: 1, y: 2 } })).toBe(hashRegraFiscalBrasilNfe({ a: { y: 2, x: 1 }, b: 2 }));
    expect(hashRegraFiscalBrasilNfe({ Aliquota: "18" })).not.toBe(hashRegraFiscalBrasilNfe({ Aliquota: "17" }));
  });
  it("classificações fotografam campos estruturados e excluem observações livres do cadastro", () => {
    const c = classificacoesRegraBrasilNfe({ ncm: "00000000", observacoes: "Texto que não entra no complemento", token: "nuncaentra" });
    expect(c.ncm).toBe("00000000"); expect(c).not.toHaveProperty("observacoes"); expect(c).not.toHaveProperty("token");
  });
  it.each(["", "12345671", "00000000"])("conserva leitura histórica/proposta de GTIN %s e bloqueia nova aprovação", ean => {
    const m = rascunhoRegraSintetica(); if (m.conteudo.tipo !== "ITEM") throw new Error("Massa inválida");
    const antes = structuredClone(m), c = { ...m.conteudo.perfil.classificacoes, ean };
    const historica = validarRascunhoRegraFiscalBrasilNfe({ ...m, conteudo: { tipo: "ITEM", perfil: { ...m.conteudo.perfil, classificacoes: c } } });
    expect(historica.conteudo).toMatchObject({ perfil: { classificacoes: { ean } } });
    expect(classificacoesCompletasRegraBrasilNfe(c)).toBe(false); expect(m).toEqual(antes);
    expect(classificacoesCompletasRegraBrasilNfe({ ...c, ean: "SEM GTIN" })).toBe(true);
    expect(classificacoesCompletasRegraBrasilNfe({ ...c, ean: "12345670" })).toBe(true);
  });
  it.each(["cestAplicavel", "ipiAplicavel", "stAplicavel", "fcpAplicavel", "difalAplicavel", "ibsCbsAplicavel", "beneficioFiscalAplicavel"])("não presume não aplicabilidade de %s", campo => {
    const d = rascunhoRegraSintetica(); if (d.conteudo.tipo !== "ITEM") throw new Error("Massa inválida");
    const perfil: Record<string, unknown> = { ...d.conteudo.perfil }; delete perfil[campo];
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...d, conteudo: { tipo: "ITEM", perfil } })).toThrow("inválida");
  });
  it("matriz fiscal e bases explícitas conservam decimais, não inferem base/preço", () => {
    const d = rascunhoRegraSintetica(); if (d.conteudo.tipo !== "ITEM") throw new Error("Massa inválida");
    d.conteudo.perfil.icms = { tratamento: "TRIBUTADO", AliquotaICMS: "18.1234", modalidadeBcIcms: 3 };
    d.conteudo.perfil.pis = { tratamento: "TRIBUTADO", Aliquota: "1.6500" };
    const vinculo = { itemId: "item-ficticio", produtoId: "produto-ficticio", versaoCadastro: 1, referenciaConfirp: "DECISAO-SOMENTE-TESTE" };
    expect(() => materializarItemRegraBrasilNfe(d.conteudo.tipo === "ITEM" ? d.conteudo.perfil : undefined as never, vinculo, { itemId: vinculo.itemId })).toThrow("inválida");
    const item = materializarItemRegraBrasilNfe(d.conteudo.perfil, vinculo, { itemId: vinculo.itemId, icms: "1234567890.12", pis: "1.01" });
    expect(item.icms).toMatchObject({ BaseCalculo: "1234567890.12", AliquotaICMS: "18.1234" }); expect(item.pis).toMatchObject({ BaseCalculo: "1.01", Aliquota: "1.6500" });
    expect(item).not.toHaveProperty("classificacoes");
  });
  it("DAS é escolha explícita do perfil, sem parâmetros, bases ou alteração da versão anterior", () => {
    const anterior = rascunhoRegraSintetica(), fotografia = JSON.stringify(anterior), hashAnterior = hashRegraFiscalBrasilNfe(anterior.conteudo);
    const d = structuredClone(anterior); if (d.conteudo.tipo !== "ITEM") throw new Error("Massa inválida");
    d.conteudo.perfil.pis = { tratamento: "RECOLHIDO_DAS" }; d.conteudo.perfil.cofins = { tratamento: "RECOLHIDO_DAS" };
    Object.assign(d.conteudo.perfil.classificacoes, { pis: "49", cofins: "99" });
    const validada = validarRascunhoRegraFiscalBrasilNfe(d); expect(validada.conteudo).toEqual(d.conteudo);
    expect(hashRegraFiscalBrasilNfe(validada.conteudo)).not.toBe(hashAnterior);
    const vinculo = { itemId: "item-ficticio", produtoId: "produto-ficticio", versaoCadastro: 1, referenciaFundamentacao: "versao-interna-exclusivamente-ficticia" };
    const materializada = materializarItemRegraBrasilNfe(d.conteudo.perfil, vinculo, { itemId: vinculo.itemId });
    expect(materializada.pis).toEqual({ tratamento: "RECOLHIDO_DAS" }); expect(materializada.cofins).toEqual({ tratamento: "RECOLHIDO_DAS" });
    for (const campo of ["pis", "cofins"] as const) {
      expect(() => materializarItemRegraBrasilNfe(d.conteudo.tipo === "ITEM" ? d.conteudo.perfil : undefined as never, vinculo, { itemId: vinculo.itemId, [campo]: "0.00" })).toThrow("inválida");
      expect(() => materializarItemRegraBrasilNfe(d.conteudo.tipo === "ITEM" ? d.conteudo.perfil : undefined as never, vinculo, { itemId: vinculo.itemId, [campo]: undefined })).toThrow("inválida");
      const perfil = structuredClone(d.conteudo.perfil); Object.assign(perfil[campo], { Aliquota: "0" });
      expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...d, conteudo: { tipo: "ITEM", perfil } })).toThrow("inválida");
      const aliquotaVazia = structuredClone(d.conteudo.perfil); Object.assign(aliquotaVazia[campo], { Aliquota: undefined });
      expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...d, conteudo: { tipo: "ITEM", perfil: aliquotaVazia } })).toThrow("inválida");
      const baseExtra = structuredClone(d.conteudo.perfil); Object.assign(baseExtra[campo], { BaseCalculo: "0" });
      expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...d, conteudo: { tipo: "ITEM", perfil: baseExtra } })).toThrow("inválida");
    }
    expect(JSON.stringify(anterior)).toBe(fotografia); expect(hashRegraFiscalBrasilNfe(anterior.conteudo)).toBe(hashAnterior);
  });
  it("perfil completo gera parâmetros 55/65 utilizáveis sem permitir transmissão", () => {
    const fetch = vi.spyOn(globalThis, "fetch"), m = massaPayloadLocal(), d = rascunhoRegraSintetica(); if (d.conteudo.tipo !== "ITEM") throw new Error("Massa inválida");
    try {
      m.parametros.itens = [materializarItemRegraBrasilNfe(d.conteudo.perfil, m.parametros.itens[0], { itemId: m.parametros.itens[0].itemId })];
      for (const modelo of [55, 65] as const) { const r = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros); expect(r.montagemConcluida).toBe(true); expect(r.transmissaoPermitida).toBe(false); }
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("não admite seleções duplicadas, extras ou bases de outro item", () => {
    const entrada = { documentoId: "documento-ficticio", modelo: 55, empresaVersaoId: "empresa", operacaoVersaoId: "operacao", itens: [{ itemId: "item-ficticio", versaoId: "versao" }], complementos: { bases: [{ itemId: "item-ficticio" }], cartoes: [] } };
    expect(validarSelecaoRegrasDocumentoBrasilNfe(entrada)).toEqual(entrada);
    expect(() => validarSelecaoRegrasDocumentoBrasilNfe({ ...entrada, itens: [...entrada.itens, ...entrada.itens] })).toThrow("inválida");
    expect(() => validarSelecaoRegrasDocumentoBrasilNfe({ ...entrada, complementos: { ...entrada.complementos, bases: [{ itemId: "outro-item" }] } })).toThrow("inválida");
    expect(() => validarSelecaoRegrasDocumentoBrasilNfe({ ...entrada, complementos: { ...entrada.complementos, CSC: "refletido" } })).toThrow("inválida");
  });
});
