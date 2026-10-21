import { describe, expect, it } from "vitest";
import { montarResultadoBi, normalizarFiltrosBi, periodoComparacaoBi, type PedidoFonteBi } from "@/lib/vendas/bi-dominio";
import { celulaCsvBi, exportarBiCsv } from "@/lib/vendas/bi-csv";
import { inicioDiaNoFuso, somarDias } from "@/lib/vendas/pedidos-agenda-dominio";

const agora = new Date("2026-10-15T15:00:00Z"), filtros = { de: "2026-01-01", ate: "2026-09-30" }, permissoes = { contatos: true, custos: true, exportar: true };

it("restringe o segmento sem recompra ao detalhamento de clientes e conserva os filtros globais", () => {
  const segmento = normalizarFiltrosBi({ ...filtros, aba: "clientes", canal: "site", somenteSemRecompra: true }, agora);
  expect(segmento.somenteSemRecompra).toBe(true);
  const geral = normalizarFiltrosBi({ ...segmento, aba: "geral" }, agora);
  expect(geral).toMatchObject({ ...filtros, aba: "geral", canal: "site", somenteSemRecompra: false });
});

it("exige dígitos nos filtros numéricos recebidos como texto", () => {
  for (const diasSemRecompra of ["1e2", "60.0", true]) {
    expect(() => normalizarFiltrosBi({ diasSemRecompra }, agora)).toThrow("Há um filtro numérico inválido.");
  }
  expect(normalizarFiltrosBi({ diasSemRecompra: "90" }, agora).diasSemRecompra).toBe(90);
});
function pedido(id: string, campos: Partial<PedidoFonteBi> = {}): PedidoFonteBi {
  return { id, numero: id, status: "CONFIRMADO", origem: "nativo", identidade: null, data: "2026-09-10", dataEntrega: null, atualizadoEm: "2026-10-14T15:00:00Z", clienteId: "comprador-1", clienteNome: "Comprador sintético", clienteIdentificavel: true, canalId: "canal-1", canalNome: "Site", modalidade: "ENTREGA", regiao: "Bairro · Cidade / SP", enderecoEstado: "nao-validado", itens: [{ id: `item-${id}`, produtoId: "produto-1", nome: "Kit sintético", unidade: "KIT", quantidade: "1", receita: "100.00", categorias: [{ id: "categoria-1", nome: "Kits" }] }], receita: "100.00", naoDetalhado: "0.00", frete: "10.00", ajusteFrete: "0.00", custoEntrega: null, statusHistorico: null, fonteHistorica: false, teste: false, ...campos };
}
describe("BI comercial: mesma coorte e precisão", () => {
  it("ranqueia categorias pelos itens líquidos, com vínculos sobrepostos e pedidos distintos", () => {
    const categorias = [{ id: "kits", nome: "Kits" }, { id: "presentes", nome: "Presentes" }, { id: "kits", nome: "Kits" }];
    const fontes = [pedido("1", { receita: "130", naoDetalhado: "10", frete: "25", itens: [
      { id: "i1", produtoId: "p1", nome: "Kit", unidade: "UN", quantidade: "2", receita: "100", categorias },
      { id: "i2", produtoId: "p2", nome: "Extra", unidade: "UN", quantidade: "1", receita: "20", categorias: [] },
    ] }), pedido("2", { receita: "50", itens: [{ id: "i3", produtoId: "p1", nome: "Kit", unidade: "UN", quantidade: "1", receita: "50", categorias }] }), pedido("cancelado", { status: "CANCELADO" })];
    const resultado = montarResultadoBi(fontes, filtros, permissoes, agora);
    expect(resultado.rankingCategorias).toEqual([
      { id: "kits", nome: "Kits", receita: 150, pedidos: 2 },
      { id: "presentes", nome: "Presentes", receita: 150, pedidos: 2 },
      { id: "sem-categoria", nome: "Sem categoria", receita: 20, pedidos: 1 },
      { id: "sem-detalhamento", nome: "Sem detalhamento", receita: 10, pedidos: 1 },
    ]);
    expect(exportarBiCsv(resultado)).toContain('"Kits";150;2');
    expect(montarResultadoBi(fontes, { ...filtros, de: "2026-09-11" }, permissoes, agora).rankingCategorias).toEqual([]);
    expect(montarResultadoBi([{ ...fontes[0], reducaoSemComponente: "10" }], filtros, permissoes, agora).rankingCategorias.every(c => c.receita === null)).toBe(true);
  });

  it("calcula ticket por pedidos de cada tipo, sem média de tickets dos clientes", () => {
    const fontes = [pedido("1", { clienteTipo: "PF", receita: "10", frete: "2" }), pedido("2", { clienteTipo: "PF", receita: "20", frete: "3" }), pedido("3", { clienteTipo: "PF", clienteId: "outro", receita: "100", frete: "0" })];
    const resultado = montarResultadoBi(fontes, filtros, permissoes, agora);
    expect(resultado.distribuicaoClientes?.find(c => c.tipo === "PF")).toMatchObject({ pedidos: 3, faturamento: 135, ticket: 45 });
    expect(exportarBiCsv(resultado)).toContain('"Pessoa física";3;135;45');
    expect(exportarBiCsv(montarResultadoBi(fontes, filtros, { ...permissoes, contatos: false }, agora))).not.toContain('"Pessoa física";');
  });

  it("agrega mil compradores sem reler o histórico para cada cliente", () => {
    let leituras = 0;
    const fontes = Array.from({ length: 1000 }, (_, n) => {
      const fonte = pedido(String(n), { clienteNome: `Cliente ${n}`, clienteTipo: n % 2 ? "PF" : "PJ" });
      Object.defineProperty(fonte, "clienteId", { get: () => { leituras++; return `cliente-${n}`; }, enumerable: true });
      return fonte;
    });
    const resultado = montarResultadoBi(fontes, filtros, permissoes, agora);
    expect(resultado.clientes.total).toBe(1000);
    expect(resultado.indicadores).toMatchObject({ compradores: 1000, vendas: 110000, ticket: 110 });
    expect(leituras).toBeLessThan(100000);
  });

  it("compara PF/PJ por pedidos e faturamento da seleção, sem contar clientes únicos ou inferir pelo nome", () => {
    const fontes = [
      pedido("pf-1", { clienteTipo: "PF", receita: "0.10", frete: "0.20" }),
      pedido("pf-2", { clienteTipo: "PF", receita: "0.20", frete: "0.10" }),
      pedido("pj", { clienteTipo: "PJ", clienteId: "empresa", receita: "80", frete: "20" }),
      pedido("sem-tipo", { clienteTipo: null, clienteNome: "Empresa sintética LTDA", receita: "50", frete: "0" }),
      pedido("sem-vinculo", { clienteTipo: "PF", clienteId: null, clienteIdentificavel: false, receita: "25", frete: "5" }),
      pedido("snapshot", { clienteTipo: "PJ", clienteIdentificavel: false, receita: "10", frete: "0" }),
      pedido("cancelado", { clienteTipo: "PJ", status: "CANCELADO" }),
      pedido("fora-do-periodo", { clienteTipo: "PJ", data: "2025-12-01" }),
      pedido("outro-canal", { clienteTipo: "PJ", canalId: "outro" }),
    ];
    const resultado = montarResultadoBi(fontes, { ...filtros, canal: "canal-1" }, permissoes, agora);
    expect(resultado.distribuicaoClientes).toEqual([
      { tipo: "PF", pedidos: 2, faturamento: .6, ticket: .3 },
      { tipo: "PJ", pedidos: 1, faturamento: 100, ticket: 100 },
      { tipo: "nao-informado", pedidos: 3, faturamento: 90, ticket: 30 },
    ]);
    expect(resultado.distribuicaoClientes!.reduce((soma, grupo) => soma + grupo.pedidos, 0)).toBe(resultado.indicadores.pedidos);
    expect(resultado.distribuicaoClientes!.reduce((soma, grupo) => soma + grupo.faturamento!, 0)).toBe(resultado.indicadores.vendas);
    const filtrado = montarResultadoBi(fontes, { ...filtros, cliente: "empresa", canal: "canal-1" }, permissoes, agora);
    expect(filtrado.distribuicaoClientes).toEqual([
      { tipo: "PF", pedidos: 0, faturamento: 0, ticket: null },
      { tipo: "PJ", pedidos: 1, faturamento: 100, ticket: 100 },
      { tipo: "nao-informado", pedidos: 0, faturamento: 0, ticket: null },
    ]);
  });
  it("não expõe distribuição de tipos sem permissão e conserva receita não apurada por grupo", () => {
    const fontes = [
      pedido("reduzido", { clienteTipo: "PF", reducaoSemComponente: "15" }),
      pedido("empresa", { clienteTipo: "PJ", receita: "0", frete: "0" }),
    ];
    expect(montarResultadoBi(fontes, filtros, { ...permissoes, contatos: false }, agora).distribuicaoClientes).toBeNull();
    expect(montarResultadoBi(fontes, filtros, permissoes, agora).distribuicaoClientes).toEqual([
      { tipo: "PF", pedidos: 1, faturamento: null, ticket: null },
      { tipo: "PJ", pedidos: 1, faturamento: 0, ticket: 0 },
      { tipo: "nao-informado", pedidos: 0, faturamento: 0, ticket: null },
    ]);
  });
  it("soma frete uma vez no faturamento, clientes, ticket e séries comparadas sem ratear no ranking", () => {
    const fontes = [pedido("anterior", { data: "2026-08-31", receita: "100", frete: "5" }), pedido("atual", { data: "2026-09-01", receita: "100", frete: "10" })];
    const r = montarResultadoBi(fontes, { de: "2026-09-01", ate: "2026-09-01", comparacao: "anterior", agrupamento: "dia" }, permissoes, agora);
    expect(r.indicadores).toMatchObject({ vendas: 110, frete: 10, pedidos: 1, ticket: 110 });
    expect(r.serie[0]).toMatchObject({ vendas: 110, anteriorVendas: 105 });
    expect(r.clientes.linhas[0]).toMatchObject({ valor: 110, ticket: 110 });
    expect(r.produtos.linhas[0]).toMatchObject({ receita: 100, participacao: 100, ticket: 110 });
    expect(r.pedidos.linhas[0]).toMatchObject({ receita: 110, frete: 10 });
    expect(r.reconciliacao).toEqual({ vendas: 110, serie: 110, ranking: 100, frete: 10, pedidos: 110, confere: true });
    expect(exportarBiCsv(r)).toContain('"Receita de produtos (ranking completo)";100');
    expect(exportarBiCsv(r)).toContain('"Frete na reconciliação";10');
  });
  it("conta pedido uma vez com vários itens e não subtrai novamente desconto já líquido", () => {
    const p = pedido("1"); p.itens = [...p.itens, { ...p.itens[0], id: "item-2", produtoId: "produto-2", nome: "Alimento sintético", unidade: "UN", quantidade: "3", receita: "60.00" }]; p.receita = "160.00";
    const r = montarResultadoBi([p], filtros, permissoes, agora);
    expect(r.indicadores).toMatchObject({ vendas: 170, pedidos: 1, ticket: 170 }); expect(r.produtos.linhas.map(p => p.unidade)).toContain("KIT"); expect(r.reconciliacao).toEqual({ vendas: 170, serie: 170, ranking: 160, frete: 10, pedidos: 170, confere: true });
  });
  it("exclui cancelamentos e testes sem tratar zero como cancelado; devolução parcial entra uma vez", () => {
    const parcial = pedido("parcial", { receita: "75.00", naoDetalhado: "-25.00" });
    const zerado = pedido("zero", { receita: "0.00", itens: [], naoDetalhado: "0.00" });
    const r = montarResultadoBi([parcial, zerado, pedido("cancelado", { status: "CANCELADO" }), pedido("teste", { teste: true })], filtros, permissoes, agora);
    expect(r.indicadores).toMatchObject({ vendas: 95, pedidos: 2, ticket: 47.5 }); expect(r.produtos.linhas.find(p => p.id === "sem-detalhamento")?.receita).toBe(-25); expect(r.reconciliacao.confere).toBe(true);
  });
  it("inclui produtos históricos inativos e parcelas sem detalhamento com origem vinculada", () => {
    const historico = pedido("legado", { origem: "historico", status: "HISTORICO", fonteHistorica: true, statusHistorico: "Retirado", receita: "125.00", naoDetalhado: "25.00", canalId: null, canalNome: null });
    const r = montarResultadoBi([historico], filtros, permissoes, agora);
    expect(r.indicadores.vendas).toBe(135); expect(r.produtos.linhas.find(p => p.id === "sem-detalhamento")).toMatchObject({ quantidade: null, receita: 25 }); expect(r.cobertura).toMatchObject({ pedidosHistoricos: 1, pedidosSemDetalhamento: 1 }); expect(r.reconciliacao.confere).toBe(true);
  });
  it("deduplica a identidade legada presente também na base atual", () => {
    const identidade = JSON.stringify(["legado", "loja", "42"]);
    const r = montarResultadoBi([pedido("legado", { origem: "historico", status: "HISTORICO", fonteHistorica: true, identidade }), pedido("atual", { identidade })], filtros, permissoes, agora);
    expect(r.indicadores.pedidos).toBe(1); expect(r.cobertura.duplicidadesExcluidas).toBe(1);
  });
  it("usa comprador estável, separa os não identificados e não usa compras posteriores para recorrência", () => {
    const dados = [pedido("primeiro", { data: "2025-12-01" }), pedido("segundo"), pedido("futuro", { data: "2026-10-01", clienteId: "comprador-2" }), pedido("terceiro", { clienteId: "comprador-2" }), pedido("sem-id", { clienteId: "legado-por-pedido", clienteIdentificavel: false, clienteNome: "Nome igual sem identidade" })];
    const r = montarResultadoBi(dados, filtros, permissoes, agora);
    expect(r.indicadores).toMatchObject({ compradores: 2, recorrencia: 50, pedidos: 3 }); expect(r.cobertura.pedidosSemCliente).toBe(1); expect(r.clientes.linhas).toHaveLength(2);
  });
  it("frete negativo classificado como ajuste não cria custo logístico", () => {
    const p = pedido("legado", { origem: "historico", status: "HISTORICO", fonteHistorica: true, frete: "0", ajusteFrete: "-20", modalidade: null, regiao: null });
    const r = montarResultadoBi([p], filtros, permissoes, agora);
    expect(r.indicadores.frete).toBe(0); expect(r.cobertura).toMatchObject({ fretesNegativos: 1, ajustesFrete: -20 }); expect(r.rentabilidade.custoEntrega).toBeNull(); expect(r.rentabilidade.margem).toBeNull(); expect(r.regioes).toEqual([]);
  });
  it("não usa cobrança como destino e exclui retiradas da distribuição", () => {
    const r = montarResultadoBi([pedido("retirada", { modalidade: "RETIRADA", regiao: "Centro" }), pedido("legado", { origem: "historico", status: "HISTORICO", fonteHistorica: true, modalidade: null, regiao: null })], filtros, permissoes, agora);
    expect(r.regioes).toEqual([]); expect(r.cobertura.modalidadeNaoInformada).toBe(1);
  });
  it("compara apenas entregas com custo efetivo conhecido, incluindo zero conhecido", () => {
    const r = montarResultadoBi([pedido("com-custo", { custoEntrega: "15.00" }), pedido("sem-custo"), pedido("custo-zero", { custoEntrega: "0.00" })], filtros, permissoes, agora);
    expect(r.rentabilidade).toMatchObject({ freteCoberto: 20, custoEntrega: 15, subsidio: -5 }); expect(r.oportunidades.entregasComCusto).toBe(2);
  });
  it("combinações contam pedidos e não unidades ou linhas repetidas", () => {
    const p = pedido("par"); p.itens.push({ ...p.itens[0], id: "duplicado", quantidade: "10", receita: "0" }, { ...p.itens[0], id: "outro", produtoId: "produto-2", nome: "Segundo produto", receita: "0" });
    const r = montarResultadoBi([p], filtros, permissoes, agora); expect(r.oportunidades.combinacoes).toHaveLength(1); expect(r.oportunidades.combinacoes[0]).toMatchObject({ pedidos: 1, participacao: 100 });
  });
  it("sem comparação não mostra variações; base zero ou ausente não gera infinito", () => {
    const dados = [pedido("1")];
    expect(montarResultadoBi(dados, filtros, permissoes, agora).variacoes.vendas.estado).toBe("desativada");
    const r = montarResultadoBi(dados, { ...filtros, comparacao: "anterior" }, permissoes, agora); expect(r.variacoes.vendas).toMatchObject({ valor: null, estado: "sem-base" }); expect(JSON.stringify(r)).not.toContain("Infinity");
  });
  it("compara recorrência em pontos percentuais", () => {
    const dados = [pedido("antigo", { data: "2026-01-01" }), pedido("marco", { data: "2026-06-01" }), pedido("ago", { data: "2026-08-01", clienteId: "segundo" }), pedido("set", { data: "2026-09-01" })];
    const r = montarResultadoBi(dados, { de: "2026-09-01", ate: "2026-09-30", comparacao: "anterior" }, permissoes, agora); expect(r.variacoes.recorrencia.unidade).toBe("p.p.");
  });
  it("conserva lacuna entre histórico e início nativo e indica cobertura parcial do mês", () => {
    const fontes = [pedido("historico", { origem: "historico", status: "HISTORICO", fonteHistorica: true, data: "2026-09-30" }), pedido("nativo", { data: "2026-10-14" })];
    const r = montarResultadoBi(fontes, { de: "2026-09-30", ate: "2026-10-15", agrupamento: "dia" }, permissoes, agora);
    expect(r.serie.find(s => s.de === "2026-10-05")).toMatchObject({ vendas: null, pedidos: null, coberto: false });
    expect(r.serie.find(s => s.de === "2026-10-15")).toMatchObject({ vendas: 0, pedidos: 0, coberto: true });
    const mensal = montarResultadoBi(fontes, { de: "2026-10-01", ate: "2026-10-15" }, permissoes, agora);
    expect(mensal.serie[0]).toMatchObject({ vendas: 110, coberto: true, parcial: true });
  });
  it("não compara período que termina depois da cobertura conhecida", () => {
    const r = montarResultadoBi([pedido("antigo", { data: "2026-01-01" }), pedido("setembro"), pedido("outubro", { data: "2026-10-14" })], { de: "2026-10-01", ate: "2026-10-31", comparacao: "anterior" }, permissoes, agora);
    expect(r.variacoes.vendas.estado).toBe("sem-base");
  });
  it("datas civis respeitam São Paulo e não substituem entrega ausente", () => {
    expect(normalizarFiltrosBi({}, new Date("2026-01-01T02:59:59Z"))).toMatchObject({ de: "2025-01-01", ate: "2025-12-31" });
    expect(inicioDiaNoFuso("2026-09-30", "America/Sao_Paulo").toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(inicioDiaNoFuso(somarDias("2026-09-30", 1), "America/Sao_Paulo").toISOString()).toBe("2026-10-01T03:00:00.000Z");
    const r = montarResultadoBi([pedido("sem-data")], { ...filtros, baseData: "entrega" }, permissoes, agora); expect(r.indicadores.pedidos).toBe(0); expect(r.cobertura.pedidosSemData).toBe(1);
    expect(() => normalizarFiltrosBi({ de: "2026-02-30" }, agora)).toThrow();
  });
  it("ano anterior trata 29 de fevereiro e anterior equivalente conserva duração", () => {
    expect(periodoComparacaoBi(normalizarFiltrosBi({ de: "2024-02-29", ate: "2024-02-29", comparacao: "ano-anterior" }, agora))).toEqual({ de: "2023-02-28", ate: "2023-02-28" });
    expect(periodoComparacaoBi(normalizarFiltrosBi({ de: "2026-09-01", ate: "2026-09-30", comparacao: "anterior" }, agora))).toEqual({ de: "2026-08-02", ate: "2026-08-31" });
  });
  it("detalhes paginados e exportação completa reconciliam receita sem carregar base no DTO", () => {
    const fontes = Array.from({ length: 61 }, (_, n) => pedido(String(n)));
    const r = montarResultadoBi(fontes, filtros, permissoes, agora); expect(r.pedidos.linhas).toHaveLength(25); expect(r.pedidos.total).toBe(61);
    const completo = montarResultadoBi(fontes, filtros, permissoes, agora, { exportacao: true }); expect(completo.pedidos.linhas).toHaveLength(61); expect(completo.pedidos.linhas.reduce((n, p) => n + (p.receita ?? 0), 0)).toBe(completo.indicadores.vendas); expect(exportarBiCsv(completo).split("\r\n").filter(l => /^"\d+";"2026-09-10"/u.test(l))).toHaveLength(61);
  });
  it("esconde identificadores nominais e custos sem permissão, inclusive na exportação", () => {
    const r = montarResultadoBi([pedido("1", { custoEntrega: "987.65" })], filtros, { contatos: false, custos: false }, agora);
    expect(r.clientes.linhas).toEqual([]); expect(r.opcoes.clientes).toEqual([]); expect(r.pedidos.linhas[0].cliente).toBeNull(); expect(r.rentabilidade.custoEntrega).toBeNull(); expect(exportarBiCsv(r)).not.toContain("Comprador sintético"); expect(exportarBiCsv(r)).not.toContain("987,65");
  });
  it("oportunidade de recompra usa data final e intervalo explícito ajustável", () => {
    const r = montarResultadoBi([pedido("antigo", { data: "2026-06-01" }), pedido("recente", { data: "2026-09-20", clienteId: "recente" })], { ...filtros, aba: "clientes", somenteSemRecompra: true, diasSemRecompra: 60 }, permissoes, agora);
    expect(r.clientes.linhas).toHaveLength(1); expect(r.clientes.linhas[0].id).toBe("comprador-1"); expect(r.oportunidades.semRecompra).toBe(1);
  });
  it("não transforma ajuste misto em receita de produtos e preserva a base conhecida separada", () => {
    const conhecido = pedido("conhecido", { clienteId: "cliente-conhecido", itens: [{ id: "outro", produtoId: "produto-conhecido", nome: "Produto conhecido", unidade: "UN", quantidade: "1", receita: "80", categorias: [] }], receita: "80", custoEntrega: "5" });
    const incerto = pedido("incerto", { reducaoSemComponente: "20", frete: "20", custoEntrega: "7" });
    const r = montarResultadoBi([conhecido, incerto], filtros, permissoes, agora);
    expect(r.indicadores).toMatchObject({ vendas: null, ticket: null, pedidos: 2, frete: null });
    expect(r.cobertura).toMatchObject({ pedidosComReducaoSemComponente: 1, reducaoComercialSemComponente: 20, pedidosComReceitaApurada: 1, vendasProdutosConhecidas: 80 });
    expect(r.produtos.linhas.find(p => p.id === "produto-1")).toMatchObject({ receita: null, ticket: null, participacao: null });
    expect(r.produtos.linhas.find(p => p.id === "produto-conhecido")?.receita).toBe(80);
    expect(r.clientes.linhas.find(c => c.id === "comprador-1")).toMatchObject({ valor: null, ticket: null });
    expect(r.cobertura).toMatchObject({ custosEntrega: 2, entregasComFreteECusto: 1, pedidosComFreteApurado: 1, freteCobradoConhecido: 10 });
    expect(r.regioes[0]).toMatchObject({ frete: null, custo: 12, custosConhecidos: 2 });
    expect(r.rentabilidade).toMatchObject({ freteCoberto: 10, custoEntrega: 5, subsidio: -5 });
    expect(r.serie.find(s => s.de.startsWith("2026-09"))?.vendas).toBeNull();
    expect(exportarBiCsv(r)).toContain('"Faturamento";"Não apurado"');
    expect(exportarBiCsv(r)).toContain('"Receita reconciliada";"Não apurado"');
    expect(exportarBiCsv(r)).toContain('"Frete";"Não apurado"');
  });
  it("comparação preserva zero em dias cobertos e sem vendas", () => {
    const r = montarResultadoBi([pedido("inicio", { data: "2026-01-01" }), pedido("setembro", { data: "2026-09-01" })], { de: "2026-09-01", ate: "2026-09-02", agrupamento: "dia", comparacao: "anterior" }, permissoes, agora);
    expect(r.serie).toHaveLength(2);
    expect(r.serie[0]).toMatchObject({ vendas: 110, anteriorVendas: 0, anteriorPedidos: 0 });
    expect(r.serie[1]).toMatchObject({ vendas: 0, anteriorVendas: 0, anteriorPedidos: 0 });
    expect(r.variacoes.vendas.estado).toBe("sem-base");
  });
  it.each(["=HYPERLINK(x)", "+SUM(1)", "@SUM(1)", "-cmd", "  =A1", "\t=A1", "\rtexto"])("CSV protege texto contra fórmula: %j", texto => { expect(celulaCsvBi(texto).startsWith('"\'')).toBe(true); });
  it("CSV conserva números negativos conhecidos como valores numéricos", () => { expect(celulaCsvBi(-20.15)).toBe("-20,15"); expect(celulaCsvBi('Kit "A"; B')).toBe('"Kit ""A""; B"'); });
});
