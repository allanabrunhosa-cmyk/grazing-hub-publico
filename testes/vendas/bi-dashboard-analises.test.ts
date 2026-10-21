import { describe, expect, it } from "vitest";
import { montarResultadoBi, normalizarFiltrosBi, type PedidoFonteBi } from "@/lib/vendas/bi-dominio";
import { entradaBiDaUrl } from "@/lib/vendas/bi-url";
import { exportarBiCsv } from "@/lib/vendas/bi-csv";

const agora = new Date("2026-10-15T15:00:00Z"), permissoes = { contatos: true, custos: true, exportar: true };
const periodo = { de: "2026-01-01", ate: "2026-09-30" };
function pedido(id: string, alteracoes: Partial<PedidoFonteBi> = {}): PedidoFonteBi {
  return { id, numero: id, status: "CONFIRMADO", origem: "nativo", identidade: null, data: "2026-09-10", dataEntrega: null,
    atualizadoEm: agora.toISOString(), clienteId: `cliente-${id}`, clienteNome: `Cliente ${id}`, clienteIdentificavel: true, clienteTipo: "PF",
    canalId: "site", canalNome: "Site", modalidade: "ENTREGA", regiao: "Centro · Cidade / SP", bairro: "Centro", cidade: "Cidade", uf: "SP", cep: "01234001", enderecoEstado: "nao-validado",
    itens: [{ id: `i-${id}`, produtoId: `produto-${id}`, nome: `Produto ${id}`, unidade: "KIT", quantidade: "1", receita: "100", categorias: [] }],
    receita: "100", naoDetalhado: "0", descontos: "10", frete: "12", ajusteFrete: "0", custoEntrega: null, statusHistorico: null, fonteHistorica: false, teste: false, ...alteracoes };
}

describe("Dashboard: definições e detalhamento", () => {
  it("separa o total original histórico do faturamento e filtra a mesma coorte por cliente e período", () => {
    const historico = (id: string, campos: Partial<PedidoFonteBi>) => pedido(id, { origem: "historico", status: "HISTORICO", fonteHistorica: true, clienteId: "cliente-A", ...campos });
    const fontes = [historico("1", { totalOriginalHistorico: "80", frete: "0", ajusteFrete: "-20" }), historico("2", { totalOriginalHistorico: "110", frete: "10" }),
      pedido("nativo", { clienteId: "cliente-A", totalOriginalHistorico: "999" }), historico("outro-cliente", { clienteId: "cliente-B", totalOriginalHistorico: "900" }), historico("fora-do-periodo", { data: "2026-09-09", totalOriginalHistorico: "50" })];
    const r = montarResultadoBi(fontes, { de: "2026-09-10", ate: "2026-09-10", cliente: "cliente-A", aba: "clientes" }, permissoes, agora);
    expect(r.indicadores).toMatchObject({ pedidos: 3, vendas: 322 });
    expect(r.cobertura).toMatchObject({ pedidosTotalOriginalHistorico: 2, totalOriginalHistorico: 190, ajustesFrete: -20 });
    const csv = exportarBiCsv(r); expect(csv).toContain('"Faturamento";322'); expect(csv).toContain('"Total original na fonte histórica";190'); expect(csv).toContain('"Pedidos históricos na seleção";2');
    expect(csv).toContain('"totalOriginalHistorico";190'); expect(csv).toContain('"Ajustes de frete a classificar";-20');
  });
  it("não inventa total original parcial ou ausente e mantém zero comprovado", () => {
    const historico = pedido("h", { origem: "historico", status: "HISTORICO", fonteHistorica: true, totalOriginalHistorico: "0" });
    const calcular = (fontes: PedidoFonteBi[]) => montarResultadoBi(fontes, periodo, permissoes, agora);
    expect(calcular([historico]).cobertura).toMatchObject({ pedidosTotalOriginalHistorico: 1, totalOriginalHistorico: 0 });
    const incompleto = calcular([historico, { ...historico, id: "sem-total", totalOriginalHistorico: null }]);
    expect(incompleto.cobertura).toMatchObject({ pedidosTotalOriginalHistorico: 2, totalOriginalHistorico: null });
    expect(exportarBiCsv(incompleto)).toContain('"Total original na fonte histórica";"Não apurado"');
    expect(calcular([pedido("nativo")]).cobertura).toMatchObject({ pedidosTotalOriginalHistorico: 0, totalOriginalHistorico: null });
    expect(calcular([]).cobertura).toMatchObject({ pedidosTotalOriginalHistorico: 0, totalOriginalHistorico: null });
  });
  it("informa os descontos sem deduzi-los novamente do faturamento", () => {
    const r = montarResultadoBi([pedido("1"), pedido("2", { descontos: "5.50" })], periodo, permissoes, agora);
    expect(r.indicadores).toMatchObject({ vendas: 224, descontos: 15.5, pedidos: 2, ticket: 112 });
    expect(r.reconciliacao.confere).toBe(true);
    const csv = exportarBiCsv(r); expect(csv).toContain('"Faturamento";224'); expect(csv).toContain('"Descontos";15,5');
    const parcial = montarResultadoBi([pedido("1"), pedido("2", { descontos: null })], periodo, permissoes, agora);
    expect(parcial.indicadores.descontos).toBeNull(); expect(parcial.cobertura.descontosConhecidos).toBe(10);
    const semOutrasLacunas = montarResultadoBi([pedido("1", { descontos: null })], { de: "2026-09-10", ate: "2026-09-10" }, { contatos: true, custos: false }, agora);
    expect(semOutrasLacunas.cobertura.parcial).toBe(true); expect(semOutrasLacunas.cobertura.avisos.join(" ")).toContain("1 de 1 pedidos sem desconto comprovado");
  });

  it("calcula recompra pelos intervalos consecutivos e não usa pedidos futuros", () => {
    const fontes = [pedido("a1", { data: "2026-01-01", clienteId: "A" }), pedido("a2", { data: "2026-01-11", clienteId: "A" }), pedido("a3", { data: "2026-01-31", clienteId: "A" }),
      pedido("b1", { data: "2026-01-01", clienteId: "B" }), pedido("b2", { data: "2026-03-02", clienteId: "B" }),
      pedido("futuro", { data: "2026-10-01", clienteId: "A" }), pedido("sem-id", { clienteIdentificavel: false, clienteId: "A" })];
    const r = montarResultadoBi(fontes, periodo, permissoes, agora);
    expect(r.recompra).toEqual({ mediaDias: 30, clientes: 2, intervalos: 3 });
    expect(r.indicadores.recorrencia).toBe(100);
    expect(r.rankingClientes.find(c => c.id === "A")).toMatchObject({ compras: 3, valor: 336 });
    expect(montarResultadoBi([pedido("1")], periodo, permissoes, agora).recompra.mediaDias).toBeNull();
  });

  it("ordena o conjunto completo antes de paginar e exporta na mesma ordem", () => {
    const fontes = Array.from({ length: 51 }, (_, i) => pedido(String(i).padStart(2, "0"), { receita: String(i + 1), itens: [{ id: String(i), produtoId: String(i), nome: `Produto ${String(i).padStart(2, "0")}`, unidade: "KIT", quantidade: "1", receita: String(i + 1), categorias: [] }] }));
    const r = montarResultadoBi(fontes, { ...periodo, aba: "produtos", ordemProdutos: "nome", direcaoProdutos: "asc", pagina: 2 }, permissoes, agora);
    expect(r.produtos.linhas[0].nome).toBe("Produto 25"); expect(r.produtos.linhas).toHaveLength(25);
    expect(r.ranking[0].nome).toBe("Produto 50");
    const completo = montarResultadoBi(fontes, r.filtros, permissoes, agora, { exportacao: true });
    expect(completo.produtos.linhas).toHaveLength(51); expect(completo.produtos.linhas[0].nome).toBe("Produto 00");
    expect(exportarBiCsv(completo).indexOf('"Produto 00"')).toBeLessThan(exportarBiCsv(completo).indexOf('"Produto 50"'));
  });

  it("filtra PF/PJ e conta as opções sem usar o próprio tipo", () => {
    const fontes = [pedido("PF"), pedido("PJ", { clienteTipo: "PJ" }), pedido("nao", { clienteTipo: null })];
    const r = montarResultadoBi(fontes, { ...periodo, aba: "clientes", tipoCliente: "PJ" }, permissoes, agora);
    expect(r.clientes.linhas.map(c => c.tipo)).toEqual(["PJ"]);
    expect(r.tiposClientes).toEqual({ todos: 3, PF: 1, PJ: 1, naoInformado: 1 });
    expect(r.indicadores.pedidos).toBe(1);
    const csv = exportarBiCsv(r); expect(csv).toContain('"Cliente";"Tipo";"Pedidos"'); expect(csv).not.toContain('"Recorrente"');
    const fechado = montarResultadoBi(fontes, periodo, { contatos: false, custos: false }, agora);
    expect(fechado.rankingClientes).toEqual([]); expect(fechado.clientes.linhas).toEqual([]);
  });

  it("o ranking de clientes independe da página e respeita a coorte", () => {
    const fontes = Array.from({ length: 30 }, (_, n) => pedido(String(n), { receita: String(n + 1), naoDetalhado: String(n - 99) }));
    const r = montarResultadoBi(fontes, { ...periodo, pagina: 2 }, permissoes, agora);
    expect(r.rankingClientes).toHaveLength(5); expect(r.rankingClientes[0].id).toBe("cliente-29");
    expect(r.clientes.linhas).toHaveLength(5);
  });

  it("datas vazias removem limites e usam os extremos reais, como na DRE", () => {
    const fontes = [pedido("antigo", { data: "2025-12-30" }), pedido("atual")];
    const r = montarResultadoBi(fontes, { de: "", ate: "" }, permissoes, agora);
    expect(r.filtros).toMatchObject({ de: "", ate: "" });
    expect(r.periodoEfetivo).toEqual({ de: "2025-12-30", ate: "2026-09-10" }); expect(r.indicadores.pedidos).toBe(2);
    expect(r.reconciliacao.confere).toBe(true);
    expect(exportarBiCsv(r)).toContain('"Período";"2025-12-30";"2026-09-10"');
  });

  it("relatórios de CEP não promovem retirada e o mapa usa cada CEP real, sem centro arbitrário", () => {
    const fontes = [pedido("1"), pedido("2", { cep: "01234999" }), pedido("retirada", { modalidade: "RETIRADA" }), pedido("sem-cep", { cep: null })];
    const r = montarResultadoBi(fontes, { ...periodo, aba: "entregas", agrupamentoRegiao: "cep", cepDe: "01234000", cepAte: "01234999" }, permissoes, agora);
    expect(r.entregas.linhas).toHaveLength(1); expect(r.entregas.linhas[0].pedidos).toBe(2);
    expect(r.locaisEntrega.map(l => l.consulta)).toEqual(["CEP 01234-001, Cidade, SP, Brasil", "CEP 01234-999, Cidade, SP, Brasil"]);
    expect(r.locaisEntrega.every(l => l.precisao === "cep")).toBe(true);
    expect(JSON.stringify(r.locaisEntrega)).not.toContain("cliente-");
    const semBairro = montarResultadoBi([pedido("1", { bairro: null, regiao: "Cidade / SP" })], periodo, permissoes, agora);
    expect(semBairro.locaisEntrega[0]).toMatchObject({ precisao: "cep", consulta: "CEP 01234-001, Cidade, SP, Brasil" });
    expect(semBairro.regioes[0].nome).toContain("Bairro não informado");
  });

  it("valida e conserva ordenação, tipo e faixa de CEP na URL", () => {
    const entrada = entradaBiDaUrl({ ...periodo, aba: "clientes", ordemClientes: "compras", direcaoClientes: "asc", tipoCliente: "PJ", cepDe: "01234-000", cepAte: "01234999" });
    expect(normalizarFiltrosBi(entrada, agora)).toMatchObject({ ordemClientes: "compras", direcaoClientes: "asc", tipoCliente: "PJ", cepDe: "01234000" });
    expect(() => normalizarFiltrosBi({ ordemClientes: "documento" }, agora)).toThrow();
    expect(() => normalizarFiltrosBi({ cepDe: "123abc" }, agora)).toThrow();
  });
  it.each(["geral", "produtos", "entregas", "rentabilidade"] as const)("remove tipo de cliente fora da aba Clientes e valida o enum antes de limpar: %s", aba => {
    const entrada = entradaBiDaUrl({ ...periodo, aba, tipoCliente: "PJ", canal: "site", cepDe: "01234-000" });
    expect(normalizarFiltrosBi(entrada, agora)).toMatchObject({ aba, tipoCliente: "todos", canal: "site", cepDe: "01234000" });
    expect(() => normalizarFiltrosBi(entradaBiDaUrl({ ...periodo, aba, tipoCliente: "INEXISTENTE" }), agora)).toThrow("Há um filtro inválido na consulta.");
  });

  it("normaliza a grafia da região sem misturar cidades ou perder pedidos ao filtrar", () => {
    const fontes = [pedido("1"), pedido("2", { regiao: "centro · cidade / SP", bairro: "centro", cidade: "cidade" }), pedido("3", { regiao: "Centro · Outra / SP", cidade: "Outra" })];
    const r = montarResultadoBi(fontes, periodo, permissoes, agora);
    expect(r.regioes).toHaveLength(2); expect(r.regioes[0].pedidos).toBe(2); expect(r.opcoes.regioes).toHaveLength(2);
    expect(r.locaisEntrega[0].pedidos).toBe(2);
    const filtrado = montarResultadoBi(fontes, { ...periodo, regiao: r.regioes[0].nome }, permissoes, agora);
    expect(filtrado.indicadores.pedidos).toBe(2); expect(filtrado.reconciliacao.confere).toBe(true);
  });
});
