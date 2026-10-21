import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { conferirFciFiscal, validarDecisaoFciFiscal } from "@/lib/tributacao/fci";
import { validarRepasseFciFornecedor } from "@/lib/tributacao/fci-fornecedor-contrato";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "../fiscal-saida/brasilnfe-payload-local-fixtures";
import { contextoRepasse, fciRepasseFicticia } from "./fci-fornecedor-fixtures";

describe("repasse FCI conferido, separado da apuração própria", () => {
  it.each(["55", "65"] as const)("permite modelo%s com prova selada, sem inventar CI", modelo => {
    const f = fciRepasseFicticia();
    expect(validarDecisaoFciFiscal(f)).toEqual(f);
    expect(conferirFciFiscal("5", f, { ...contextoRepasse, modelo })).toEqual({ numero: f.numero, pendencias: [] });
    expect(f.apuracaoCompleta).toBe(false); expect(f.conteudoImportacao).toBeNull();
  });
  it.each([
    { natureza: "PREPARADO" as const }, { ncm: "16010000" }, { materiaisHash: "e".repeat(64) }, { classificacaoVersaoId: undefined }, { classificacaoVersaoNumero: 0 }, { classificacaoVersaoNumero: -1 }, { classificacaoVersaoNumero: 0.5 }, { data: "2026-09-30" }, { data: "2026-02-30" },
  ])("prova fora do contexto não libera emissão: %j", extra => {
    const r = conferirFciFiscal("5", fciRepasseFicticia(), { ...contextoRepasse, ...extra });
    expect(r.numero).toBeNull(); expect(r.pendencias).toHaveLength(1);
  });
  it("origem divergente ou pedido sem selo permanece bloqueado", () => {
    const f = fciRepasseFicticia();
    expect(conferirFciFiscal("3", f, contextoRepasse).numero).toBeNull();
    delete f.repasseFornecedor!.registro;
    expect(validarDecisaoFciFiscal(f).repasseFornecedor).toEqual({ insumoId: "insumo-ficticio" });
    expect(conferirFciFiscal("5", f, contextoRepasse).numero).toBeNull();
  });
  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "2026-10-00"])("recusa data impossível na prova: %s", dataEmissao => {
    const f = fciRepasseFicticia().repasseFornecedor!; f.registro!.documentos[0].dataEmissao = dataEmissao;
    expect(() => validarRepasseFciFornecedor(f)).toThrow();
  });
  it("recusa campos extras e duplicidade de prova", () => {
    const f = fciRepasseFicticia().repasseFornecedor!;
    expect(() => validarRepasseFciFornecedor({ ...f, segredo: "ficticio" })).toThrow();
    f.registro!.documentos.push({ ...f.registro!.documentos[0] });
    expect(() => validarRepasseFciFornecedor(f)).toThrow();
  });
  it.each([55, 65] as const)("snapshot%s transmite apenas nFCI e recusa NCM adulterado no documento", modelo => {
    const m = massaPayloadLocal(), base = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros);
    const payload = structuredClone(base.payload!), fci = fciRepasseFicticia();
    payload.Produtos[0].OrigemProduto = 5; payload.Produtos[0].nFCI = fci.numero!;
    fci.repasseFornecedor!.registro!.ncm = payload.Produtos[0].NCM;
    const foto = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, emitenteUf: "SP", crt: 1, documento: payload, previa: { contexto: { data: contextoRepasse.data, ufDestino: "SP" }, linhas: [{ produtoId: payload.Produtos[0].CodProdutoServico, fci, classificacaoVersao: { id: contextoRepasse.classificacaoVersaoId, versao: 1, materiaisHash: contextoRepasse.materiaisHash, natureza: "FRACIONADO", ncm: payload.Produtos[0].NCM } }] } } } };
    const r = prepararPayloadSnapshotBrasilNfeLocal(foto, modelo, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" });
    const wire = serializarPayloadLocalBrasilNfe(r);
    expect(JSON.parse(wire).Produtos[0].nFCI).toBe(fci.numero); expect(wire).not.toMatch(/repasseFornecedor|xmlHash|insumo-ficticio|apuracaoCompleta/);
    foto.payload.tributacao.documento.Produtos[0].NCM = payload.Produtos[0].NCM === "16010000" ? "19059090" : "16010000";
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(foto, modelo, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).toThrow("FCI");
  });
});
