import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), transaction: vi.fn(), canais: vi.fn(), clientes: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { consultarBiVendas, exportarConsultaBiCsv } from "@/lib/vendas/bi-consultas";
import { exportarBiCsv } from "@/lib/vendas/bi-csv";
import { entregaProjetadaSintetica } from "./entregas-historicas.fixture";

const filtros = { de: "2026-01-01", ate: "2026-09-30" }, permissoes = { contatos: true, custos: true, exportar: true };
function fonte(campos: Record<string, unknown> = {}) {
  return { id: "pedido-sintetico", numero: 100, status: "CONFIRMADO", origem: "INTERNO", referenciaOrigem: null, referenciaEstabelecimento: null, referenciaPedido: null, createdAt: new Date("2026-09-30T22:00:00Z"), entregueEm: null, updatedAt: new Date("2026-10-01T12:00:00Z"), fonteAtualizadaEm: null, atualizadoComercialEm: null, clienteId: "comprador-sintetico", clienteNome: "Comprador sintético", canalId: "site", canalNomeSnapshot: "Site", atendimento: "ENTREGA", subtotal: "100.00", desconto: "15.00", frete: "10.00", outrosCustos: "0.00", total: "95.00", custoEntrega: null, cidade: "Cidade sintética", bairro: "Bairro", uf: "SP", coberturaEntrega: "NAO_VALIDADA", teste: false, itens: [{ id: "item-sintetico", produtoId: "produto-1", nome: "Kit sintético", unidade: "KIT", quantidade: "1", receita: "85.00", categorias: [] }], historico: null, reducoes: "0.00", ...campos };
}
beforeEach(() => { mocks.query.mockReset(); mocks.clientes.mockReset(); mocks.clientes.mockResolvedValue([{ id: "comprador-sintetico", nome: "Comprador sintético", unificadoEmId: null }]); mocks.canais.mockResolvedValue([{ id: "site", nome: "SITE" }, { id: "ifood", nome: "IFOOD" }, { id: "gf", nome: "GIULIANA FLORES" }]); mocks.execute.mockReset(); mocks.execute.mockResolvedValue(0); mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: mocks.query, $executeRaw: mocks.execute, canalVenda: { findMany: mocks.canais }, clienteVenda: { findMany: mocks.clientes } })); });
describe("BI: consulta de fontes e proteção servidor", () => {
  it("projeta data da compra civil para filtros e CSV sem reescrever criação ou histórico", async () => {
    const origem = fonte({ dataCompra: new Date("2026-02-01T00:00:00Z"), createdAt: new Date("2026-10-20T16:00:00Z") });
    mocks.query.mockResolvedValue([origem]);
    const selecionado = { de: "2026-02-01", ate: "2026-02-01" };
    const r = await consultarBiVendas(selecionado, permissoes);
    expect(r.indicadores.pedidos).toBe(1); expect(r.pedidos.linhas[0].data).toBe("2026-02-01");
    expect(await exportarConsultaBiCsv(selecionado, permissoes)).toContain('"2026-02-01"');
    const sql = mocks.query.mock.calls[0][0].join("");
    expect(sql).toContain('p."dataCompra" IS NULL AND p."createdAt"<');
    expect(sql).toContain('OR p."dataCompra"<');
    expect(origem.createdAt.toISOString()).toBe("2026-10-20T16:00:00.000Z");
  });
  it("consulta total_original textual comprovado sem usar Pedido.total ou calcular pela diferença", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", total: "999", historico: { freteOriginal: "-15", totais: { liquido_itens: "85", total_original: "70" } } })]);
    const r = await consultarBiVendas({ ...filtros, cliente: "comprador-sintetico", aba: "clientes" }, permissoes);
    expect(r.indicadores.vendas).toBe(85); expect(r.cobertura).toMatchObject({ totalOriginalHistorico: 70, pedidosTotalOriginalHistorico: 1, ajustesFrete: -15 });
  });
  it.each([undefined, null, "", 0])("não infere total original histórico ausente ou sem comprovação textual: %s", async total_original => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", total: "70", historico: { freteOriginal: "-15", totais: { liquido_itens: "85", total_original } } })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores.vendas).toBe(85); expect(r.cobertura).toMatchObject({ totalOriginalHistorico: null, pedidosTotalOriginalHistorico: 1 });
  });
  it("oferece o cadastro do lançamento de pedidos mesmo sem vendas no canal e conserva o histórico sem canal", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ canalId: null, canalNomeSnapshot: null })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.opcoes.canais).toEqual([{ id: "site", nome: "Site" }, { id: "ifood", nome: "iFood" }, { id: "gf", nome: "GF" }, { id: "nao-identificado", nome: "Não identificado" }]);
    expect(mocks.canais).toHaveBeenCalledWith({ select: { id: true, nome: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    expect(r.cobertura.pedidosSemCanal).toBe(1);
    mocks.query.mockResolvedValueOnce([fonte()]);
    const semVendas = await consultarBiVendas({ ...filtros, canal: "gf" }, permissoes);
    expect(semVendas.indicadores.pedidos).toBe(0); expect(semVendas.opcoes.canais.map(c => c.nome)).toContain("GF");
  });
  it("usa fotografia ReadOnly e RepeatableRead, limites de São Paulo e linhas já líquidas", async () => {
    mocks.query.mockResolvedValueOnce([fonte()]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores.vendas).toBe(95); expect(r.reconciliacao.confere).toBe(true);
    expect(mocks.execute.mock.calls[0][0].join("")).toBe("SET TRANSACTION READ ONLY");
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "RepeatableRead" });
    expect(mocks.query.mock.calls[0]).toContainEqual(new Date("2026-10-01T03:00:00Z"));
    expect(mocks.execute).toHaveBeenCalledTimes(1); expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("extrai bruto histórico, líquido e frete por contratos preservados sem desconto duplo", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: "42", numero: -42, subtotal: "120", desconto: "20", frete: "0", atendimento: null, canalId: null, canalNomeSnapshot: null,
      historico: { status: "Retirado", regraIdentidade: "nome_email_exatos", totais: { liquido_itens: "85.00", valor_historico_nao_detalhado: "5.00", frete_ajuste_original: "-15.00", diferenca_total_apos_nao_detalhado: "54.00" }, freteOriginal: "-15.00", parcelaNaoDetalhada: "5.00" } })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 90, frete: 0, compradores: 1 }); expect(r.cobertura).toMatchObject({ ajustesFrete: -15, ajustesComerciaisNaoClassificados: 54, pedidosComAjusteComercial: 1, modalidadeNaoInformada: 1 }); expect(r.pedidos.linhas[0].numero).toBe("42"); expect(r.reconciliacao.confere).toBe(true);
  });
  it("não identifica comprador histórico sem FK mesmo quando o snapshot tem nome", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ clienteId: null, origem: "HISTORICO_LEGADO", status: "HISTORICO", historico: { regraIdentidade: "nome_email_exatos", totais: { liquido_itens: "85" } } })]);
    const r = await consultarBiVendas(filtros, permissoes); expect(r.indicadores.compradores).toBe(0); expect(r.cobertura.pedidosSemCliente).toBe(1);
  });
  it("admite o vínculo cadastral explícito PJ histórico sem exigir antiga regra de importação", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", clienteTipo: "PJ", clienteNome: "Empresa sintética", historico: { regraIdentidade: "identidade_por_documento_legado", totais: { liquido_itens: "85", desconto_itens: "20" } } })]);
    const r = await consultarBiVendas({ ...filtros, tipoCliente: "PJ", aba: "clientes" }, permissoes);
    expect(r.indicadores).toMatchObject({ compradores: 1, descontos: 20 });
    expect(r.clientes.linhas[0]).toMatchObject({ nome: "Empresa sintética", tipo: "PJ" });
    const sql = mocks.query.mock.calls[0][0].join(""); expect(sql).toContain('c.id AS "clienteId"'); expect(sql).toContain('WITH RECURSIVE cliente_atual'); expect(sql).toContain('WHERE "unificadoEmId" IS NULL'); expect(sql).not.toContain("HISTORICO_CLIENTE_CORRIGIDO");
  });
  it("mantém opções do cadastro sem vendas e converte filtro de alias para raiz na consulta e CSV", async () => {
    mocks.clientes.mockResolvedValue([
      { id: "comprador-sintetico", nome: "Comprador sintético", unificadoEmId: null },
      { id: "alias", nome: "Contato antigo", unificadoEmId: "comprador-sintetico" },
      { id: "sem-vendas", nome: "Empresa sem vendas", unificadoEmId: null },
    ]);
    mocks.query.mockResolvedValue([fonte()]);
    const r = await consultarBiVendas({ ...filtros, cliente: "alias" }, permissoes);
    expect(r.filtros.cliente).toBe("comprador-sintetico"); expect(r.indicadores.pedidos).toBe(1);
    expect(r.opcoes.clientes).toEqual([{ id: "comprador-sintetico", nome: "Comprador sintético" }, { id: "sem-vendas", nome: "Empresa sem vendas" }]);
    const csv = await exportarConsultaBiCsv({ ...filtros, cliente: "alias" }, permissoes);
    expect(csv).toContain('""cliente"":""comprador-sintetico""'); expect(csv).not.toContain("Contato antigo");
    const inexistente = await consultarBiVendas({ ...filtros, cliente: "inexistente" }, permissoes);
    expect(inexistente.indicadores.pedidos).toBe(0); expect(inexistente.filtros.cliente).toBe("inexistente");
  });
  it("expõe desconto já incorporado uma vez como informação, sem somar rateio dos itens", async () => {
    mocks.query.mockResolvedValueOnce([fonte()]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 95, descontos: 15 }); expect(r.cobertura).toMatchObject({ pedidosComDescontoApurado: 1, descontosConhecidos: 15 });
  });
  it("não inventa desconto histórico zero quando a fonte do desconto está ausente", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", desconto: "0", historico: { totais: { liquido_itens: "85" } } })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores.descontos).toBeNull(); expect(r.cobertura.pedidosComDescontoApurado).toBe(0);
  });
  it("projetar CEP não usa cobrança nem trata cobertura comercial como confirmação geográfica", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ cep: "12345-678", coberturaEntrega: "CONFIRMADA" })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.cobertura).toMatchObject({ confirmadas: 0, aproximadas: 0, localizadas: 1 });
    const sql = mocks.query.mock.calls[0][0].join(""); expect(sql).toContain('p."enderecoSnapshot"->>\'cep\''); expect(sql).not.toContain("cobrancaSnapshot");
  });
  it("Shipping histórico válido habilita entrega e CEP sem alterar frete, vendas ou endereço nativo", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", referenciaPedido: "55", atendimento: null, historico: { regraIdentidade: "nome_email_exatos", freteOriginal: "10", totais: { liquido_itens: "85", desconto_itens: "15" }, entrega: entregaProjetadaSintetica() } })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 95, frete: 10 }); expect(r.cobertura).toMatchObject({ entregas: 1, modalidadeNaoInformada: 0, confirmadas: 0 });
    expect(r.regioes[0].nome).toBe("Bairro não informado · São Paulo / SP"); expect(JSON.stringify(r)).not.toContain("Rua Sintética"); expect(JSON.stringify(r)).not.toContain("Destinatária fictícia");
  });
  it.each(["25", "-5"])("Shipping vazio é retirada sem frete BI, preserva frete original %s e ajustes", async freteOriginal => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", referenciaPedido: "55", historico: { freteOriginal, totais: { liquido_itens: "85", desconto_itens: "15" }, entrega: entregaProjetadaSintetica(null) } })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 85, frete: 0 }); expect(r.pedidos.linhas[0]).toMatchObject({ modalidade: "RETIRADA", frete: 0 });
    expect(r.cobertura).toMatchObject({ entregas: 0, retiradasSemEndereco: 1, freteOriginalRetiradas: Number(freteOriginal), ajustesFrete: Number(freteOriginal) < 0 ? Number(freteOriginal) : 0 }); expect(r.regioes).toEqual([]);
  });
  it("Shipping preenchido sem dados postais não vira retirada nem perde seu frete", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ origem: "HISTORICO_LEGADO", status: "HISTORICO", referenciaPedido: "55", historico: { freteOriginal: "20", totais: { liquido_itens: "85", desconto_itens: "15" }, entrega: entregaProjetadaSintetica("Campo incompleto") } })]);
    const r = await consultarBiVendas(filtros, permissoes); expect(r.indicadores.frete).toBe(20); expect(r.cobertura).toMatchObject({ entregas: 1, semEndereco: 1, retiradasSemEndereco: 0 });
  });
  it("redução comercial existente é abatida uma vez, não repetida em cada item", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ reducoes: "25.00", frete: "0.00", total: "85.00" })]);
    const r = await consultarBiVendas(filtros, permissoes); expect(r.indicadores.vendas).toBe(60); expect(r.produtos.linhas.find(p => p.id === "sem-detalhamento")?.receita).toBe(-25); expect(r.reconciliacao.confere).toBe(true);
  });
  it.each([
    { frete: "10.00", outrosCustos: "0.00", total: "95.00" },
    { frete: "0.00", outrosCustos: "10.00", total: "95.00" },
    { frete: "0.00", outrosCustos: "0.00", total: "86.00" },
  ])("não atribui redução de componente incerto aos produtos: %j", async campos => {
    mocks.query.mockResolvedValueOnce([fonte({ ...campos, reducoes: "10.00" })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: null, ticket: null, pedidos: 1 });
    expect(r.cobertura).toMatchObject({ pedidosComReducaoSemComponente: 1, reducaoComercialSemComponente: 10, pedidosComReceitaApurada: 0, vendasProdutosConhecidas: 0 });
    expect(r.pedidos.linhas[0]).toMatchObject({ receita: null, ajusteNaoClassificado: 10 });
    expect(r.produtos.linhas.find(p => p.id === "produto-1")?.receita).toBeNull();
    expect(r.reconciliacao).toMatchObject({ vendas: null, confere: false, naoApurado: true });
  });
  it("usa atualização dos tratamentos, inclusive cancelados, e das liberações de crédito", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ atualizadoComercialEm: new Date("2026-10-03T12:00:00Z") })]);
    const r = await consultarBiVendas(filtros, permissoes); expect(r.atualizadoEm).toBe("2026-10-03T12:00:00.000Z");
    const sql = mocks.query.mock.calls[0][0].join("");
    expect(sql).toContain('max(t."updatedAt")'); expect(sql).toContain('max(m."createdAt")');
    expect(sql.slice(sql.indexOf("GREATEST"), sql.indexOf('AS "atualizadoComercialEm"'))).toContain('c."updatedAt"');
    expect(sql.slice(sql.indexOf("GREATEST"), sql.indexOf('AS "atualizadoComercialEm"'))).not.toContain("t.status");
  });
  it("devolução de componente incerto não afirma frete líquido nem subsídio", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ subtotal: "100.00", desconto: "0.00", total: "120.00", frete: "20.00", reducoes: "20.00", custoEntrega: "7.00",
      itens: [{ id: "item", produtoId: "produto-1", nome: "Produto", unidade: "UN", quantidade: "1", receita: "100.00", categorias: [] }] })]);
    const r = await consultarBiVendas(filtros, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: null, frete: null, ticket: null });
    expect(r.pedidos.linhas[0]).toMatchObject({ receita: null, frete: null, ajusteNaoClassificado: 20 });
    expect(r.regioes[0]).toMatchObject({ frete: null, custo: 7, custosConhecidos: 1 });
    expect(r.cobertura).toMatchObject({ pedidosComFreteApurado: 0, freteCobradoConhecido: 0, custosEntrega: 1, entregasComFreteECusto: 0 });
    expect(r.rentabilidade).toMatchObject({ freteCoberto: null, custoEntrega: null, subsidio: null });
    expect(r.oportunidades.entregasComCusto).toBe(0);
    expect(exportarBiCsv(r)).toContain('"Frete";"Não apurado"');
  });
  it("nega filtros nominais e consultas de custos antes de ler o banco", async () => {
    await expect(consultarBiVendas({ ...filtros, cliente: "alvo" }, { contatos: false, custos: false })).rejects.toMatchObject({ status: 403 });
    await expect(consultarBiVendas({ ...filtros, aba: "clientes", tipoCliente: "PJ" }, { contatos: false, custos: false })).rejects.toMatchObject({ status: 403 });
    await expect(consultarBiVendas({ ...filtros, aba: "clientes" }, { contatos: false, custos: false })).rejects.toMatchObject({ status: 403 });
    await expect(consultarBiVendas({ ...filtros, aba: "rentabilidade" }, { contatos: true, custos: false })).rejects.toMatchObject({ status: 403 });
    await expect(exportarConsultaBiCsv(filtros, { contatos: true, custos: true, exportar: false })).rejects.toMatchObject({ status: 403 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("exporta toda a seleção em uma só fotografia, não apenas a primeira página", async () => {
    mocks.query.mockResolvedValueOnce(Array.from({ length: 51 }, (_, n) => fonte({ id: `p-${n}`, numero: n + 1 })));
    const csv = await exportarConsultaBiCsv(filtros, permissoes);
    expect(csv.split("\r\n").filter(l => /^"\d+";"2026-09-30";/u.test(l))).toHaveLength(51); expect(csv).toContain('"Faturamento";4845'); expect(csv).toContain('"Evolução das vendas"'); expect(csv).toContain('"ajustesComerciaisNaoClassificados";0'); expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
  it("não retorna nomes nem custos quando a permissão não permite, mesmo com fonte completa", async () => {
    mocks.query.mockResolvedValueOnce([fonte({ custoEntrega: "25.00" })]);
    const r = await consultarBiVendas(filtros, { contatos: false, custos: false }); expect(JSON.stringify(r)).not.toContain("Comprador sintético"); expect(r.regioes[0].custo).toBeNull(); expect(r.cobertura.custosEntrega).toBeNull();
    expect(mocks.clientes).not.toHaveBeenCalled(); expect(r.opcoes.clientes).toEqual([]);
  });
});
