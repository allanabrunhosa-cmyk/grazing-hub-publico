import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
import { chaveFiscalClassificacao, conferirReferenciaInterna, resolverReferenciaInterna, validarComponenteInterno, type ComponenteKitFiscal, type InsumoReferenciaFiscal } from "@/lib/tributacao/referencia-interna";

// Todos os IDs, receitas, fontes e declarações desta fixture são fictícios.
const id = "preparacao_kit_exclusivamente_ficticia";
const insumo: InsumoReferenciaFiscal = { id, nome: "Preparação sintética de estoque", ativo: true, excluidoEm: null, unidade: "KG", tipo: "PRODUTO_INTERMEDIARIO" };
function classificacao(alteracoes: Partial<ClassificacaoFiscal> = {}): ClassificacaoFiscal {
  return { produtoId: null, referenciaInternaInsumoId: id, grupo: "GF02", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", gtin: "SEM GTIN", evidencias: ["Produto final assado em ficha fictícia"], pendencias: [], ncmAplicabilidade: "APLICAVEL", analiseNcm: { fundamento: "DOCUMENTAL", confianca: "MEDIA", descricaoNcm: "Produto de pastelaria — declaração sintética", dataAnalise: "2026-10-11", justificativa: "Processo acabado exclusivamente fictício para testar fronteiras de referência.", fontes: ["Ficha sintética de teste"], pendenciasNcm: [] }, conversaoUnidade: { unidadeEstoque: "KG", quantidadeEstoquePorUnidadeFiscal: "0.022", justificativa: "Cada unidade fiscal corresponde a22g, conforme ficha sintética, sem modificar estoque.", fontes: ["Conversão inteiramente fictícia"] }, ...alteracoes };
}
function componente(alteracoes: Partial<ComponenteKitFiscal> = {}): ComponenteKitFiscal {
  return { referenciaInternaInsumoId: id, descricao: "Produto final assado sintético", unidade: "UN", quantidade: "8", pesoRateio: "2.865116", ...alteracoes };
}

describe("Referência fiscal interna sem criar produto comercial", () => {
  it("separa identidade comercial da interna mesmo quando os IDs textuais coincidem", () => {
    expect(chaveFiscalClassificacao({ produtoId: id })).toBe(id);
    expect(chaveFiscalClassificacao({ produtoId: null, referenciaInternaInsumoId: id })).toBe(`INSUMO:${id}`);
    expect(new Set([chaveFiscalClassificacao({ produtoId: id }), chaveFiscalClassificacao({ produtoId: null, referenciaInternaInsumoId: id })]).size).toBe(2);
  });
  it.each([
    { produtoId: id, referenciaInternaInsumoId: id }, { produtoId: null },
    { produtoId: "" }, { produtoId: null, referenciaInternaInsumoId: "INSUMO:outro" },
    { produtoId: null, referenciaInternaInsumoId: "id com espaço" },
    { produtoId: id, referenciaInternaInsumoId: null },
  ])("recusa identidade ambígua ou inválida %#", c => {
    expect(() => chaveFiscalClassificacao(c as unknown as ClassificacaoFiscal)).toThrow(ErroEstruturaFiscal);
  });
  it("usa descrição e unidade do produto final, preservando preço, quantidade e cadastro", () => {
    const c = classificacao(), k = componente();
    const original = structuredClone({ c, k, insumo });
    expect(resolverReferenciaInterna(c, insumo, k)).toEqual({ codigo: `INSUMO:${id}`, nome: k.descricao, unidade: "UN" });
    expect({ c, k, insumo }).toEqual(original);
    expect(k.quantidade).toBe("8");
    expect(c.conversaoUnidade?.quantidadeEstoquePorUnidadeFiscal).toBe("0.022");
    expect(insumo.unidade).toBe("KG");
  });
  it.each([null, { ...insumo, id: "outro_insumo_ficticio" }, { ...insumo, ativo: false }, { ...insumo, excluidoEm: "2026-10-11T00:00:00.000Z" }, { ...insumo, excluidoEm: undefined }])("recusa referência inexistente/inativa/excluída %#", i => {
    expect(() => resolverReferenciaInterna(classificacao(), i as InsumoReferenciaFiscal | null, componente())).toThrow(ErroEstruturaFiscal);
  });
  it("não infere conversão22g pelo nome quando unidades são diferentes", () => {
    expect(() => resolverReferenciaInterna(classificacao({ conversaoUnidade: undefined }), { ...insumo, nome: "Pão de22g apenas no nome fictício" }, componente())).toThrow(/conversão documentada/);
  });
  it("permite unidade idêntica sem fabricar um fator", () => {
    const c = classificacao({ unidade: "KG", conversaoUnidade: undefined });
    expect(resolverReferenciaInterna(c, insumo, componente({ unidade: "KG", quantidade: "0.12" })).unidade).toBe("KG");
    expect(c.conversaoUnidade).toBeUndefined();
  });
  it("mudança de unidade cadastral invalida a conversão anterior", () => {
    expect(() => resolverReferenciaInterna(classificacao(), { ...insumo, unidade: "L" }, componente())).toThrow(/diverge do cadastro/);
  });
  it.each(["0", "-1", "0.0000000001", "1000000000", "1e-3", "0,022", "Infinity", "NaN", "1.0000000001"])('recusa fator fora da precisão/positivo "%s"', fator => {
    const c = classificacao(); c.conversaoUnidade!.quantidadeEstoquePorUnidadeFiscal = fator;
    expect(() => resolverReferenciaInterna(c, insumo, componente())).toThrow(ErroEstruturaFiscal);
  });
  it("aceita nove casas de conversão sem alterar ou arredondar sua representação", () => {
    const c = classificacao(); c.conversaoUnidade!.quantidadeEstoquePorUnidadeFiscal = "0.000000001";
    expect(resolverReferenciaInterna(c, insumo, componente()).unidade).toBe("UN");
    expect(c.conversaoUnidade!.quantidadeEstoquePorUnidadeFiscal).toBe("0.000000001");
  });
  it.each([{ justificativa: "" }, { fontes: [] }, { fontes: [""] }, { fontes: Array(51).fill("Fonte sintética") }, { fontes: ["x".repeat(2001)] }])("recusa conversão sem evidências limitadas %#", alteracoes => {
    const c = classificacao(); Object.assign(c.conversaoUnidade!, alteracoes);
    expect(() => resolverReferenciaInterna(c, insumo, componente())).toThrow(ErroEstruturaFiscal);
  });
  it.each([{ produtoId: "produto_ficticio" }, { referenciaInternaInsumoId: "outro_insumo" }, { descricao: "" }, { descricao: "x".repeat(121) }, { unidade: "KG" }, { unidade: "PORCOES" }, { escolhas: [] }])("recusa componente que perde identidade, descrição ou unidade %#", alteracoes => {
    expect(() => resolverReferenciaInterna(classificacao(), insumo, componente(alteracoes))).toThrow(ErroEstruturaFiscal);
  });
  it.each(["0", "-1", "1e-3", "0.0000001", "1000000000000", "1,5", "NaN"])('recusa quantidade e rateio não representáveis "%s"', valor => {
    expect(() => validarComponenteInterno(classificacao(), insumo, componente({ quantidade: valor }))).toThrow(ErroEstruturaFiscal);
    expect(() => validarComponenteInterno(classificacao(), insumo, componente({ pesoRateio: valor }))).toThrow(ErroEstruturaFiscal);
  });
  it("não trunca código extenso para inventar SKU emitível", () => {
    const extenso = "x".repeat(54);
    expect(chaveFiscalClassificacao({ produtoId: null, referenciaInternaInsumoId: extenso })).toBe(`INSUMO:${extenso}`);
    expect(() => resolverReferenciaInterna(classificacao({ referenciaInternaInsumoId: extenso }), { ...insumo, id: extenso }, componente({ referenciaInternaInsumoId: extenso }))).toThrow(/não truncar/);
  });
  it.each([{ ncm: null }, { ncm: "1905909" }, { ncmAplicabilidade: "NAO_APLICAVEL" }, { analiseNcm: undefined }, { tratamento: "KIT_COMPOSTO" }, { tratamento: "OPCAO_CONFIGURACAO" }, { natureza: "SERVICO" }])("não confirma estoque como mercadoria sem análise individual %#", alteracoes => {
    expect(() => resolverReferenciaInterna(classificacao(alteracoes as Partial<ClassificacaoFiscal>), insumo, componente())).toThrow(ErroEstruturaFiscal);
  });
  it("permite salvar estudo pendente sem promover NCM da matéria-prima", async () => {
    const buscar = vi.fn().mockResolvedValue(insumo);
    const tx = { insumo: { findUnique: buscar } } as unknown as Prisma.TransactionClient;
    await expect(conferirReferenciaInterna(tx, classificacao({ estado: "PENDENTE", ncm: null, analiseNcm: undefined, pendencias: ["Característica sintética ainda necessária"] }))).resolves.toBeUndefined();
    expect(buscar).toHaveBeenCalledTimes(1);
  });
  it("confere pela transação fornecida e não escreve ou cria ProdutoVenda", async () => {
    const buscar = vi.fn().mockResolvedValue(insumo);
    const criar = vi.fn(), atualizar = vi.fn();
    const tx = { insumo: { findUnique: buscar, update: atualizar }, produtoVenda: { create: criar } } as unknown as Prisma.TransactionClient;
    await conferirReferenciaInterna(tx, classificacao());
    expect(buscar).toHaveBeenCalledWith({ where: { id }, select: { id: true, nome: true, ativo: true, excluidoEm: true, unidade: true, tipo: true } });
    expect(criar).not.toHaveBeenCalled(); expect(atualizar).not.toHaveBeenCalled();
  });
  it("classificação comercial preservada não consulta ou altera o catálogo de insumos", async () => {
    const buscar = vi.fn(); const tx = { insumo: { findUnique: buscar } } as unknown as Prisma.TransactionClient;
    await conferirReferenciaInterna(tx, classificacao({ produtoId: "produto_comercial_ficticio", referenciaInternaInsumoId: undefined }));
    expect(buscar).not.toHaveBeenCalled();
  });
  it("checagem transacional recusa insumo removido após o estudo", async () => {
    const tx = { insumo: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as Prisma.TransactionClient;
    await expect(conferirReferenciaInterna(tx, classificacao())).rejects.toThrow(/não existe/);
  });
});
