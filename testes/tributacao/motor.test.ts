import { describe, expect, it } from "vitest";
import { calcularTributacao, ratearFiscal, versoesVigentes } from "@/lib/tributacao/motor";
import { hojeFiscal, validarDadosFiscais, validarSalvarVersaoFiscal } from "@/lib/tributacao/validacao";
import { hashPrincipalTecnico } from "@/lib/tributacao/fotografia-tecnica";
import { fotografarPoliticaKit } from "@/lib/tributacao/fotografia-kit";
import { fciRepasseFicticia, fotografiaRepasse } from "./fci-fornecedor-fixtures";
import type { ClassificacaoFiscal, ComportamentoFiscal, ContextoFiscal, DadosVersaoFiscal, ItemComercialFiscal, PerfilFiscal, RegraFiscal, TabelaFiscal, TributoConfigurado, VersaoFiscalDto } from "@/lib/tributacao/tipos";

// Dados e alíquotas são cenários matemáticos fictícios, não regras homologadas,
// classificação de produtos reais ou afirmação de alíquotas legais de 2027.
const contexto: ContextoFiscal = { data: "2026-10-11", estabelecimento: "loja-ficticia", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", modelo: "55", operacao: "VENDA" };
function v(tipo: VersaoFiscalDto["tipo"], chave: string, dados: DadosVersaoFiscal, extra: Partial<VersaoFiscalDto> = {}): VersaoFiscalDto {
  return { id: `${tipo}-${chave}-v1`, tipo, chave, versao: 1, vigenciaInicio: "2026-01-01", status: "ATIVO", dados, justificativa: "Fundamentação sintética do teste", fontes: ["https://www.gov.br/receitafederal/pt-br"], criadoPorNome: "Administrador fictício", createdAt: "2026-01-01T00:00:00Z", hash: "hash-ficticio", ...extra };
}
function perfil(extra: Partial<PerfilFiscal> = {}): PerfilFiscal { return { estabelecimento: contexto.estabelecimento, cnpj: "12345678000195", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", confirmado: true, evidenciaEnquadramento: "Evidência sintética do regime", modelos: ["55", "65"], emissor: "TAKEAT", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null, ...extra }; }
function classificacao(produtoId = "produto", extra: Partial<ClassificacaoFiscal> = {}): ClassificacaoFiscal { return { produtoId, grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Formulação e ausência de GTIN exclusivamente sintéticas, confirmadas para teste"], pendencias: [], ...extra }; }
function tributo(extra: Partial<TributoConfigurado> = {}): TributoConfigurado { return { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Tratamento sintético sem destaque", ...extra }; }
function regra(extra: Partial<RegraFiscal> = {}): RegraFiscal { return { estabelecimento: contexto.estabelecimento, regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: null, natureza: null, ncm: null, cfop: "5101", csosn: "102", icms: tributo(), pis: tributo({ cst: "49" }), cofins: tributo({ cst: "49" }), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "ALIMENTACAO_PREPARADA_SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL", ...extra }; }
function tabela(tabela: TabelaFiscal["tabela"], codigos: string[], linhas: Partial<TabelaFiscal["linhas"][number]> = {}): VersaoFiscalDto { return v("TABELA", tabela, { tabela, referencia: "Tabela sintética para testar compatibilidade", completa: false, linhas: codigos.map(codigo => ({ codigo, descricao: "Descrição sintética", ...linhas })) }); }
function base(): VersaoFiscalDto[] { return [v("PERFIL", contexto.estabelecimento, perfil()), v("CLASSIFICACAO", "produto", classificacao()), v("REGRA", "regra-preparado", regra()), tabela("NCM", ["19059090", "19053100", "22042100", "22030000", "22021000", "08061000"]), tabela("CFOP", ["5101", "5102", "5405", "6101", "6102", "6108"]), tabela("CSOSN", ["102", "500", "900"]), tabela("CST_ICMS", ["00", "20", "40", "41", "60"]), tabela("CST_PIS_COFINS", ["01", "49"]), tabela("CST_IBSCBS", ["000", "200"]), tabela("CCLASSTRIB", ["000001"], { cst: "000", reducao: "0" })]; }
function item(extra: Partial<ItemComercialFiscal> = {}): ItemComercialFiscal { return { id: "item", produtoId: "produto", nome: "Tábua sintética", quantidade: "1", unidade: "UN", total: "100.00", escolhas: [], ...extra }; }
function fotoKit(c: ClassificacaoFiscal) { for (const k of c.componentesKit ?? []) k.receitaFotografada = { principalHash: hashPrincipalTecnico("UN", []), opcaoHashes: [], materiais: { principal: { algoritmo: "grazing.material-fiscal.v1", insumos: [] }, opcoes: [] } }; return fotografarPoliticaKit(c, "versao-kit-ficticia"); }
function comportamento(opcaoId: string, extra: Partial<ComportamentoFiscal> = {}): VersaoFiscalDto { return v("COMPLEMENTO", opcaoId, { opcaoId, comportamento: "INCLUIDO", produtoId: null, justificativa: "Escolha sintética compõe a preparação", ...extra }); }
function lucroPresumido(): VersaoFiscalDto[] {
  const vs = base().filter(x => x.tipo !== "PERFIL" && x.tipo !== "REGRA");
  return [...vs, v("PERFIL", contexto.estabelecimento, perfil({ regime: "LUCRO_PRESUMIDO", reforma: "EXIGIR_REGRA", layoutRTC: { codigo: "NT2026.008", homologacaoComprovada: true, evidenciaHomologacao: "Contrato sintético para testes, sem suporte real declarado", campos: { valorProdutoLiquido: "LiquidoFicticio", valorUnitarioLiquido: "UnitarioFicticio", valorTotalItem: "TotalItemFicticio", valorLiquidoProdutosTotal: "LiquidoProdutosFicticio", valorTotalDocumento: "TotalDocumentoFicticio" } } }), { vigenciaInicio: "2027-01-01" }), v("REGRA", "regra-lp", regra({ regime: "LUCRO_PRESUMIDO", csosn: null, icms: tributo({ cst: "00", modalidade: "TRIBUTADO", aliquota: "18" }), reforma: { cst: "000", cClassTrib: "000001", cbs: "8.8", ibsUf: "0.1", ibsMunicipio: "0", reducao: "0", justificativa: "Alíquotas fictícias para testar cálculo de 2027", preco2027: { baseIcms: "BRUTA", rateio: "PROPORCIONAL_BRUTO", justificativa: "Base bruta e rateio de acessórios exclusivamente sintéticos" } } }), { vigenciaInicio: "2027-01-01" })];
}

describe("motor tributário com catálogo e regras exclusivamente sintéticos", () => {
  it("o padrão do grupo cadastrado é efetivo e a exceção individual prevalece", () => {
    const vs = base().map(x => x.tipo === "CLASSIFICACAO" ? { ...x, dados: classificacao("produto", { grupo: null, grupoFiscalId: "grupo-do-usuario" }) } : x);
    vs.push(v("REGRA", "padrao-usuario", regra({ grupoFiscalId: "grupo-do-usuario", cfop: "5101" })));
    const padrao = calcularTributacao(contexto, [item()], vs);
    expect(padrao.apto).toBe(true); expect(padrao.linhas[0].versoes).toContain("REGRA-padrao-usuario-v1");
    vs.push(v("REGRA", "excecao-produto", regra({ produtoId: "produto", cfop: "5101" })));
    const excecao = calcularTributacao(contexto, [item()], vs);
    expect(excecao.apto).toBe(true); expect(excecao.linhas[0].cfop).toBe("5101");
    expect(excecao.linhas[0].versoes).toContain("REGRA-excecao-produto-v1");
  });
  it("a mesma configuração respeita o modelo e não escolhe entre regras conflitantes", () => {
    const vs = [...base(), v("REGRA", "somente65", regra({ produtoId: "produto", modelo: "65", cfop: "5101" }))];
    expect(calcularTributacao({ ...contexto, modelo: "65" }, [item()], vs).linhas[0].versoes).toContain("REGRA-somente65-v1");
    expect(calcularTributacao({ ...contexto, modelo: "55" }, [item()], vs).linhas[0].versoes).not.toContain("REGRA-somente65-v1");
    vs.push(v("REGRA", "concorrente65", regra({ produtoId: "produto", modelo: "65", cfop: "5101" })));
    const conflito = calcularTributacao({ ...contexto, modelo: "65" }, [item()], vs);
    expect(conflito.apto).toBe(false); expect(conflito.pendencias.join(" ")).toContain("regras concorrentes");
  });
  it("a receita de produção não cria linhas e somente a política documentada desmembra o kit", () => {
    const preparado = calcularTributacao(contexto, [item({ receitaFotografada: { principalHash: "receita-sintetica", opcaoHashes: [] } })], base());
    expect(preparado.linhas.map(l => l.nome)).toEqual(["Tábua sintética"]);
    expect(preparado.totalMercadorias).toBe("100.00");
  });
  it("desabilitar uma exceção em nova versão devolve a herança sem alterar parâmetros antigos", () => {
    const original = v("REGRA", "excecao", regra({ produtoId: "produto", segregacaoReceita: "INDIVIDUAL_SINTETICA" }));
    const antes = [...base(), original], copia = structuredClone(original);
    expect(calcularTributacao(contexto, [item()], antes).linhas[0].segregacaoReceita).toBe("INDIVIDUAL_SINTETICA");
    const encerrada = { ...original, id: "excecao-v2", versao: 2, dados: { ...original.dados as RegraFiscal, habilitada: false } };
    const depois = calcularTributacao(contexto, [item()], [...antes, encerrada]);
    expect(depois.linhas[0].versoes).not.toContain("excecao-v2");
    expect(depois.linhas[0].segregacaoReceita).not.toBe("INDIVIDUAL_SINTETICA");
    expect(original).toEqual(copia);
    expect(validarDadosFiscais("REGRA", encerrada.dados)).toHaveProperty("habilitada", false);
    expect(() => validarDadosFiscais("REGRA", { ...encerrada.dados, habilitada: "false" })).toThrow();
  });
  it.each([
    { ncm: null, origem: "0" as const, esperado: "NCM (8 dígitos)", ausente: "Origem ICMS" },
    { ncm: "19059090", origem: null, esperado: "Origem ICMS", ausente: "NCM (8 dígitos)" },
  ])("identifica somente o campo ausente: $esperado", ({ ncm, origem, esperado, ausente }) => {
    const vs = base().map(v => v.tipo === "CLASSIFICACAO" ? { ...v, dados: classificacao("produto", { ncm, origem }) } : v);
    const r = calcularTributacao(contexto, [item()], vs);
    expect(r.apto).toBe(false);
    const motivo = r.pendencias.find(p => p.includes("falta preencher"));
    expect(motivo).toContain(esperado); expect(motivo).not.toContain(ausente);
  });
  it.each(["55", "65"] as const)("repasse FCI de mercadoria fracionada funciona no modelo%s sem apuração própria", modelo => {
    const fci = fciRepasseFicticia(), c = classificacao("produto", { natureza: "FRACIONADO", origem: "5", fci, fotografiaTecnica: fotografiaRepasse });
    const vs = base().map(versao => versao.tipo === "CLASSIFICACAO" ? { ...versao, dados: c } : versao.tipo === "REGRA" ? { ...versao, dados: regra({ cfop: "5102" }) } : versao);
    const receita = { principalHash: fotografiaRepasse.principalHash, opcaoHashes: [], materiais: { principal: fotografiaRepasse.materiais, opcoes: [] } };
    const mercadoria = item({ receitaFotografada: receita });
    const tecnicas = [{ produtoId: "produto", fotografia: { algoritmo: "grazing.receita-fiscal.v1" as const, ...receita } }];
    const r = calcularTributacao({ ...contexto, modelo }, [mercadoria], vs, [], tecnicas);
    expect(r.pendencias).toEqual([]); expect(r.apto).toBe(true); expect(r.totalMercadorias).toBe("100.00");
    expect(r.linhas[0].fci).toEqual(fci); expect(r.linhas[0].classificacaoVersao).toMatchObject({ id: "CLASSIFICACAO-produto-v1", versao: 1, natureza: "FRACIONADO", ncm: c.ncm });
    c.fci!.repasseFornecedor!.registro!.materiaisHash = "e".repeat(64);
    expect(calcularTributacao({ ...contexto, modelo }, [mercadoria], vs, [], tecnicas).pendencias.join(" ")).toContain("FCI do fornecedor");
  });
  it.each(["3", "5", "8"])("origem%s exige apuração e FCI sem bloquear a mercadoria independente", origem => {
    const vs = [...base().map(v => v.tipo === "CLASSIFICACAO" ? { ...v, dados: classificacao("produto", { origem }) } : v), v("CLASSIFICACAO", "cookie", classificacao("cookie", { grupo: "GF03", natureza: "REVENDA", ncm: "19053100" })), v("REGRA", "cookie-regra", regra({ produtoId: "cookie", cfop: "5102" }))];
    const r = calcularTributacao(contexto, [item(), item({ id: "cookie-item", produtoId: "cookie", nome: "Cookie independente fictício", total: "20.00" })], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.filter(p => p.includes("FCI"))).toHaveLength(1); expect(r.pendencias.join(" ")).not.toContain("Cookie independente fictício");
    expect(r.linhas.find(l => l.produtoId === "cookie")!.origem).toBe("0"); expect(r.totalMercadorias).toBe("120.00");
  });
  it("apuração/FCI segue a classificação versionada e não altera valores comerciais", () => {
    const fci = { situacao: "EXIGIDA" as const, numero: "ABCDE123-ABCD-1234-ABCD-1234567890AB", periodoApuracao: "2026-08", conteudoImportacao: "20", valorParcelaImportada: "2", valorSaidaReferencia: "10", apuracaoCompleta: true, justificativa: "Apuração exclusivamente sintética", fontes: ["https://legislacao.fazenda.sp.gov.br/Paginas/pcat642013.aspx"], evidencias: ["Recibo fictício"] };
    const vs = base().map(v => v.tipo === "CLASSIFICACAO" ? { ...v, dados: classificacao("produto", { origem: "5", fci }) } : v);
    const r = calcularTributacao(contexto, [item()], vs);
    expect(r.apto).toBe(true); expect(r.linhas[0].fci).toEqual(fci); expect(r.linhas[0].versoes).toContain("CLASSIFICACAO-produto-v1"); expect(r.totalMercadorias).toBe("100.00");
    expect(fci.valorSaidaReferencia).toBe("10"); // Não substituiu pelo preço do pedido: 100.
  });
  it("GTIN não confirmado bloqueia somente a operação afetada e não inventa SEM GTIN", () => {
    const vs = base().map(v => v.tipo === "CLASSIFICACAO" ? { ...v, dados: classificacao("produto", { gtin: null }) } : v);
    const r = calcularTributacao(contexto, [item()], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("confirmar GTIN");
    expect(r.linhas[0].gtin).toBeNull(); expect(r.totalMercadorias).toBe("100.00");
  });
  it("GTIN confirmado segue a linha fiscal com sua versão individual", () => {
    const vs = base().map(v => v.tipo === "CLASSIFICACAO" ? { ...v, dados: classificacao("produto", { gtin: "4006381333931" }) } : v);
    const r = calcularTributacao(contexto, [item()], vs);
    expect(r.apto).toBe(true); expect(r.linhas[0].gtin).toBe("4006381333931");
    expect(r.linhas[0].versoes).toContain("CLASSIFICACAO-produto-v1");
  });
  it("Simples 2026 conserva total e não destaca IBS/CBS dispensados neste perfil", () => {
    const r = calcularTributacao(contexto, [item()], base());
    expect(r).toMatchObject({ apto: true, regime: "SIMPLES_NACIONAL", totalMercadorias: "100.00", pendencias: [], linhas: [{ csosn: "102", reforma: null, impostos: { icms: { valor: "0.00" }, pis: { valor: "0.00" } } }] });
  });
  it("tábua personalizável com escolhas gratuitas continua uma linha e conserva evidência do tratamento", () => {
    const r = calcularTributacao(contexto, [item({ escolhas: [{ opcaoId: "queijo", produtoId: "queijo-produto", nome: "Queijo da composição", quantidade: "1", valor: "0.00" }] })], [...base(), comportamento("queijo")]);
    expect(r.apto).toBe(true); expect(r.linhas).toHaveLength(1); expect(r.totalMercadorias).toBe("100.00");
    expect(r.linhas[0].versoes).toContain("COMPLEMENTO-queijo-v1");
    expect(r.linhas[0].justificativas).toContain("Queijo da composição: Escolha sintética compõe a preparação");
  });
  it("extra cobrado integrado mantém valor na preparação e registra sua versão", () => {
    const r = calcularTributacao(contexto, [item({ total: "115.00", escolhas: [{ opcaoId: "extra", produtoId: "extra-produto", nome: "Extra integrado", quantidade: "1", valor: "15.00" }] })], [...base(), comportamento("extra", { comportamento: "INTEGRADO" })]);
    expect(r.apto).toBe(true); expect(r.linhas).toHaveLength(1); expect(r.linhas[0].valor).toBe("115.00"); expect(r.linhas[0].versoes).toContain("COMPLEMENTO-extra-v1");
  });
  it("mercadoria adicional usa total cobrado pela escolha, inclusive quantidade do item principal", () => {
    const vs = [...base(), v("CLASSIFICACAO", "vinho", classificacao("vinho", { grupo: "GF10", natureza: "REVENDA", ncm: "22042100" })), comportamento("garrafa", { comportamento: "MERCADORIA", produtoId: "vinho" }), v("REGRA", "regra-vinho", regra({ produtoId: "vinho", cfop: "5102" }))];
    const r = calcularTributacao(contexto, [item({ quantidade: "2", total: "240.00", escolhas: [{ opcaoId: "garrafa", produtoId: "vinho", nome: "Vinho sintético", quantidade: "1", unidade: "UN", valor: "40.00" }] })], vs);
    expect(r.apto).toBe(true); expect(r.linhas.map(x => [x.produtoId, x.quantidade, x.valor])).toEqual([["produto", "2.000000", "200.00"], ["vinho", "2.000000", "40.00"]]); expect(r.totalMercadorias).toBe("240.00");
  });
  it("mercadoria adicional sem unidade comprovada bloqueia a emissão sem reinterpretar sua quantidade", () => {
    const vs = [...base(), v("CLASSIFICACAO", "vinho", classificacao("vinho", { grupo: "GF10", natureza: "REVENDA", ncm: "22042100" })), comportamento("garrafa", { comportamento: "MERCADORIA", produtoId: "vinho" }), v("REGRA", "regra-vinho", regra({ produtoId: "vinho", cfop: "5102" }))];
    const escolha = { opcaoId: "garrafa", produtoId: "vinho", nome: "Vinho sintético", quantidade: "1", valor: "40.00" };
    const r = calcularTributacao(contexto, [item({ quantidade: "2", total: "240.00", escolhas: [escolha] })], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("unidade comercial ausente");
    expect(r.linhas.find(l => l.produtoId === "vinho")).toMatchObject({ quantidade: "2.000000", unidade: "", valor: "40.00" });
    expect(escolha.quantidade).toBe("1"); expect(r.totalMercadorias).toBe("240.00");
  });
  it("unidade divergente mantém a quantidade comercial e impede emissão sem conversão comprovada", () => {
    const comercial = item({ unidade: "KG", quantidade: "2.5" });
    const r = calcularTributacao(contexto, [comercial], base());
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("unidade comercial KG diverge da unidade fiscal UN");
    expect(r.linhas[0]).toMatchObject({ quantidade: "2.500000", unidade: "KG", valor: "100.00" });
    expect(comercial).toMatchObject({ quantidade: "2.5", unidade: "KG", total: "100.00" });
  });
  it("embalagem superior integrada não vira mercadoria; embalagem vendida separadamente exige classificação", () => {
    const e = { opcaoId: "embalagem", produtoId: "caixa", nome: "Caixa superior", quantidade: "1", valor: "10.00" };
    const r = calcularTributacao(contexto, [item({ total: "110.00", escolhas: [e] })], [...base(), comportamento("embalagem", { comportamento: "APRESENTACAO" })]);
    expect(r.apto).toBe(true); expect(r.linhas).toHaveLength(1); expect(r.totalMercadorias).toBe("110.00");
    const separado = calcularTributacao(contexto, [item({ total: "110.00", escolhas: [e] })], [...base(), comportamento("embalagem", { comportamento: "MERCADORIA", produtoId: "caixa" })]);
    expect(separado.apto).toBe(false); expect(separado.pendencias.join(" ")).toContain("classificação individual ausente");
  });
  it("extra cobrado sem comportamento confirmado e escolha incluída cobrada bloqueiam só a prévia fiscal", () => {
    const itens = [item({ total: "110.00", escolhas: [{ opcaoId: "extra", produtoId: null, nome: "Extra incerto", quantidade: "1", valor: "10.00" }] })];
    expect(calcularTributacao(contexto, itens, base()).apto).toBe(false);
    expect(calcularTributacao(contexto, itens, [...base(), comportamento("extra")]).pendencias.join(" ")).toContain("recebeu cobrança"); expect(itens[0].total).toBe("110.00");
  });
  it("gratuidade não presume integração de mercadoria vinculada; opção sem mercadoria conserva configuração", () => {
    const escolha = { opcaoId: "brinde", produtoId: "vinho", nome: "Mercadoria gratuita sintética", quantidade: "1", valor: "0.00" };
    const r = calcularTributacao(contexto, [item({ escolhas: [escolha] })], base());
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("gratuidade não comprova"); expect(r.linhas).toHaveLength(1); expect(r.totalMercadorias).toBe("100.00");
    expect(calcularTributacao(contexto, [item({ escolhas: [{ ...escolha, produtoId: null, nome: "Ausência de ingrediente sintética" }] })], base()).apto).toBe(true);
  });
  it("preparado e revenda resolvem regras específicas sem herdar NCM único do grupo", () => {
    const vs = [...base(), v("CLASSIFICACAO", "cookie", classificacao("cookie", { grupo: "GF03", natureza: "REVENDA", ncm: "19053100" })), v("REGRA", "regra-cookie", regra({ produtoId: "cookie", cfop: "5102" }))];
    const r = calcularTributacao(contexto, [item(), item({ id: "item-cookie", produtoId: "cookie", nome: "Cookie sintético", total: "20.00" })], vs);
    expect(r.apto).toBe(true); expect(r.linhas.map(x => [x.ncm, x.cfop])).toEqual([["19059090", "5101"], ["19053100", "5102"]]); expect(r.totalMercadorias).toBe("120.00");
  });
  it("cesta discrimina mercadorias com NCM diferente e rateia centavos pelo maior resto", () => {
    const vs = [...base(), v("CLASSIFICACAO", "cesta", classificacao("cesta", { tratamento: "KIT_COMPOSTO", ncm: null, origem: null, componentesKit: [{ produtoId: "produto", quantidade: "1", pesoRateio: "2" }, { produtoId: "vinho", quantidade: "1", pesoRateio: "1" }] })), v("CLASSIFICACAO", "vinho", classificacao("vinho", { grupo: "GF10", natureza: "REVENDA", ncm: "22042100" })), v("REGRA", "regra-vinho", regra({ produtoId: "vinho", cfop: "5102" }))];
    const r = calcularTributacao(contexto, [item({ produtoId: "cesta", nome: "Cesta sintética", fotografiaKitFiscal: fotoKit(vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === "cesta")!.dados as ClassificacaoFiscal) })], vs, [{ id: "produto", nome: "Alimento individual sintético", unidade: "UN" }, { id: "vinho", nome: "Vinho individual sintético 750ml", unidade: "UN" }]);
    expect(r.apto).toBe(true); expect(r.linhas.map(x => [x.ncm, x.valor])).toEqual([["19059090", "66.67"], ["22042100", "33.33"]]); expect(r.totalMercadorias).toBe("100.00");
    expect(r.linhas.map(x => [x.produtoId, x.nome, x.unidade])).toEqual([["produto", "Alimento individual sintético", "UN"], ["vinho", "Vinho individual sintético 750ml", "UN"]]);
    expect(r.linhas.every(x => x.nome !== "Cesta sintética" && !x.nome.includes(x.produtoId))).toBe(true);
    expect(ratearFiscal("0.01", ["1", "1", "1"])).toEqual(["0.01", "0.00", "0.00"]);
  });
  it.each([["GF10", "22042100", "Vinho"], ["GF09", "22030000", "Cerveja"], ["GF07", "22021000", "Bebida industrializada"]] as const)("%s conserva mercadoria e regra individual", (grupo, ncm, nome) => {
    const vs = base().filter(x => x.tipo !== "CLASSIFICACAO" && x.tipo !== "REGRA");
    vs.push(v("CLASSIFICACAO", "produto", classificacao("produto", { grupo, ncm, natureza: "REVENDA" })), v("REGRA", "regra-bebida", regra({ grupo, cfop: "5102", segregacaoReceita: "REVENDA_SINTETICA" })));
    const r = calcularTributacao(contexto, [item({ nome: `${nome} sintético` })], vs);
    expect(r.apto).toBe(true); expect(r.linhas[0]).toMatchObject({ ncm, valor: "100.00", segregacaoReceita: "REVENDA_SINTETICA" });
  });
  it("evento com alimentação e serviço não mascara NFS-e como mercadoria", () => {
    const vs = [...base(), v("CLASSIFICACAO", "servico", classificacao("servico", { grupo: "GF12", natureza: "SERVICO", ncm: null, origem: null }))];
    const r = calcularTributacao(contexto, [item(), item({ id: "servico-item", produtoId: "servico", nome: "Montagem de evento sintética", total: "50.00" })], vs);
    expect(r.apto).toBe(false); expect(r.linhas).toHaveLength(1); expect(r.linhas[0].valor).toBe("100.00"); expect(r.pendencias.join(" ")).toContain("NFS-e");
  });
  it("perfil futuro não antecipa Lucro Presumido; cadastro não confirmado bloqueia emissão", () => {
    const vs = [...base(), ...lucroPresumido().filter(x => x.tipo === "PERFIL" || x.tipo === "REGRA")];
    expect(calcularTributacao(contexto, [item()], vs).regime).toBe("SIMPLES_NACIONAL");
    const incorreto = base().map(x => x.tipo === "PERFIL" ? { ...x, dados: perfil({ regime: "LUCRO_PRESUMIDO", reforma: "EXIGIR_REGRA" }) } : x);
    expect(calcularTributacao(contexto, [item()], incorreto).pendencias.join(" ")).toContain("antecipado");
    const semConfirmar = base().map(x => x.tipo === "PERFIL" ? { ...x, dados: perfil({ confirmado: false, evidenciaEnquadramento: "" }) } : x);
    expect(calcularTributacao(contexto, [item()], semConfirmar).apto).toBe(false);
  });
  it("Lucro Presumido 2027 retira IBS/CBS contidos no preço e ICMS bruto da base", () => {
    const r = calcularTributacao({ ...contexto, data: "2027-01-02" }, [item()], lucroPresumido());
    expect(r.apto).toBe(true); expect(r.linhas[0].impostos).toMatchObject({ icms: { valor: "18.00" }, pis: { valor: "0.00" }, cofins: { valor: "0.00" } });
    expect(r.linhas[0].reforma).toMatchObject({ base: "75.29", cbs: "8.8000", valorCbs: "6.63", valorIbsUf: "0.08" }); expect(r.totalMercadorias).toBe("100.00");
    expect(r.linhas[0].valoresRTC).toMatchObject({ produtoLiquido: "75.29", unitarioLiquido: "75.2900000000", totalItem: "100.00" });
  });
  it("frete e despesas integram a base sem somar novamente ao valor comercial das mercadorias", () => {
    const r = calcularTributacao({ ...contexto, data: "2027-01-02", frete: "20.00", outrosCustos: "5.00" }, [item()], lucroPresumido());
    expect(r.apto).toBe(true); expect(r.totalMercadorias).toBe("100.00");
    expect(r.linhas[0]).toMatchObject({ valor: "100.00", frete: "20.00", outrasDespesas: "5.00", impostos: { icms: { base: "125.00", valor: "22.50" }, pis: { valor: "0.00" }, cofins: { valor: "0.00" } }, reforma: { base: "94.13", valorCbs: "8.28", valorIbsUf: "0.09" }, valoresRTC: { totalItem: "125.00" } });
  });
  it("2027 sem contrato do leiaute homologado ou política de preço continua bloqueado", () => {
    const vs = lucroPresumido().map(x => x.tipo === "PERFIL" ? { ...x, dados: { ...x.dados as PerfilFiscal, layoutRTC: undefined } } : x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, reforma: { ...(x.dados as RegraFiscal).reforma!, preco2027: undefined } } } : x);
    const r = calcularTributacao({ ...contexto, data: "2027-01-02" }, [item()], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("Layout RTC 2027"); expect(r.pendencias.join(" ")).toContain("política de preço final"); expect(r.linhas[0].reforma).toBeNull(); expect(r.totalMercadorias).toBe("100.00");
  });
  it("2027 não acumula destaque legado de PIS/COFINS com CBS", () => {
    const vs = lucroPresumido().map(x => x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, pis: tributo({ cst: "01", modalidade: "TRIBUTADO", aliquota: "0.65" }) } } : x);
    const r = calcularTributacao({ ...contexto, data: "2027-01-02" }, [item()], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("PIS/COFINS legados"); expect(r.linhas[0].reforma).toBeNull();
  });
  it("limite de quatro casas fiscais não arredonda quantidade comercial", () => {
    expect(calcularTributacao(contexto, [item({ quantidade: "1.1234" })], base()).apto).toBe(true);
    const r = calcularTributacao(contexto, [item({ quantidade: "1.123456" })], base());
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("4 casas"); expect(r.linhas[0].quantidade).toBe("1.123456"); expect(r.totalMercadorias).toBe("100.00");
  });
  it("unitário bruto acima do limite fiscal bloqueia apenas a operação sem reprecificar", () => {
    const comercial = item({ total: "12000000000.00", quantidade: "0.1" });
    const r = calcularTributacao(contexto, [comercial], base());
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("valor unitário fiscal excede"); expect(r.totalMercadorias).toBe("12000000000.00"); expect(comercial.quantidade).toBe("0.1");
  });
  it("base ICMS líquida não fica apta por justificativa genérica sem exceção normativa", () => {
    const vs = lucroPresumido().map(x => x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, reforma: { ...(x.dados as RegraFiscal).reforma!, preco2027: { ...(x.dados as RegraFiscal).reforma!.preco2027!, baseIcms: "LIQUIDA_RTC" as const } } } } : x);
    const r = calcularTributacao({ ...contexto, data: "2027-01-02" }, [item()], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("exceção normativa"); expect(r.linhas[0].reforma).toBeNull(); expect(r.totalMercadorias).toBe("100.00");
  });
  it("CBS/IBS exige compatibilidade CST, cClassTrib e redução da tabela vigente", () => {
    const vs = lucroPresumido().map(x => x.tipo === "TABELA" && x.chave === "CCLASSTRIB" ? tabela("CCLASSTRIB", ["000001"], { cst: "200", reducao: "40" }) : x);
    const r = calcularTributacao({ ...contexto, data: "2027-01-02" }, [item()], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("incompatíveis");
  });
  it("CST 00 não permite redução de base disfarçada como tributação integral", () => {
    const vs = lucroPresumido().map(x => x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, icms: tributo({ cst: "00", aliquota: "18", modalidade: "TRIBUTADO", reducaoBase: "10" }) } } : x);
    const r = calcularTributacao({ ...contexto, data: "2027-01-02" }, [item()], vs);
    expect(r.apto).toBe(false); expect(r.pendencias.join(" ").toLowerCase()).toContain("redução");
  });
  it("retenção anterior ST sem dados próprios não fica apta somente por CEST/NCM/CSOSN", () => {
    const vs = base().map(x => x.tipo === "CLASSIFICACAO" ? { ...x, dados: classificacao("produto", { natureza: "REVENDA", cest: "1700100" }) } : x.tipo === "REGRA" ? { ...x, dados: regra({ csosn: "500", cfop: "5405", st: "RETIDO_ANTERIORMENTE", cest: "1700100" }) } : x);
    vs.push(tabela("CEST", ["1700100"], { ncm: ["19059090"] }));
    expect(calcularTributacao(contexto, [item()], vs).apto).toBe(false);
  });
  it("CSOSN900 com isenção específica sem destaque não é confundido com crédito ou ST a calcular", () => {
    const vs = base().map(x => x.tipo === "CLASSIFICACAO" ? { ...x, dados: classificacao("produto", { grupo: "GF05", natureza: "FRACIONADO", ncm: "08061000" }) } : x.tipo === "REGRA" ? { ...x, dados: regra({ cfop: "5102", csosn: "900", icms: tributo({ cst: "40", justificativa: "Isenção de hortifrutigranjeiro fresco comprovada em cenário exclusivamente fictício" }) }) } : x);
    const r = calcularTributacao(contexto, [item({ nome: "Fruta fresca fictícia" })], vs);
    expect(r.apto).toBe(true); expect(r.linhas[0]).toMatchObject({ csosn: "900", cfop: "5102", impostos: { icms: { cst: "40", base: "0.00", valor: "0.00" } } });
    const indevida = vs.map(x => x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, icms: tributo({ cst: "00" }) } } : x);
    expect(calcularTributacao(contexto, [item()], indevida).apto).toBe(false);
  });
  it("ST retida comprovada em consumidor final SP dispensa campos não exigidos nessa operação", () => {
    const vs = base().map(x => x.tipo === "CLASSIFICACAO" ? { ...x, dados: classificacao("produto", { natureza: "REVENDA", cest: "1700100" }) } : x.tipo === "REGRA" ? { ...x, dados: regra({ csosn: "500", cfop: "5405", icms: tributo({ cst: "60" }), st: "RETIDO_ANTERIORMENTE", cest: "1700100", evidenciaSt: "NF de entrada fictícia: retenção efetiva comprovada; consumidor final SP; artigo274 e regras N12a50/60 conferidas para o cenário sintético" }) } : x);
    vs.push(tabela("CEST", ["1700100"], { ncm: ["19059090"] }));
    const r = calcularTributacao({ ...contexto, consumidorFinal: true }, [item()], vs);
    expect(r.apto).toBe(true); expect(r.linhas[0]).toMatchObject({ csosn: "500", cest: "1700100", cfop: "5405", impostos: { icms: { valor: "0.00" } } });
    expect(r.linhas[0].justificativas.join(" ")).toContain("retenção efetiva comprovada");
    const semProva = vs.map(x => x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, evidenciaSt: undefined } } : x);
    expect(calcularTributacao(contexto, [item()], semProva).pendencias.join(" ")).toContain("imposto retido");
    const naoFinal = calcularTributacao({ ...contexto, consumidorFinal: false }, [item()], vs);
    expect(naoFinal.apto).toBe(false); expect(naoFinal.pendencias.join(" ")).toContain("imposto retido");
    const outraUf = vs.map(x => x.tipo === "REGRA" ? { ...x, dados: { ...x.dados as RegraFiscal, ufDestino: "RJ", cfop: "6108" } } : x);
    const interestadual = calcularTributacao({ ...contexto, ufDestino: "RJ", consumidorFinal: true }, [item()], outraUf);
    expect(interestadual.apto).toBe(false); expect(interestadual.pendencias.join(" ")).toContain("imposto retido");
  });
  it("ST a calcular, IPI e Seletivo em análise bloqueiam a operação específica", () => {
    for (const alteracao of [{ st: "CALCULO_PENDENTE" as const }, { seletivo: "ANALISE_PENDENTE" as const }, { ipi: tributo({ cst: "53" }) }]) {
      const vs = base().map(x => x.tipo === "REGRA" ? { ...x, dados: regra(alteracao) } : x);
      expect(calcularTributacao(contexto, [item()], vs).apto).toBe(false);
    }
  });
  it("ambiguidade de regras não escolhe pelo acaso e regra específica prevalece", () => {
    const concorrente = [...base(), v("REGRA", "regra-ambigua", regra())];
    expect(calcularTributacao(contexto, [item()], concorrente).pendencias.join(" ")).toContain("concorrentes");
    const especifica = [...base(), v("REGRA", "regra-especifica", regra({ produtoId: "produto", segregacaoReceita: "PREPARADO_ESPECIFICO" }))];
    expect(calcularTributacao(contexto, [item()], especifica).linhas[0].segregacaoReceita).toBe("PREPARADO_ESPECIFICO");
  });
  it("tabela ausente ou incompatível bloqueia SKU; opção de configuração não ganha NCM artificial", () => {
    const semTabela = base().filter(x => x.chave !== "NCM"); expect(calcularTributacao(contexto, [item()], semTabela).apto).toBe(false);
    const incompat = base().map(x => x.chave === "CFOP" ? tabela("CFOP", ["5101"], { modelos: ["65"] }) : x); expect(calcularTributacao(contexto, [item()], incompat).apto).toBe(false);
    const opcao = base().map(x => x.tipo === "CLASSIFICACAO" ? { ...x, dados: classificacao("produto", { tratamento: "OPCAO_CONFIGURACAO", ncm: null, origem: null }) } : x);
    const r = calcularTributacao(contexto, [item()], opcao); expect(r.apto).toBe(false); expect(r.linhas).toHaveLength(0);
  });
  it("quantidade composta além de seis casas gera pendência e nunca quantidade fiscal zero", () => {
    const vs = [...base(), v("CLASSIFICACAO", "kit", classificacao("kit", { tratamento: "KIT_COMPOSTO", componentesKit: [{ produtoId: "produto", quantidade: "0.000001", pesoRateio: "1" }] }))];
    const r = calcularTributacao(contexto, [item({ produtoId: "kit", quantidade: "0.000001", fotografiaKitFiscal: fotoKit(vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === "kit")!.dados as ClassificacaoFiscal) })], vs, [{ id: "produto", nome: "Mercadoria sintética de precisão", unidade: "UN" }]);
    expect(r.apto).toBe(false); expect(r.linhas.some(x => x.quantidade === "0.000000")).toBe(false);
    expect(r.pendencias.join(" ")).toContain("seis casas");
  });
  it("versões futuras/rascunhos preservam cálculos e resultados anteriores sem mutação", () => {
    const vs = base(), anterior = calcularTributacao(contexto, [item()], vs), fotografia = structuredClone(anterior);
    const futura = v("CLASSIFICACAO", "produto", classificacao("produto", { ncm: "19053100" }), { id: "classificacao-v2", versao: 2, vigenciaInicio: "2027-02-01" });
    expect(versoesVigentes([...vs, futura], contexto.data).find(x => x.tipo === "CLASSIFICACAO")?.id).toBe("CLASSIFICACAO-produto-v1");
    calcularTributacao({ ...contexto, data: "2027-02-02" }, [item()], [...vs, futura]); expect(anterior).toEqual(fotografia); expect(vs[1].dados).toEqual(classificacao());
  });
  it("regime opcional não é ativado pelo perfil e não exige aprovação de escritório", () => {
    const vs = base().map(x => x.tipo === "PERFIL" ? { ...x, dados: perfil({ beneficioOpcional: { codigo: "OPCAO_SINTETICA", fim: "2027-01-01", elegibilidade: "Fictícia", opcaoComprovada: "Fictícia" } }) } : x);
    const r = calcularTributacao(contexto, [item()], vs); expect(r.apto).toBe(false); expect(r.pendencias.join(" ")).toContain("Regime opcional"); expect(r.pendencias.join(" ")).not.toMatch(/Confirp|contador/i);
  });
});

describe("validação servidor de versões fiscais", () => {
  it("virada de regime considera meia-noite de Brasília, sem antecipar pela data UTC", () => {
    expect(hojeFiscal(new Date("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
    expect(hojeFiscal(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });
  it("bloqueia confirmação sem evidência e regime normal com CSOSN", () => {
    expect(() => validarDadosFiscais("CLASSIFICACAO", classificacao("produto", { evidencias: [] }))).toThrow();
    expect(() => validarDadosFiscais("REGRA", regra({ regime: "LUCRO_PRESUMIDO" }))).toThrow();
    expect(() => validarDadosFiscais("REGRA", regra({ icms: tributo({ modalidade: "SEM_DESTAQUE", aliquota: "18" }) }))).toThrow();
  });
  it("não aceita data inexistente, código com letras ou fonte não oficial de tabela", () => {
    const entrada = { tipo: "TABELA", chave: "NCM", dados: tabela("NCM", ["19059090"]).dados, versaoBase: 0, vigenciaInicio: "2026-10-11", fontes: ["https://site-ficticio.invalid/tabela"], justificativa: "Teste sintético", chaveOperacao: "operacao-teste" };
    expect(() => validarSalvarVersaoFiscal(entrada)).toThrow("Fonte oficial");
    expect(() => validarSalvarVersaoFiscal({ ...entrada, fontes: ["https://www.gov.br/receitafederal/pt-br"], vigenciaInicio: "2026-02-30" })).toThrow();
    expect(() => validarDadosFiscais("CLASSIFICACAO", classificacao("produto", { ncm: "1905909A" }))).toThrow();
  });
});
