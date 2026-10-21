import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { prepararPayloadLocalBrasilNfe, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";

describe("Montagem referenciada à fundamentação fiscal — apenas local", () => {
  it.each([55, 65] as const)("monta modelo %s sem referência Confirp e não transmite", modelo => {
    const m = massaPayloadLocal(), foto = JSON.stringify(m.documento), rede = vi.spyOn(globalThis, "fetch");
    delete m.parametros.referenciaConfirp; m.parametros.referenciaFundamentacao = "versao-operacao-aprovada";
    for (const item of m.parametros.itens) { delete item.referenciaConfirp; item.referenciaFundamentacao = "versao-produto-aprovada"; }
    try {
      const r = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros);
      expect(r.montagemConcluida).toBe(true); expect(r.pendencias).toEqual([]); expect(r.transmissaoPermitida).toBe(false);
      expect(r.payload!.Produtos[0].NCM).toBe(m.documento.payload.itens[0].fiscal.produto.ncm);
      expect(serializarPayloadLocalBrasilNfe(r)).not.toMatch(/referenciaFundamentacao|referenciaConfirp/);
      expect(JSON.stringify(m.documento)).toBe(foto); expect(rede).not.toHaveBeenCalled();
    } finally { rede.mockRestore(); }
  });
  it("ausência de referência indica pendência interna por campo e item", () => {
    const m = massaPayloadLocal(); delete m.parametros.referenciaConfirp; delete m.parametros.itens[0].referenciaConfirp;
    const r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    expect(r.montagemConcluida).toBe(false); expect(r.payload).toBeNull();
    expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "parametros.referenciaFundamentacao", responsavel: "REVISAO_FISCAL" }));
    expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].referenciaFundamentacao", produtoId: "produto-ficticio" }));
  });
  it("referência interna inválida não usa a referência antiga para converter falha em sucesso", () => {
    const m = massaPayloadLocal(); m.parametros.referenciaFundamentacao = "<script>";
    const r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    expect(r.montagemConcluida).toBe(false); expect(r.pendencias.some(p => p.campo === "parametros.referenciaFundamentacao" && p.codigo === "FORMATO")).toBe(true);
  });
  it("complemento legado permanece legível sem criar aprovação interna ou liberar emissão", () => {
    const m = massaPayloadLocal(), r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    expect(m.parametros.referenciaConfirp).toBeTruthy(); expect(r.montagemConcluida).toBe(true); expect(r.transmissaoPermitida).toBe(false);
    expect(r).not.toHaveProperty("aprovacaoInterna");
  });
});
