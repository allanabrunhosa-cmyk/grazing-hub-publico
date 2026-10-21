import { describe, expect, it } from "vitest";
import { hashDeclaracaoFci } from "@/lib/tributacao/declaracao-fci";
import { hashRevisaoConsolidadaGrazing1, selecionarVersoesRevisaoConsolidada } from "@/lib/tributacao/revisao-consolidada";
import type { VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { classificacaoFicticia } from "./declaracao-fci-fixtures";
function versao(extra: Partial<VersaoFiscalDto> = {}): VersaoFiscalDto { const dados = classificacaoFicticia(); return { id: "proposta-ficticia", tipo: "CLASSIFICACAO", chave: dados.produtoId!, versao: 4, vigenciaInicio: "2026-10-15", status: "RASCUNHO", dados, hash: hashDeclaracaoFci(dados), justificativa: "Proposta exclusivamente sintética", fontes: ["FONTE-SINTETICA"], criadoPorNome: "Pessoa sintética", createdAt: "2026-10-15T12:00:00Z", ...extra }; }
describe("Revisão consolidada efêmera, sem ativação ou aprovação implícita", () => {
  it.each(["HOMOLOGACAO", "PRODUCAO"] as const)("projeta proposta para revisão %s preservando original e pendências", ambiente => {
    const v = versao(), antes = structuredClone(v), r = selecionarVersoesRevisaoConsolidada([v], [{ id: v.id, hash: v.hash }], "2026-10-15", ambiente);
    expect(r.versoes[0].status).toBe("ATIVO"); expect(v).toEqual(antes);
    expect(r.revisao).toMatchObject({ tipo: "PROPOSTAS_PARA_REVISAO", ambiente, aprovacaoInterna: false, versoes: [{ id: v.id, hash: v.hash, statusOriginal: "RASCUNHO" }] });
    expect(r.versoes[0].dados).toMatchObject({ estado: "PENDENTE", pendencias: classificacaoFicticia().pendencias });
  });
  it("não reutiliza uma classificação antiga do mesmo produto no cálculo de revisão", () => {
    const v = versao(), antiga = versao({ id: "anterior", versao: 3, status: "ATIVO" });
    const r = selecionarVersoesRevisaoConsolidada([antiga, v], [{ id: v.id, hash: v.hash }], "2026-10-15", "HOMOLOGACAO"); expect(r.versoes.map(v => v.id)).toEqual([v.id]);
  });
  it.each(["hash", "futura", "mais-recente", "duplicada", "perfil"])("recusa seleção incompatível: %s", caso => {
    const v = versao(), vs = [v]; let ids = [{ id: v.id, hash: v.hash }];
    if (caso === "hash") ids[0].hash = "a".repeat(64);
    if (caso === "futura") v.vigenciaInicio = "2027-01-01";
    if (caso === "mais-recente") vs.push(versao({ id: "mais-recente", versao: 5 }));
    if (caso === "duplicada") ids = [...ids, ...ids];
    if (caso === "perfil") v.tipo = "PERFIL";
    expect(() => selecionarVersoesRevisaoConsolidada(vs, ids, "2026-10-15", "HOMOLOGACAO")).toThrow("revisão consolidada");
  });
  it("hash da aprovação é estável por ordem e altera com qualquer versão/conteúdo", () => {
    const a = { id: "classificacao", hash: "a".repeat(64) }, b = { id: "regra", hash: "b".repeat(64) };
    expect(hashRevisaoConsolidadaGrazing1([a, b])).toBe(hashRevisaoConsolidadaGrazing1([b, a])); expect(hashRevisaoConsolidadaGrazing1([a, b])).not.toBe(hashRevisaoConsolidadaGrazing1([a, { ...b, hash: "c".repeat(64) }]));
    expect(() => hashRevisaoConsolidadaGrazing1([])).toThrow();
  });
});
