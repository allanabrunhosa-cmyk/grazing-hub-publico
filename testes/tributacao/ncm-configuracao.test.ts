import { describe, expect, it } from "vitest";
import { resolverNcmConfiguracao as resolver } from "@/lib/tributacao/ncm-configuracao";
import { calcularTributacao as calcular } from "@/lib/tributacao/motor";
import { hashOpcaoTecnica, hashPrincipalTecnico, receitaDoSnapshot, type FotografiaReceitaFiscal } from "@/lib/tributacao/fotografia-tecnica";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import { fotografarPoliticaKit } from "@/lib/tributacao/fotografia-kit";
import type { AnaliseNcm, ClassificacaoFiscal, ContextoFiscal, DadosVersaoFiscal, ItemComercialFiscal, PerfilFiscal, RegraFiscal, TabelaFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";

// Códigos, descrições e parâmetros vinculam somente fixtures matemáticas, nunca produtos reais.
const contexto: ContextoFiscal = { data: "2026-10-12", estabelecimento: "loja-ficticia", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", modelo: "55", operacao: "VENDA" };
const analise = (descricaoNcm: string | null): AnaliseNcm => ({ fundamento: "PESQUISA", confianca: "MEDIA", descricaoNcm, dataAnalise: "2026-10-11", justificativa: "Pesquisa e composição exclusivamente fictícias para teste", fontes: ["documento-ficticio"], pendenciasNcm: [] });
const ingrediente = (id: string, quantidade = "1") => [{ insumoId: `insumo-${id}`, unidade: "UN", quantidade }];
function foto(): FotografiaReceitaFiscal { return { algoritmo: "grazing.receita-fiscal.v1", principalHash: hashPrincipalTecnico("UN", []), opcaoHashes: ["opcao-a", "opcao-b"].map(opcaoId => ({ opcaoId, hash: hashOpcaoTecnica(null, ingrediente(opcaoId)) })) }; }
function receita(es: ItemComercialFiscal["escolhas"]) { return { principalHash: foto().principalHash, opcaoHashes: es.map(e => ({ opcaoId: e.opcaoId, hash: foto().opcaoHashes.find(x => x.opcaoId === e.opcaoId)?.hash ?? hashOpcaoTecnica(e.produtoId, []) })) }; }
function resolverNcmConfiguracao(c: ClassificacaoFiscal, es: ItemComercialFiscal["escolhas"], id: string) { return resolver(c, es, id, receita(es), foto()); }
function calcularTributacao(ctx: ContextoFiscal, itens: ItemComercialFiscal[], vs: VersaoFiscalDto[], atual = foto()) { return calcular(ctx, itens, vs, [], [{ produtoId: "principal", fotografia: atual }]); }
function classificacao(): ClassificacaoFiscal { return { produtoId: "principal", grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: null, origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Identidade e GTIN exclusivamente fictícios"], pendencias: [], ncmAplicabilidade: "APLICAVEL", analiseNcm: analise(null), configuracaoNcm: { grupoIds: ["sabores"], padraoSemEscolhasAutorizado: false, fotografiaTecnica: foto(), cenarios: [{ id: "cenario-a", nome: "Configuração A fictícia", opcaoIds: ["opcao-a"], ncm: "08061000", analiseNcm: analise("Descrição A fictícia") }, { id: "cenario-b", nome: "Configuração B fictícia", opcaoIds: ["opcao-b"], ncm: "19053100", analiseNcm: analise("Descrição B fictícia") }] } }; }
function escolha(opcaoId = "opcao-a", grupoId: string | null = "sabores"): ItemComercialFiscal["escolhas"][number] { return { opcaoId, grupoId, produtoId: null, nome: "Escolha fictícia", quantidade: "1", valor: "0.00" }; }
function versao(tipo: VersaoFiscalDto["tipo"], chave: string, dados: DadosVersaoFiscal): VersaoFiscalDto { return { id: `${tipo}-${chave}`, tipo, chave, versao: 1, vigenciaInicio: "2026-01-01", status: "ATIVO", dados, justificativa: "Fixture exclusivamente sintética", fontes: ["documento-ficticio"], criadoPorNome: "Autor fictício", createdAt: "2026-01-01T00:00:00Z", hash: "hash-ficticio" }; }
function versoes(c = classificacao()) {
  const perfil: PerfilFiscal = { estabelecimento: contexto.estabelecimento, cnpj: "12345678000195", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", confirmado: true, evidenciaEnquadramento: "Regime exclusivamente fictício", modelos: ["55"], emissor: "TAKEAT", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
  const tributo = { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Tributo exclusivamente sintético" };
  const regra: RegraFiscal = { estabelecimento: contexto.estabelecimento, regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: null, natureza: null, ncm: "08061000", cfop: "5102", csosn: "102", icms: tributo, pis: { ...tributo, cst: "49" }, cofins: { ...tributo, cst: "49" }, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "CENARIO_A_FICTICIO", reforma: null, seletivo: "NAO_APLICAVEL" };
  const tabela = (tabela: TabelaFiscal["tabela"], codigos: string[]) => versao("TABELA", tabela, { tabela, referencia: "Fixture sintética", completa: false, linhas: codigos.map(codigo => ({ codigo, descricao: "Descrição fictícia" })) });
  return [versao("CLASSIFICACAO", "principal", c), versao("PERFIL", contexto.estabelecimento, perfil), versao("REGRA", "regra-a", regra), versao("REGRA", "regra-b", { ...regra, ncm: "19053100", segregacaoReceita: "CENARIO_B_FICTICIO" }), ...["opcao-a", "opcao-b", "opcao-nova"].map(opcaoId => versao("COMPLEMENTO", opcaoId, { opcaoId, comportamento: "INCLUIDO", produtoId: null, justificativa: "Escolha integrada exclusivamente sintética" })), tabela("NCM", ["08061000", "19053100"]), tabela("CFOP", ["5102"]), tabela("CSOSN", ["102"]), tabela("CST_ICMS", ["40"]), tabela("CST_PIS_COFINS", ["49"])];
}
function item(escolhas = [escolha()]): ItemComercialFiscal { return { id: "item", produtoId: "principal", nome: "Família fictícia", quantidade: "1", unidade: "UN", total: "10.00", escolhas, receitaFotografada: receita(escolhas) }; }

describe("Cenários NCM por configuração", () => {
  it.each([["opcao-a", "08061000", "CENARIO_A_FICTICIO"], ["opcao-b", "19053100", "CENARIO_B_FICTICIO"]])("%s seleciona NCM antes das regras, sem linha artificial nem mudança de total", (opcao, ncm, receita) => {
    const r = calcularTributacao(contexto, [item([escolha(opcao)])], versoes());
    expect(r.pendencias).toEqual([]); expect(r.apto).toBe(true); expect(r.linhas).toHaveLength(1); expect(r.totalMercadorias).toBe("10.00");
    expect(r.linhas[0]).toMatchObject({ ncm, segregacaoReceita: receita, cenarioNcm: { opcaoIds: [opcao], classificacaoVersaoId: "CLASSIFICACAO-principal" } });
    expect(r.linhas[0].justificativas.some(x => x.includes("Pesquisa e composição"))).toBe(true);
    expect(r.linhas[0]).not.toHaveProperty("classificacaoResolvida"); expect(r.linhas[0]).not.toHaveProperty("escolhas");
  });
  it("combinação exata de opções tem cenário próprio, sem prioridade implícita", () => {
    const c = classificacao(); c.configuracaoNcm!.cenarios.push({ ...c.configuracaoNcm!.cenarios[0], id: "combinacao", opcaoIds: ["opcao-a", "opcao-b"] });
    expect(resolverNcmConfiguracao(c, [escolha("opcao-b"), escolha("opcao-a")], "v1").cenarioNcm?.id).toBe("combinacao");
    c.configuracaoNcm!.cenarios.pop(); expect(resolverNcmConfiguracao(c, [escolha("opcao-b"), escolha("opcao-a")], "v1").pendencias.join()).toContain("sem cenário");
  });
  it("escolha nova e ausência não herdam o NCM base", () => {
    const c = classificacao(); c.ncm = "08061000";
    for (const escolhas of [[], [escolha("opcao-nova")]]) expect(resolverNcmConfiguracao(c, escolhas, "v1").classificacao.ncm).toBeNull();
    c.configuracaoNcm!.padraoSemEscolhasAutorizado = true; c.analiseNcm = analise("Descrição A fictícia");
    expect(resolverNcmConfiguracao(c, [], "v1").cenarioNcm?.id).toBe("PADRAO_SEM_ESCOLHAS");
    expect(resolverNcmConfiguracao(c, [escolha("opcao-nova")], "v1").classificacao.ncm).toBeNull();
  });
  it("baixa confiança bloqueia somente o cenário escolhido; cenário comprovado continua apto", () => {
    const c = classificacao(); c.configuracaoNcm!.cenarios[1].ncm = null; c.configuracaoNcm!.cenarios[1].analiseNcm = { ...analise(null), confianca: "BAIXA", pendenciasNcm: ["Composição essencial não comprovada"] };
    expect(validarDadosFiscais("CLASSIFICACAO", c)).toMatchObject({ configuracaoNcm: { cenarios: [{ ncm: "08061000" }, { ncm: null }] } });
    expect(calcularTributacao(contexto, [item([escolha("opcao-a")])], versoes(c)).apto).toBe(true);
    const r = calcularTributacao(contexto, [item([escolha("opcao-b")])], versoes(c)); expect(r.apto).toBe(false); expect(r.pendencias.join()).toContain("Composição essencial");
  });
  it("ambiguidade histórica e identidade de grupo ausente impedem emissão", () => {
    const c = classificacao(); c.configuracaoNcm!.cenarios.push({ ...c.configuracaoNcm!.cenarios[0], id: "duplicado" });
    expect(resolverNcmConfiguracao(c, [escolha()], "v1").pendencias.join()).toContain("Mais de um cenário");
    expect(resolverNcmConfiguracao(classificacao(), [escolha("opcao-a", null)], "v1").pendencias.join()).toContain("grupo de escolha ausente");
    expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow("Seletores");
  });
  it("valida IDs, limites e análise de cada cenário, mantendo estruturas antigas compatíveis", () => {
    expect(validarDadosFiscais("CLASSIFICACAO", classificacao())).toMatchObject({ ncm: null, configuracaoNcm: { padraoSemEscolhasAutorizado: false } });
    for (const alterar of [(c: ClassificacaoFiscal) => { c.configuracaoNcm!.cenarios[0].opcaoIds = []; }, (c: ClassificacaoFiscal) => { c.configuracaoNcm!.cenarios[0].opcaoIds = ["invalido;DROP"]; }, (c: ClassificacaoFiscal) => { c.configuracaoNcm!.cenarios[0].analiseNcm.fontes = []; }]) { const c = classificacao(); alterar(c); expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow(); }
    const c = classificacao(); delete c.configuracaoNcm; delete c.ncmAplicabilidade; delete c.analiseNcm; c.ncm = "08061000";
    expect(resolverNcmConfiguracao(c, [escolha("qualquer", null)], "v1").classificacao).toBe(c);
  });
  it("fotografia do cenário anterior não muda ao substituir a classificação", () => {
    const vs = versoes(), r = calcularTributacao(contexto, [item()], vs), foto = structuredClone(r);
    (vs[0].dados as ClassificacaoFiscal).configuracaoNcm!.cenarios[0].ncm = "19053100";
    expect(r).toEqual(foto); expect(r.linhas[0].ncm).toBe("08061000");
  });
  it("mudança física no ramo B bloqueia B sem bloquear A, e principal alterado exige revisão", () => {
    const atual = foto(); atual.opcaoHashes[1].hash = hashOpcaoTecnica(null, ingrediente("opcao-b", "2"));
    expect(calcularTributacao(contexto, [item()], versoes(), atual).apto).toBe(true);
    const b = calcularTributacao(contexto, [item([escolha("opcao-b")])], versoes(), atual); expect(b.apto).toBe(false); expect(b.pendencias.join()).toContain("diverge da receita analisada");
    atual.principalHash = hashPrincipalTecnico("UN", ingrediente("fixo")); expect(calcularTributacao(contexto, [item()], versoes(), atual).pendencias.join()).toContain("principal diverge");
  });
  it("receita fotografada ignora nome/preço, agrega ingredientes e conserva quantidades exatas", () => {
    const es = [escolha()], a = receitaDoSnapshot("UN", [{ ...ingrediente("opcao-a", "0.4")[0], nome: "Nome antigo", origem: "opcao-a" }, { ...ingrediente("opcao-a", "0.6")[0], nome: "Nome novo", origem: "opcao-a" }], es, true);
    expect(a).toEqual(receita(es));
    expect(receitaDoSnapshot("UN", [{ ...ingrediente("opcao-a", "2")[0], origem: "opcao-a" }], es, true)).not.toEqual(a);
    expect(receitaDoSnapshot("UN", [], es, false)).toBeUndefined();
  });
  it("sem fotografia servidor ou snapshot físico não confirma cenários históricos", () => {
    const c = classificacao(); delete c.configuracaoNcm!.fotografiaTecnica;
    expect(resolverNcmConfiguracao(c, [escolha()], "v1").pendencias.join()).toContain("sem fotografia técnica");
    const i = item(); delete i.receitaFotografada; expect(calcularTributacao(contexto, [i], versoes()).pendencias.join()).toContain("pedido ou do cadastro atual não comprovada");
  });
  it("ingrediente gratuito ou cobrado sem cenário bloqueia novas análises; opções sem ingrediente conservam a linha", () => {
    const c = classificacao(); delete c.configuracaoNcm; c.ncm = "08061000"; c.analiseNcm = analise("Descrição A fictícia");
    const vs = versoes(c); expect(calcularTributacao(contexto, [item()], vs).pendencias.join()).toContain("sem cenário NCM fundamentado");
    const v = vs.find(v => v.tipo === "COMPLEMENTO" && v.chave === "opcao-a")!; v.dados = { ...v.dados as object, comportamento: "INTEGRADO" } as DadosVersaoFiscal;
    const cobrado = item(); cobrado.escolhas[0].valor = "2.00"; expect(calcularTributacao(contexto, [cobrado], vs).apto).toBe(false);
    const vazio = item(); vazio.receitaFotografada!.opcaoHashes[0].hash = hashOpcaoTecnica(null, []);
    expect(calcularTributacao(contexto, [vazio], vs).apto).toBe(true);
    delete c.analiseNcm; delete c.ncmAplicabilidade; expect(calcularTributacao(contexto, [item()], versoes(c)).apto).toBe(true);
  });
  it("apresentação integra cobrança, versão e justificativa sem entrar como ingrediente ou linha fiscal artificial", () => {
    const c = classificacao(), vs = [...versoes(c), versao("COMPLEMENTO", "apresentacao", { opcaoId: "apresentacao", comportamento: "APRESENTACAO", produtoId: null, justificativa: "Apresentação sem ingrediente alimentar exclusivamente fictícia" })];
    const i = item(); i.total = "12.00"; i.escolhas.push({ opcaoId: "apresentacao", grupoId: "embalagens", produtoId: null, nome: "Embalagem superior fictícia", quantidade: "1", valor: "2.00" });
    // A fotografia do alimento contém só a opção física A, sem inventar receita da apresentação.
    const r = calcularTributacao(contexto, [i], vs); expect(r.apto).toBe(true); expect(r.linhas).toHaveLength(1); expect(r.totalMercadorias).toBe("12.00"); expect(r.linhas[0]).toMatchObject({ produtoId: "principal", valor: "12.00", ncm: "08061000" }); expect(r.linhas[0].versoes).toContain("COMPLEMENTO-apresentacao"); expect(r.linhas[0].justificativas.join()).toContain("Apresentação sem ingrediente alimentar");
  });
  it("equivalência documentada aceita combinações e contagem no limite sem enumerar cenários", () => {
    const c = classificacao(); c.ncm = "08061000"; c.analiseNcm = analise("Descrição A fictícia");
    c.configuracaoNcm = { grupoIds: [], cenarios: [], fotografiaTecnica: foto(), padraoSemEscolhasAutorizado: true, gruposEquivalentes: [{ grupoId: "sabores", opcaoIds: ["opcao-a", "opcao-b"], quantidadeMinima: "1", quantidadeMaxima: "3", analiseNcm: analise("Equivalência exclusivamente fictícia") }] };
    expect(validarDadosFiscais("CLASSIFICACAO", c)).toMatchObject({ configuracaoNcm: { grupoIds: [], gruposEquivalentes: [{ quantidadeMaxima: "3" }] } });
    const es = [{ ...escolha(), quantidadeEscolhida: "2", quantidade: "2" }, { ...escolha("opcao-b"), quantidadeEscolhida: "1" }];
    const i = item(es); i.receitaFotografada = receitaDoSnapshot("UN", [{ ...ingrediente("opcao-a", "2")[0], origem: "opcao-a" }, { ...ingrediente("opcao-b")[0], origem: "opcao-b" }], es.map(e => ({ ...e, quantidade: e.quantidadeEscolhida })), true);
    const r = calcularTributacao(contexto, [i], versoes(c)); expect(r.apto).toBe(true); expect(r.totalMercadorias).toBe("10.00"); expect(r.linhas).toHaveLength(1); expect(r.linhas[0].ncm).toBe("08061000"); expect(r.linhas[0].cenarioNcm?.opcaoIds).toEqual(["opcao-a", "opcao-b"]);
    es[0].quantidadeEscolhida = "3"; expect(calcularTributacao(contexto, [i], versoes(c)).pendencias.join()).toContain("fora dos limites");
    es[0].quantidadeEscolhida = "2"; const atual = foto(); atual.opcaoHashes[1].hash = hashOpcaoTecnica(null, ingrediente("opcao-b", "2")); expect(calcularTributacao(contexto, [i], versoes(c), atual).apto).toBe(false);
    expect(calcularTributacao(contexto, [item([{ ...escolha("opcao-nova"), quantidadeEscolhida: "1" }])], versoes(c)).pendencias.join()).toContain("sem equivalência");
    expect(calcularTributacao(contexto, [item([])], versoes(c)).apto).toBe(false);
    c.configuracaoNcm.gruposEquivalentes![0].quantidadeMinima = "0"; expect(calcularTributacao(contexto, [item([])], versoes(c)).apto).toBe(true);
  });
  it("equivalências recusam prova baixa, grupos em conflito e padrão implícito", () => {
    const c = classificacao(); c.ncm = "08061000"; c.analiseNcm = analise("Descrição A fictícia"); c.configuracaoNcm!.padraoSemEscolhasAutorizado = true;
    c.configuracaoNcm!.gruposEquivalentes = [{ grupoId: "sabores", opcaoIds: ["opcao-a"], quantidadeMinima: "0", quantidadeMaxima: "2", analiseNcm: analise("Equivalência fictícia") }];
    expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow("Seletores");
    c.configuracaoNcm!.grupoIds = []; c.configuracaoNcm!.cenarios = []; c.configuracaoNcm!.gruposEquivalentes[0].analiseNcm.confianca = "BAIXA"; expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow("Equivalência");
    c.configuracaoNcm!.gruposEquivalentes[0].analiseNcm.confianca = "ALTA"; c.configuracaoNcm!.padraoSemEscolhasAutorizado = false; expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow("Equivalência exige");
  });
  it("kit discrimina duas escolhas do mesmo produto e referência interna, preservando rateio e descrições", () => {
    const c = classificacao(), interna: ClassificacaoFiscal = { ...c, produtoId: null, referenciaInternaInsumoId: "preparacao", grupo: "GF02", ncm: "19053100", analiseNcm: analise("Preparação sintética"), configuracaoNcm: undefined, conversaoUnidade: { unidadeEstoque: "KG", quantidadeEstoquePorUnidadeFiscal: "0.06", justificativa: "Conversão exclusivamente fictícia", fontes: ["documento-ficticio"] } };
    const kit: ClassificacaoFiscal = { ...c, produtoId: "kit", grupo: null, tratamento: "KIT_COMPOSTO", ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: analise(null), configuracaoNcm: undefined, componentesKit: [{ produtoId: "principal", descricao: "Mercadoria A documentada", quantidade: "1", pesoRateio: "1", escolhas: [{ opcaoId: "opcao-a", grupoId: "sabores", quantidade: "1" }], receitaFotografada: receita([escolha()]) }, { produtoId: "principal", descricao: "Mercadoria B documentada", quantidade: "1", pesoRateio: "1", escolhas: [{ opcaoId: "opcao-b", grupoId: "sabores", quantidade: "1" }], receitaFotografada: receita([escolha("opcao-b")]) }, { referenciaInternaInsumoId: "preparacao", descricao: "Preparação final documentada", unidade: "UN", quantidade: "2", pesoRateio: "1" }] };
    expect(validarDadosFiscais("CLASSIFICACAO", kit)).toMatchObject({ componentesKit: [{ produtoId: "principal" }, { produtoId: "principal" }, { referenciaInternaInsumoId: "preparacao" }] });
    const ins = [{ id: "preparacao", nome: "Preparação fictícia", ativo: true, excluidoEm: null, unidade: "KG", tipo: "PRODUTO_INTERMEDIARIO" }];
    const vs = [...versoes(c), versao("CLASSIFICACAO", "kit", kit), versao("CLASSIFICACAO", "INSUMO:preparacao", interna)];
    for (const k of kit.componentesKit!) { k.receitaFotografada ??= { principalHash: hashPrincipalTecnico("UN", []), opcaoHashes: [] }; k.receitaFotografada.materiais = { principal: { algoritmo: "grazing.material-fiscal.v1", insumos: [] }, opcoes: (k.escolhas ?? []).map(e => ({ opcaoId: e.opcaoId, materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [] } })) }; }
    const i = { ...item([]), produtoId: "kit", total: "10.01", fotografiaKitFiscal: fotografarPoliticaKit(kit, "CLASSIFICACAO-kit") };
    const r = calcular(contexto, [i], vs, [{ id: "principal", nome: "Nome cadastral genérico", unidade: "UN" }], [{ produtoId: "principal", fotografia: foto() }], ins);
    expect(r.pendencias).toEqual([]); expect(r.apto).toBe(true); expect(r.totalMercadorias).toBe("10.01"); expect(r.linhas.map(l => l.valor)).toEqual(["3.34", "3.34", "3.33"]);
    expect(r.linhas.map(l => [l.nome, l.ncm])).toEqual([["Mercadoria A documentada", "08061000"], ["Mercadoria B documentada", "19053100"], ["Preparação final documentada", "19053100"]]);
    expect(r.linhas[2]).toMatchObject({ produtoId: "INSUMO:preparacao", referenciaInternaInsumoId: "preparacao", quantidade: "2.000000" });
    const semProva = { ...i, fotografiaKitFiscal: undefined }; expect(calcular(contexto, [semProva], vs, [{ id: "principal", nome: "Nome", unidade: "UN" }], [{ produtoId: "principal", fotografia: foto() }], ins).pendencias.join()).toContain("kit não fotografada");
    // A receita da versão atual não substitui a fotografia comercial original.
    kit.componentesKit![0].receitaFotografada!.principalHash = "f".repeat(64);
    expect(calcular(contexto, [i], vs, [{ id: "principal", nome: "Nome", unidade: "UN" }], [{ produtoId: "principal", fotografia: foto() }], ins).apto).toBe(true);
    const versaoOriginal = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === "kit")!; versaoOriginal.id = "CLASSIFICACAO-kit-v2"; versaoOriginal.versao = 2;
    const compat = calcular(contexto, [i], vs, [{ id: "principal", nome: "Nome", unidade: "UN" }], [{ produtoId: "principal", fotografia: foto() }], ins); expect(compat.apto).toBe(true); expect(compat.linhas[0].versoes).not.toContain("CLASSIFICACAO-kit"); expect(compat.linhas[0].justificativas.join()).toContain("CLASSIFICACAO-kit");
    kit.componentesKit![0].quantidade = "2"; expect(calcular(contexto, [i], vs, [{ id: "principal", nome: "Nome", unidade: "UN" }], [{ produtoId: "principal", fotografia: foto() }], ins).pendencias.join()).toContain("política de itens/quantidades/rateio alterada"); kit.componentesKit![0].quantidade = "1";
    ins[0].ativo = false; expect(calcular(contexto, [i], vs, [{ id: "principal", nome: "Nome", unidade: "UN" }], [{ produtoId: "principal", fotografia: foto() }], ins).pendencias.join()).toContain("inativo ou excluído");
  });
  it("multiconjunto exato 2 de um sabor difere de 1+1, sem concluir classificação pelo peso", () => {
    const c = classificacao(); c.configuracaoNcm!.cenarios.push({ ...c.configuracaoNcm!.cenarios[1], id: "a-duplo", opcaoIds: ["opcao-a"], quantidadesEscolhidas: [{ opcaoId: "opcao-a", quantidade: "2" }] });
    expect(() => validarDadosFiscais("CLASSIFICACAO", c)).not.toThrow();
    const i = item([{ ...escolha(), quantidadeEscolhida: "2" }]);
    expect(calcularTributacao(contexto, [i], versoes(c)).linhas[0].ncm).toBe("19053100");
    i.escolhas[0].quantidadeEscolhida = "1"; expect(calcularTributacao(contexto, [i], versoes(c)).linhas[0].ncm).toBe("08061000");
    i.escolhas[0].quantidadeEscolhida = "3"; expect(calcularTributacao(contexto, [i], versoes(c)).apto).toBe(false);
    c.configuracaoNcm!.cenarios[2].quantidadesEscolhidas = []; expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow("todas as opções");
  });
  it("unidades separadas por sabor discriminam NCM, contagem e valores reais das escolhas fechadas", () => {
    const c = classificacao(); c.configuracaoNcm!.modoFiscal = "UNIDADES_SEPARADAS";
    const vs = versoes(c); for (const v of vs.filter(v => v.tipo === "COMPLEMENTO")) v.dados = { ...v.dados as object, comportamento: "INTEGRADO" } as DadosVersaoFiscal;
    const i = { ...item([{ ...escolha(), quantidadeEscolhida: "2", valor: "50.00" }, { ...escolha("opcao-b"), quantidadeEscolhida: "3", valor: "75.00" }]), quantidade: "2", total: "125.00" };
    const r = calcularTributacao(contexto, [i], vs); expect(r.pendencias).toEqual([]); expect(r.apto).toBe(true); expect(r.linhas.map(l => [l.ncm,l.quantidade,l.valor])).toEqual([["08061000","4.000000","50.00"],["19053100","6.000000","75.00"]]); expect(r.totalMercadorias).toBe("125.00");
    i.total = "126.00"; expect(calcularTributacao(contexto, [i], vs).pendencias.join()).toContain("base ou custo não discriminado");
    c.configuracaoNcm!.cenarios[0].opcaoIds.push("opcao-b"); expect(() => validarDadosFiscais("CLASSIFICACAO", c)).toThrow("Unidades separadas");
  });
  it("mercadoria adicional configurada exige equivalência física selada da origem e do alvo", () => {
    const c = classificacao(), pai: ClassificacaoFiscal = { ...c, produtoId: "pai", ncm: "08061000", analiseNcm: analise("Descrição A fictícia"), configuracaoNcm: undefined };
    const origem = hashOpcaoTecnica("alias-ficticio", ingrediente("opcao-a"));
    const v = versao("COMPLEMENTO", "extra", { opcaoId: "extra", comportamento: "MERCADORIA", produtoId: "principal", justificativa: "Equivalência de origem e configuração exclusivamente fictícia", escolhas: [{ opcaoId: "opcao-a", grupoId: "sabores", quantidade: "1" }], receitaFotografada: receita([escolha()]), fotografiaOpcaoOrigem: origem });
    const i: ItemComercialFiscal = { ...item([]), produtoId: "pai", total: "57.90", escolhas: [{ ...escolha("extra", "extras"), produtoId: "alias-ficticio", valor: "45.00", unidade: "UN" }], receitaFotografada: { principalHash: foto().principalHash, opcaoHashes: [{ opcaoId: "extra", hash: origem }] } };
    const vs = [...versoes(), versao("CLASSIFICACAO", "pai", pai), v], atuais = [{ produtoId: "principal", fotografia: foto() }, { produtoId: "OPCAO:extra", fotografia: { ...foto(), principalHash: origem } }];
    const cat = [{ id: "principal", nome: "Mercadoria configurada fictícia", unidade: "UN", preco: "12.90" }];
    const configuracaoPaga = vs.find(v => v.tipo === "COMPLEMENTO" && v.chave === "opcao-a")!; configuracaoPaga.dados = { ...configuracaoPaga.dados as object, comportamento: "INTEGRADO" } as DadosVersaoFiscal;
    const r = calcular(contexto, [i], vs, cat, atuais); expect(r.apto).toBe(true); expect(r.linhas.map(l => [l.produtoId,l.valor])).toEqual([["pai","12.90"],["principal","45.00"]]); expect(r.totalMercadorias).toBe("57.90");
    c.configuracaoNcm!.modoFiscal = "UNIDADES_SEPARADAS"; (vs[0].dados as ClassificacaoFiscal).configuracaoNcm!.modoFiscal = "UNIDADES_SEPARADAS";
    const individual = calcular(contexto, [i], vs, cat, atuais); expect(individual.apto).toBe(true); expect(individual.linhas.map(l => [l.produtoId,l.quantidade,l.valor])).toEqual([["pai","1.000000","12.90"],["principal","1.000000","45.00"]]); expect(individual.totalMercadorias).toBe("57.90");
    (v.dados as import("@/lib/tributacao/tipos").ComportamentoFiscal).escolhas!.push({ opcaoId: "opcao-b", grupoId: "sabores", quantidade: "1" }); expect(calcular(contexto, [i], vs, cat, atuais).pendencias.join()).toContain("multissabor exige"); (v.dados as import("@/lib/tributacao/tipos").ComportamentoFiscal).escolhas!.pop();
    atuais[1].fotografia.principalHash = "origem-alterada"; const bloqueado = calcular(contexto, [i], vs, cat, atuais); expect(bloqueado.apto).toBe(false); expect(bloqueado.pendencias.join()).toContain("equivalência física comprovada");
  });
  it("mercadoria simples usa fotografia própria da opção, incluindo material, sem herdar foto do principal", () => {
    const c = classificacao(); delete c.configuracaoNcm; c.produtoId = "mercadoria"; c.ncm = "08061000"; c.analiseNcm = analise("Descrição A fictícia");
    const principalHash = hashPrincipalTecnico("UN", ingrediente("mercadoria")), materiais = { algoritmo: "grazing.material-fiscal.v1" as const, insumos: [{ insumoId: "insumo-mercadoria", hash: "a".repeat(64), transitiva: false }] };
    c.fotografiaTecnica = { algoritmo: "grazing.classificacao-fiscal.v1", principalHash, materiais };
    const fotoExtra = { principalHash, opcaoHashes: [], materiais: { principal: materiais, opcoes: [] } };
    const pai: ClassificacaoFiscal = { ...classificacao(), produtoId: "pai", ncm: "08061000", configuracaoNcm: undefined, analiseNcm: analise("Descrição A fictícia") };
    const b = versao("COMPLEMENTO", "extra-simples", { opcaoId: "extra-simples", comportamento: "MERCADORIA", produtoId: "mercadoria", justificativa: "Porção separada exclusivamente fictícia" });
    const i: ItemComercialFiscal = { ...item([]), produtoId: "pai", quantidade: "3", total: "60.00", escolhas: [{ ...escolha("extra-simples", "extras"), produtoId: "mercadoria", quantidade: "2", quantidadeEscolhida: "2", valor: "20.00", unidade: "UN", receitaFotografada: fotoExtra }] };
    const vs = [...versoes(), versao("CLASSIFICACAO", "pai", pai), versao("CLASSIFICACAO", "mercadoria", c), b], atuais = [{ produtoId: "mercadoria", fotografia: { algoritmo: "grazing.receita-fiscal.v1" as const, ...fotoExtra } }];
    const r = calcular(contexto, [i], vs, [], atuais); expect(r.apto).toBe(true); expect(r.linhas.map(l => [l.produtoId,l.quantidade,l.valor])).toEqual([["pai","3.000000","40.00"],["mercadoria","6.000000","20.00"]]);
    delete i.escolhas[0].receitaFotografada; const falta = calcular(contexto, [i], vs, [], atuais); expect(falta.apto).toBe(false); expect(falta.linhas).toHaveLength(1); expect(falta.linhas[0].produtoId).toBe("pai"); expect(falta.pendencias.join()).toContain("Receita material/transitiva");
  });
  it("nova classificação normal rejeita receita transitiva alterada mantendo preço/nome fora do selo", () => {
    const c = classificacao(); delete c.configuracaoNcm; c.ncm = "08061000"; c.analiseNcm = analise("Descrição A fictícia");
    const materiais = { algoritmo: "grazing.material-fiscal.v1" as const, insumos: [{ insumoId: "preparacao", hash: "a".repeat(64), transitiva: true }] };
    const principalHash = hashPrincipalTecnico("UN", [{ insumoId: "preparacao", unidade: "KG", quantidade: "0.1" }]); c.fotografiaTecnica = { algoritmo: "grazing.classificacao-fiscal.v1", principalHash, materiais };
    const i = item([]); i.receitaFotografada = { principalHash, opcaoHashes: [], materiais: { principal: structuredClone(materiais), opcoes: [] } };
    const atual = { ...foto(), principalHash, materiais: { principal: structuredClone(materiais), opcoes: [] } };
    expect(calcularTributacao(contexto, [i], versoes(c), atual).apto).toBe(true);
    const fotoAnterior = structuredClone(i); i.nome = "Nome futuro fictício"; i.total = "12.00"; expect(calcularTributacao(contexto, [i], versoes(c), atual).apto).toBe(true);
    atual.materiais.principal.insumos[0].hash = "b".repeat(64); const r = calcularTributacao(contexto, [i], versoes(c), atual); expect(r.apto).toBe(false); expect(r.pendencias.join()).toContain("Receita material/transitiva"); expect(fotoAnterior.receitaFotografada!.materiais!.principal.insumos[0].hash).toBe("a".repeat(64));
    delete i.receitaFotografada!.materiais; expect(calcularTributacao(contexto, [i], versoes(c), atual).apto).toBe(false);
  });
  it("receita transitiva do cenário B mudou sem alterar ID/quantidade; A conserva aptidão", () => {
    const c = classificacao(), tecnica = foto(); tecnica.materiais = { principal: { algoritmo: "grazing.material-fiscal.v1", insumos: [] }, opcoes: ["opcao-a","opcao-b"].map(opcaoId => ({ opcaoId, materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [{ insumoId: `insumo-${opcaoId}`, hash: "a".repeat(64), transitiva: true }] } })) }; c.configuracaoNcm!.fotografiaTecnica = structuredClone(tecnica);
    const a = item(), b = item([escolha("opcao-b")]); a.receitaFotografada!.materiais = structuredClone(tecnica.materiais); b.receitaFotografada!.materiais = structuredClone(tecnica.materiais);
    tecnica.materiais.opcoes[1].materiais.insumos[0].hash = "b".repeat(64);
    expect(calcularTributacao(contexto, [a], versoes(c), tecnica).apto).toBe(true); const r = calcularTributacao(contexto, [b], versoes(c), tecnica); expect(r.apto).toBe(false); expect(r.pendencias.join()).toContain("Receita transitiva da opção");
  });
});
