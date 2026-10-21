import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { prepararPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { validarSnapshotBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
vi.mock("server-only", () => ({}));
import { descricaoProdutoNfe, PADRAO_DESCRICAO_PRODUTO_NFE, motivoValidacaoXmlNfe } from "@/lib/fiscal-saida/brasilnfe/texto-xml";
import { rejeicaoFiscalCorrigivel } from "@/lib/fiscal-saida/rejeicao";
import { interpretarConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { interpretarRecuperacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/resposta-fiscal";
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { identidadeFicticia, notaFicticia, respostaFicticia } from "./brasilnfe-fixtures";

const descricaoErro = "Validação XML: The 'http://www.portalfiscal.inf.br/nfe:xProd' element is invalid. The Pattern constraint failed. DADO-PRIVADO-SINTETICO";
const rejeitada = () => ({ ...respostaFicticia(), status: 1, Nota: { ...notaFicticia(), Status: 3, Emitida: false, CodStatusResposta: 0, NumeroProtocolo: null, motivoValidacaoXml: "DESCRICAO_PRODUTO" as const } });

describe("XML fiscal e nova revisão após rejeição comprovada", () => {
  it.each([
    ["Queijo — porção", "Queijo - porção"], ["  Cafe\u0301\n\tcom leite  ", "Café com leite"],
    ["Pão “artesanal” – 100 g…", 'Pão "artesanal" - 100 g...'], ["x", "x"],
  ])("normaliza só a descrição fiscal: %s", (entrada, esperado) => {
    const resultado = descricaoProdutoNfe(entrada);
    expect(resultado).toBe(esperado); expect(resultado).toMatch(PADRAO_DESCRICAO_PRODUTO_NFE);
  });
  it("limita xProd após normalizar e não disfarça símbolos sem equivalência", () => {
    expect(descricaoProdutoNfe("a".repeat(130))).toHaveLength(120);
    expect(descricaoProdutoNfe("Queijo 🧀")).not.toMatch(PADRAO_DESCRICAO_PRODUTO_NFE);
    expect("").not.toMatch(PADRAO_DESCRICAO_PRODUTO_NFE);
    expect(" produto ").not.toMatch(PADRAO_DESCRICAO_PRODUTO_NFE);
  });
  it("montador usa descrição compatível sem alterar a fotografia comercial", () => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].produto.nome = "Pão — ação";
    m.documento.hashPayload = createHash("sha256").update(JSON.stringify(m.documento.payload)).digest("hex");
    m.parametros.vinculo.hashPayload = m.documento.hashPayload;
    const antes = JSON.stringify(m.documento);
    const r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    expect(r.montagemConcluida).toBe(true); expect(r.payload!.Produtos[0].NmProduto).toBe("Pão - ação");
    expect(JSON.stringify(m.documento)).toBe(antes);
    const snapshot = { schema: "grazing.fiscal-saida", versao: 2, valores: m.documento.payload.valores,
      tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, crt: 1, documento: {
        ...r.payload!, Produtos: [{ ...r.payload!.Produtos[0], NmProduto: "Pão — ação" }],
      } } };
    expect(() => validarSnapshotBrasilNfe(snapshot, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).toThrow(/Produto 1.*xProd/);
  });
  it("transmite somente a categoria local do motivo, sem texto externo", async () => {
    const wire = rejeitada(); Object.assign(wire.Nota, { DsStatusResposta: descricaoErro });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(wire), { headers: { "content-type": "application/json" } }));
    const r = await new ClienteBrasilNfe({ token: "token-exclusivo-sintetico-xml" }, { fetch }).consultarNotaFiscal({ documentoId: identidadeFicticia.documentoId, modelo: 55, ambiente: "HOMOLOGACAO" });
    expect(r.Nota?.motivoValidacaoXml).toBe("DESCRICAO_PRODUTO");
    expect(JSON.stringify(r)).not.toContain("DADO-PRIVADO");
    expect(motivoValidacaoXmlNfe("xProd autorizado")).toBeUndefined();
  });
  it("reconhece rejeição XML única, mesmo com chave gerada, sem autorizar reenvio", () => {
    const r = interpretarRecuperacaoFiscalBrasilNfe(interpretarConsultaBrasilNfe(rejeitada(), identidadeFicticia), identidadeFicticia);
    expect(r.status).toBe("REJEITADO"); expect(r.chave).toBe(notaFicticia().Chave);
    expect(r.protocolo).toBeUndefined(); expect(r.erro).toContain("xProd");
    expect(r.erro).not.toContain("DADO-PRIVADO");
    expect(rejeicaoFiscalCorrigivel({ status: r.status, protocolo: r.protocolo, chaveFiscal: r.chave } as never)).toBe(true);
  });
  it.each([204, 539, 999])("mantém código %s não conclusivo em conferência", codigo => {
    const wire = rejeitada(); wire.Nota.CodStatusResposta = codigo;
    expect(interpretarRecuperacaoFiscalBrasilNfe(interpretarConsultaBrasilNfe(wire, identidadeFicticia), identidadeFicticia).status).toBe("PENDENTE_CONFERENCIA");
  });
  it("código interno zero sozinho não comprova rejeição XML", () => {
    const wire = { ...rejeitada(), Nota: { ...rejeitada().Nota, motivoValidacaoXml: undefined } };
    expect(interpretarRecuperacaoFiscalBrasilNfe(interpretarConsultaBrasilNfe(wire, identidadeFicticia), identidadeFicticia).status).toBe("PENDENTE_CONFERENCIA");
  });
  it("não ignora autorização anterior nem histórico ambíguo", () => {
    const wire = rejeitada(); wire.Historico = [notaFicticia()];
    expect(interpretarRecuperacaoFiscalBrasilNfe(interpretarConsultaBrasilNfe(wire, identidadeFicticia), identidadeFicticia).status).toBe("AUTORIZADO");
    wire.Historico = [wire.Nota];
    expect(interpretarRecuperacaoFiscalBrasilNfe(interpretarConsultaBrasilNfe(wire, identidadeFicticia), identidadeFicticia).status).toBe("PENDENTE_CONFERENCIA");
  });
  it.each(["PENDENTE_CONFERENCIA", "INCERTO", "PROCESSANDO", "AUTORIZADO", "DENEGADO", "CANCELADO"])("não libera nova preparação por estado %s", status => {
    expect(rejeicaoFiscalCorrigivel({ status })).toBe(false);
  });
  it("rejeição com protocolo ou cancelamento continua bloqueada", () => {
    expect(rejeicaoFiscalCorrigivel({ status: "REJEITADO", protocolo: "123" })).toBe(false);
    expect(rejeicaoFiscalCorrigivel({ status: "REJEITADO", cancelamentoPendente: true })).toBe(false);
  });
});
