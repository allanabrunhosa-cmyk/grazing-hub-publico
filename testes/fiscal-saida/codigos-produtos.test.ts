import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { codigoFiscalCorrespondeProduto, fotografarCodigosProdutosFiscais, referenciasCodigosProdutosFiscaisValidas } from "@/lib/fiscal-saida/codigos-produtos";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";

const linha = { id: "item-interno-exclusivamente-sintetico", produtoId: "4d98a4bf-91d8-4431-8c31-750a6a9dca83", nome: "Produto exclusivamente sintético" };
function fotografia() {
  return { codigosProdutos: [{ linhaId: linha.id, produtoId: linha.produtoId, codigo: "P0100001" }],
    documento: { Produtos: [{ CodProdutoServico: "P0100001" }] }, previa: { linhas: [{ ...linha }] } };
}

describe("Código comercial no snapshot fiscal", () => {
  it("fotografa código curto, mantém os IDs e admite o mesmo produto em mais de uma linha", () => {
    const linhas = [linha, { ...linha, id: "segundo-item-sintetico" }], antes = JSON.stringify(linhas);
    const r = fotografarCodigosProdutosFiscais(linhas, [{ id: linha.produtoId, codigo: "P0100001" }]);
    expect(r.pendencias).toEqual([]); expect(r.codigosProdutos).toEqual(linhas.map(l => ({ linhaId: l.id, produtoId: l.produtoId, codigo: "P0100001" })));
    expect(JSON.stringify(linhas)).toBe(antes);
  });
  it.each([null, undefined, "", "123456789", "SKU-CURTO", "abc123", linha.produtoId])("código ausente/incompatível %s cria pendência identificada, sem usar UUID", codigo => {
    const r = fotografarCodigosProdutosFiscais([linha], [{ id: linha.produtoId, codigo }]);
    expect(r.codigosProdutos[0].codigo).toBe(""); expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toContain(linha.nome); expect(r.pendencias[0]).not.toContain(linha.produtoId);
  });
  it("preserva a referência interna do KIT, sem alterar insumos ou exigir SKUs dos ingredientes de um produto acabado", () => {
    const produto = fotografarCodigosProdutosFiscais([linha], [{ id: linha.produtoId, codigo: "P0100001" }]);
    expect(produto.pendencias).toEqual([]);
    const componente = { ...linha, produtoId: "INSUMO:ingrediente" };
    const r = fotografarCodigosProdutosFiscais([componente], []);
    expect(r.pendencias).toEqual([]); expect(r.codigosProdutos[0]).toMatchObject({ produtoId: "INSUMO:ingrediente", codigo: "INSUMO:ingrediente" });
    const t = { codigosProdutos: r.codigosProdutos, documento: { Produtos: [{ CodProdutoServico: "INSUMO:ingrediente" }] }, previa: { linhas: [componente] } };
    expect(referenciasCodigosProdutosFiscaisValidas(t)).toBe(true);
    t.documento.Produtos[0].CodProdutoServico = "OUTRO";
    expect(referenciasCodigosProdutosFiscaisValidas(t)).toBe(false);
  });
  it("não confunde códigos iguais de cadastros distintos", () => {
    const r = fotografarCodigosProdutosFiscais([linha, { ...linha, id: "outra-linha", produtoId: "outro-produto" }], [{ id: linha.produtoId, codigo: "P0100001" }, { id: "outro-produto", codigo: "P0100001" }]);
    expect(r.pendencias).toHaveLength(1); expect(r.codigosProdutos[1].codigo).toBe("");
  });
  it("a associação curta é explícita e não depende de CodProdutoServico ser igual ao UUID", () => {
    const t = fotografia(); expect(referenciasCodigosProdutosFiscaisValidas(t)).toBe(true);
    expect(codigoFiscalCorrespondeProduto(t, 0, linha.produtoId)).toBe(true);
    expect(codigoFiscalCorrespondeProduto(t, 0, "P0100001")).toBe(false);
  });
  it.each(["codigo", "produtoId", "linhaId", "quantidade", "tipo", "linhaCalculada"])("recusa vínculo adulterado em %s", campo => {
    const t = fotografia();
    if (campo === "codigo") t.codigosProdutos[0].codigo = "P0100002";
    if (campo === "produtoId") t.codigosProdutos[0].produtoId = "outro-produto";
    if (campo === "linhaId") t.codigosProdutos[0].linhaId = "outro-item";
    if (campo === "quantidade") t.codigosProdutos.push({ ...t.codigosProdutos[0] });
    if (campo === "tipo") (t as unknown as Record<string, unknown>).codigosProdutos = null;
    if (campo === "linhaCalculada") t.previa.linhas[0].produtoId = "outro-produto";
    expect(referenciasCodigosProdutosFiscaisValidas(t)).toBe(false);
  });
  it("documento legado mantém sua associação e conteúdo original", () => {
    const antigo = { documento: { Produtos: [{ CodProdutoServico: linha.produtoId }] } }, antes = JSON.stringify(antigo);
    expect(referenciasCodigosProdutosFiscaisValidas(antigo)).toBe(true);
    expect(codigoFiscalCorrespondeProduto(antigo, 0, linha.produtoId)).toBe(true); expect(JSON.stringify(antigo)).toBe(antes);
  });
  it.each([55, 65] as const)("adaptador modelo%s envia o código e exclui o vínculo interno do contrato externo", modelo => {
    const m = massaPayloadLocal(), payload = structuredClone(prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros).payload!);
    payload.Produtos[0].CodProdutoServico = "P0100001";
    const t = { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, crt: 1, codigosProdutos: fotografia().codigosProdutos,
      documento: payload, previa: { contexto: { data: "2026-10-15" }, linhas: [{ ...linha }] } };
    const d = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: t } };
    const antes = JSON.stringify(d), r = prepararPayloadSnapshotBrasilNfeLocal(d, modelo, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" });
    const wire = JSON.parse(serializarPayloadLocalBrasilNfe(r));
    expect(wire.Produtos[0].CodProdutoServico).toBe("P0100001"); expect(JSON.stringify(wire)).not.toMatch(/codigosProdutos|linhaId|4d98a4bf/);
    expect(JSON.stringify(d)).toBe(antes); expect(r.transmissaoPermitida).toBe(false);
    t.codigosProdutos[0].produtoId = "outro-produto";
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(d, modelo, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).toThrow("Código comercial");
  });
});
