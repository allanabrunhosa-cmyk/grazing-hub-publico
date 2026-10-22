import { describe, expect, it } from "vitest";
import { consultarNcmAuditoria, criarMatrizFiscalCatalogo, resumirCoberturaFiscal, type CatalogoAuditoriaFiscal, type ProdutoAuditoriaFiscal } from "@/lib/tributacao/catalogo";

function produto(id: string, partes: Partial<ProdutoAuditoriaFiscal> = {}): ProdutoAuditoriaFiscal {
  return { id, codigo: null, nome: id, tipo: "PADRAO", classificacoes: ["PRINCIPAL"], ativo: true,
    versao: 1, unidade: "UN", fiscal: {}, fiscalRevisado: false, categorias: [], componentes: [], grupos: [], ...partes };
}
function base(produtos: ProdutoAuditoriaFiscal[]): CatalogoAuditoriaFiscal {
  return { geradoEm: "2026-10-11T22:00:00-03:00", origem: "FIXTURE", produtos,
    insumos: [{ id: "queijo", nome: "Queijo brie", tipo: "INSUMO", unidade: "KG", ativo: true }],
    evidenciasNcmEntrada: [{ itemNotaId: "nota-item-ficticio", notaFiscalId: "nota-ficticia", numeroItem: 1,
      insumoId: "queijo", descricaoProduto: "Queijo brie", ncm: "04069030", dataEmissao: "2026-10-01" }],
    composicoesPreparacoes: [], gruposComplementos: [], opcoes: [] };
}

describe("auditoria e cobertura do catálogo fiscal", () => {
  it.each(["Cesta de café", "Kit de café", "Preparação pronta"])("o nome %s não define kit nem discrimina ingredientes", nome => {
    const c = base([produto("produto-ficticio", { nome, componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao).toMatchObject({ tratamento: "NORMAL" });
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao.componentesKit).toBeUndefined();
  });
  it("rastreia identidade sem inventar SKU e exclui cadastros inativos", () => {
    const m = criarMatrizFiscalCatalogo(base([produto("ativo"), produto("inativo", { ativo: false })]));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ produtoId: "ativo", sku: null, referencia: "ativo" });
  });
  it("conserva NCM de entrada como candidato de fracionado sem ativar emissão", () => {
    const c = base([produto("brie", { nome: "Brie fracionado", componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    const l = criarMatrizFiscalCatalogo(c)[0];
    expect(l.classificacao).toMatchObject({ grupo: "GF05", natureza: "FRACIONADO", ncm: "04069030", estado: "PENDENTE", origem: null });
    expect(l.classificacao.evidencias.some(e => e.includes("nota-item-ficticio"))).toBe(true);
    expect(l.classificacao.pendencias.some(e => e.includes("características"))).toBe(true);
  });
  it("não aplica NCM de queijos à tábua preparada nem aprova código genérico", () => {
    const c = base([produto("tabua", { nome: "Grazing para 2", componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }, { insumoId: "pasta", quantidade: "0.1", unidade: "KG" }] })]);
    c.insumos.push({ id: "pasta", nome: "Patê", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", ativo: true });
    const l = criarMatrizFiscalCatalogo(c)[0];
    expect(l.classificacao).toMatchObject({ grupo: "GF01", natureza: "PREPARADO", ncm: null });
    expect(l.classificacao.pendencias.some(e => e.includes("proporções"))).toBe(true);
  });
  it("nem uma única referência de ingrediente comprova NCM da tábua final", () => {
    const c = base([produto("tabua", { nome: "Grazing para 2", componentes: [{ insumoId: "queijo", quantidade: "1", unidade: "KG" }] })]);
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao).toMatchObject({ natureza: "PREPARADO", ncm: null });
  });
  it("declaração da preparação resolve apresentação sem inventar o NCM final ou afetar outras cestas", () => {
    const c = base([produto("tabua", { nome: "Grazing para 2" }), produto("cesta", { nome: "Cesta de café" })]);
    const m = criarMatrizFiscalCatalogo(c, undefined, [{ produtoId: "tabua", natureza: "PREPARADO", apresentacao: "PRONTO_CONSUMO",
      descricao: "Montada, pronta para consumo, com ingredientes cortados e combinados", fonte: "declaracao-ficticia-do-operador", data: "2026-10-11" }]);
    expect(m[0].classificacao).toMatchObject({ natureza: "PREPARADO", tratamento: "NORMAL", ncm: null, estado: "PENDENTE" });
    expect(m[0].classificacao.evidencias.some(e => e.includes("DECLARACAO_OPERACIONAL"))).toBe(true);
    expect(m[0].classificacao.pendencias.some(e => e.startsWith("Distinguir preparação"))).toBe(false);
    expect(m[0].classificacao.pendencias.some(e => e.includes("RGI"))).toBe(true);
    expect(m[1].classificacao.tratamento).toBe("NORMAL");
  });
  it("uma escolha de sabor cobrada continua configuração do principal", () => {
    const c = base([produto("sabor", { classificacoes: ["OPCAO"] })]);
    c.gruposComplementos.push({ id: "sabores", nome: "Sabores das tortas", tipo: "COMPOSICAO", ativo: true });
    c.opcoes.push({ id: "escolha", grupoId: "sabores", nome: "Palmito", produtoId: "sabor", ativo: true, preco: "229.00", quantidade: "1" });
    const l = criarMatrizFiscalCatalogo(c)[0];
    expect(l.classificacao.tratamento).toBe("OPCAO_CONFIGURACAO");
    expect(l.escolhas[0].comportamento).toBe("INCLUIDO");
    expect(resumirCoberturaFiscal(c.produtos, [l.classificacao])).toMatchObject({ totalAtivos: 1, opcoesConfiguracao: 1, cobertos: 0, pendentes: 0 });
  });
  it("opção também comercializada como mercadoria exige classificação própria", () => {
    const c = base([produto("extra", { classificacoes: ["OPCAO", "COMPLEMENTO"] })]);
    c.gruposComplementos.push({ id: "livre", nome: "Extras", tipo: "EXTRAS", ativo: true }, { id: "separado", nome: "Empório", tipo: "COMPLEMENTAR", ativo: true });
    c.opcoes.push({ id: "op1", grupoId: "livre", nome: "extra", produtoId: "extra", ativo: true, preco: "1.00", quantidade: "1" },
      { id: "op2", grupoId: "separado", nome: "extra", produtoId: "extra", ativo: true, preco: "5.00", quantidade: "1" });
    const l = criarMatrizFiscalCatalogo(c)[0];
    expect(l.classificacao.tratamento).toBe("NORMAL");
    expect(l.escolhas.map(e => e.comportamento)).toEqual(["INTEGRADO_A_ANALISAR", "MERCADORIA"]);
  });
  it("não converte ingredientes de cesta em componentes fiscais comerciais", () => {
    const c = base([produto("cesta", { nome: "Cesta de café", componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    const l = criarMatrizFiscalCatalogo(c)[0];
    expect(l.classificacao.tratamento).toBe("NORMAL");
    expect(l.classificacao.componentesKit).toBeUndefined();
    expect(l.classificacao.pendencias.some(e => e.includes("pesos de rateio"))).toBe(false);
  });
  it("origem da NF de entrada não é copiada à venda do revendedor", () => {
    const c = base([produto("brie", { componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    c.evidenciasNcmEntrada[0].origem = "1";
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao.origem).toBeNull();
  });
  it("categoria comercial mista não enquadra licor como cerveja", () => {
    const c = base([produto("licor", { nome: "Licor doce 500ml", categorias: [{ id: "bebidas", nome: "Cervejas e Licores" }] })]);
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao.grupo).toBe("GF10");
  });
  it("origens distintas no estoque exigem identificação da mercadoria efetiva", () => {
    const c = base([produto("queijo", { fiscal: { origem: "0" }, componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    c.evidenciasNcmEntrada[0].origem = "0";
    c.evidenciasNcmEntrada.push({ ...c.evidenciasNcmEntrada[0], itemNotaId: "nota-importada", origem: "2" });
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao.pendencias.some(e => e.includes("lote/marca"))).toBe(true);
  });
  it("não escolhe entre NCM divergentes", () => {
    const c = base([produto("brie", { componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    c.evidenciasNcmEntrada.push({ ...c.evidenciasNcmEntrada[0], itemNotaId: "outro-item", ncm: "04069020" });
    const l = criarMatrizFiscalCatalogo(c)[0];
    expect(l.classificacao.ncm).toBeNull();
    expect(l.classificacao.pendencias.some(e => e.includes("divergente"))).toBe(true);
  });
  it("exige prova para código Champagne em espumante", () => {
    const c = base([produto("espumante", { nome: "Espumante Brut Nacional", componentes: [{ insumoId: "queijo", quantidade: "1", unidade: "UN" }] })]);
    c.evidenciasNcmEntrada[0].ncm = "22041010";
    expect(criarMatrizFiscalCatalogo(c)[0].classificacao.pendencias.some(e => e.includes("método de produção"))).toBe(true);
  });
  it("conserva hierarquia legal e valida vigência sem certificar mercadoria", () => {
    const t = { fonte: "https://exemplo.invalid/tabela-oficial-ficticia", dataReferencia: "2026-10-11", Nomenclaturas: [
      { Codigo: "04", Descricao: "Leite", Data_Inicio: "01/04/2022", Data_Fim: "31/12/9999" },
      { Codigo: "0406.90.30", Descricao: "Teor de <i>umidade</i>", Data_Inicio: "01/04/2022", Data_Fim: "31/12/9999" } ] };
    expect(consultarNcmAuditoria("04069030", t)).toMatchObject({ descricao: "Teor de umidade", vigente: true, hierarquia: [{ codigo: "04", descricao: "Leite" }] });
    expect(consultarNcmAuditoria("04069030", { ...t, dataReferencia: "2020-01-01" })?.vigente).toBe(false);
    const c = base([produto("queijo", { componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    expect(criarMatrizFiscalCatalogo(c, t)[0].classificacao.estado).toBe("PENDENTE");
  });
  it("conta confirmação somente com NCM, origem, grupo e ausência de pendências", () => {
    const c = base([produto("brie", { componentes: [{ insumoId: "queijo", quantidade: "0.1", unidade: "KG" }] })]);
    const l = criarMatrizFiscalCatalogo(c)[0];
    const confirmada = { ...l.classificacao, estado: "CONFIRMADO" as const, origem: "0", pendencias: [] };
    expect(resumirCoberturaFiscal(c.produtos, [confirmada])).toMatchObject({ cobertos: 1, pendentes: 0 });
    expect(resumirCoberturaFiscal(c.produtos, [{ ...confirmada, origem: null }])).toMatchObject({ cobertos: 0, pendentes: 1 });
  });
});
