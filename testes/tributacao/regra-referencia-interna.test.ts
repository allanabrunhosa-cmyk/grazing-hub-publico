import { describe, expect, it } from "vitest";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import type { RegraFiscal } from "@/lib/tributacao/tipos";

function regra(produtoId: string | null): RegraFiscal {
  const tributo = (cst: string) => ({ cst, aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Parâmetro exclusivamente sintético" });
  return { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF05", produtoId, natureza: "FRACIONADO", ncm: "16010000", cfop: "5102", csosn: "102", icms: tributo("00"), pis: tributo("99"), cofins: tributo("99"), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL" };
}

describe("alvo restrito de regra para referência fiscal interna", () => {
  it.each(["INSUMO:referencia-sintetica_1", `INSUMO:${"a".repeat(100)}`, "produto-sintetico", null])("preserva o alvo válido %s sem ampliar o alcance", alvo => {
    expect(validarDadosFiscais("REGRA", regra(alvo))).toEqual(regra(alvo));
  });

  it.each(["INSUMO:", `INSUMO:${"a".repeat(101)}`, "INSUMO:um:dois", "INSUMO:../outro", "INSUMO:com espaço", "insumo:referencia", "OUTRO:referencia", "INSUMO:*", "INSUMO:abc\nxyz", "INSUMO:abc/xyz"])("recusa alias malformado %s", alvo => {
    expect(() => validarDadosFiscais("REGRA", regra(alvo))).toThrow(/inválido/);
  });

  it("mantém o prefixo proibido nos outros identificadores do domínio", () => {
    expect(() => validarDadosFiscais("REGRA", { ...regra(null), estabelecimento: "INSUMO:referencia" })).toThrow(/Estabelecimento/);
    expect(() => validarDadosFiscais("CLASSIFICACAO", { produtoId: "INSUMO:referencia" })).toThrow(/Produto/);
    expect(() => validarDadosFiscais("CLASSIFICACAO", { produtoId: null, referenciaInternaInsumoId: "INSUMO:referencia" })).toThrow(/Referência interna/);
    expect(() => validarDadosFiscais("COMPLEMENTO", { opcaoId: "opcao", comportamento: "MERCADORIA", produtoId: "INSUMO:referencia", justificativa: "Massa sintética" })).toThrow(/Produto fiscal/);
  });
});
