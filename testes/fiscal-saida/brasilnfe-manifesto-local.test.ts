import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { prepararPayloadLocalBrasilNfe, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
const sim = vi.hoisted(() => ({ ler: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/fiscal-saida/brasilnfe/regras-tributarias", () => ({ obterComplementosAprovadosDocumentoBrasilNfe: sim.ler }));
import { obterManifestoLocalNfe55BrasilNfe } from "@/lib/fiscal-saida/brasilnfe/manifesto-local";
const sessao = { userId: "operador-ficticio" } as SessaoAtual;
function plano(modelo: 55 | 65 = 55) {
  const m = massaPayloadLocal();
  delete m.parametros.referenciaConfirp; m.parametros.referenciaFundamentacao = "versao-ficticia-1";
  delete m.parametros.itens[0].referenciaConfirp; m.parametros.itens[0].referenciaFundamentacao = "versao-ficticia-2";
  return { planoId: "plano-ficticio", modelo, parametros: m.parametros,
    resultado: prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros),
    transmissaoPermitida: false,
    evidencia: { primeiraEmissaoPendente: true, revisaoPedido: 1, emitenteHash: "a".repeat(64), parametrosHash: "b".repeat(64), vinculadoEm: "2026-10-01T12:00:00.000Z", conferidoEm: "2026-10-12T12:00:00.000Z", versoes: ["EMPRESA", "OPERACAO", "ITEM:item-ficticio"].map((papel, i) => ({ papel, alvo: i === 0 ? "EMPRESA" : i === 1 ? "OPERACAO" : "PRODUTO", regraId: `regra-ficticia-${i}`, versaoId: `versao-ficticia-${i}`, revisao: 2, conteudoHash: "c".repeat(64), fundamentacaoHash: "d".repeat(64), aprovacaoHash: "e".repeat(64), vigenteDesde: "2026-10-01", vigenteAte: null })) },
  };
}
describe("Manifesto local NF-e55 — exclusivamente sintético", () => {
  beforeEach(() => { sim.ler.mockReset(); });
  it("reutiliza leitura autorizada e entrega identidade, precisão e provas sem dados do payload nem HTTP", async () => {
    const p = plano(), antes = JSON.stringify(p), fetch = vi.spyOn(globalThis, "fetch"); sim.ler.mockResolvedValue(p);
    try {
      const r = await obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao);
      expect(sim.ler).toHaveBeenCalledWith("documento-ficticio", sessao);
      expect(r.estado).toBe("PREPARADO_LOCALMENTE"); expect(r.transmissaoPermitida).toBe(false);
      expect(r.manifesto).toMatchObject({ modelo: 55, ambiente: 2, total: "24.53", revisaoPedido: 1, quantidadeItens: 1, autorizacaoPrimeiraTransmissao: "PENDENTE", servicoCertificadoRecuperacao: "CONFERENCIA_SEPARADA", hashPayloadFiscal: createHash("sha256").update(serializarPayloadLocalBrasilNfe(p.resultado)).digest("hex") });
      expect(r.manifesto?.versoes).toEqual(p.evidencia.versoes);
      const texto = JSON.stringify(r);
      for (const privado of ["Empresa fictícia", "Pessoa fictícia", "Rua de teste", "00000000000", "Produtos", "Pagamentos", 'parametros"', 'payload"']) expect(texto).not.toContain(privado);
      expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(p)).toBe(antes);
    } finally { fetch.mockRestore(); }
  });
  it("plano ausente permanece pendência, sem fabricar ID, hash, total ou aprovação", async () => {
    sim.ler.mockResolvedValue(null);
    const r = await obterManifestoLocalNfe55BrasilNfe("sem-plano", sessao);
    expect(r).toMatchObject({ estado: "PENDENTE", transmissaoPermitida: false, pendencias: [{ campo: "planoId" }] }); expect(r).not.toHaveProperty("manifesto");
  });
  it("não reutiliza este manifesto para modelo65", async () => {
    sim.ler.mockResolvedValue(plano(65)); await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("modelo 55");
  });
  it("fotografia alterada ou tentativa anterior exige conferência e nunca autoriza reenvio", async () => {
    const p = plano(); p.evidencia.primeiraEmissaoPendente = false; sim.ler.mockResolvedValue(p);
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("Não preparar primeira emissão");
  });
  it.each(["EMPRESA", "OPERACAO", "ITEM:item-ficticio"])("não entrega manifesto sem prova de %s", async papel => {
    const p = plano(); p.evidencia.versoes = p.evidencia.versoes.filter(v => v.papel !== papel); sim.ler.mockResolvedValue(p);
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("provas");
  });
  it("propaga bloqueio de permissão/identidade sem convertê-lo em confirmação", async () => {
    sim.ler.mockRejectedValue(new Error("Acesso fictício revogado"));
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("revogado");
  });
  it("quantidade de provas igual não aceita item de outra identidade nem papel duplicado", async () => {
    const outro = plano(); outro.evidencia.versoes[2].papel = "ITEM:outro-ficticio"; sim.ler.mockResolvedValue(outro);
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("provas");
    const duplicado = plano(); duplicado.evidencia.versoes[2].papel = "EMPRESA"; sim.ler.mockResolvedValue(duplicado);
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("provas");
  });
  it("montagem incompleta preserva campo e produto pendentes sem produzir manifesto", async () => {
    const p = plano(), m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.ncm = "";
    p.resultado = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros); sim.ler.mockResolvedValue(p);
    const r = await obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao);
    expect(r).not.toHaveProperty("manifesto"); expect(r.estado).toBe("PENDENTE"); expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].NCM", produtoId: "produto-ficticio" }));
  });
  it.each(["OPERACAO", "ITEM"])("papel e hash existentes não substituem vínculo efetivo de %s", async papel => {
    const p = plano();
    if (papel === "OPERACAO") p.parametros.referenciaFundamentacao = "outra-versao-ficticia";
    else p.parametros.itens[0].referenciaFundamentacao = "outra-versao-ficticia";
    sim.ler.mockResolvedValue(p);
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("provas");
  });
  it.each([0, 1, 2])("papel não troca o alvo aprovado da prova índice%s", async indice => {
    const p = plano(); p.evidencia.versoes[indice].alvo = indice === 2 ? "EMPRESA" : "PRODUTO"; sim.ler.mockResolvedValue(p);
    await expect(obterManifestoLocalNfe55BrasilNfe("documento-ficticio", sessao)).rejects.toThrow("provas");
  });
});
