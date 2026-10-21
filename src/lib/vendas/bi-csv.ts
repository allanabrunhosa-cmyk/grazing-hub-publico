import type { ResultadoBi } from "./bi-types";

/** Textos permanecem texto mesmo com espaços, controles ou prefixos de fórmula. */
export function celulaCsvBi(v: unknown): string {
  if (v === null || v === undefined) return '"Não apurado"';
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : '"Não apurado"';
  let texto = String(v).replace(/\u0000/gu, "");
  if (/^[\s\u0001-\u001f]*[=+@-]/u.test(texto) || /^[\t\r\n]/u.test(texto)) texto = "'" + texto;
  return `"${texto.replace(/"/gu, '""')}"`;
}
export function exportarBiCsv(r: ResultadoBi): string {
  const linhas: unknown[][] = [
    ["Dashboard — Grazing HUB"], ["Período", r.periodoEfetivo.de, r.periodoEfetivo.ate], ["Fuso", "America/Sao_Paulo"],
    ["Atualização da fonte", r.atualizadoEm], ["Consulta", r.consultadoEm], ["Visualização", r.filtros.aba],
    ["Filtros", JSON.stringify(r.filtros)], ["Cobertura", ...r.cobertura.avisos], ...r.definicoes.map(d => ["Definição", d]), [],
    ["Faturamento", r.indicadores.vendas], ["Receita de produtos (ranking completo)", r.reconciliacao.ranking], ["Frete na reconciliação", r.reconciliacao.frete], ["Descontos", r.indicadores.descontos], ["Pedidos", r.indicadores.pedidos], ["Ticket médio", r.indicadores.ticket],
    ["Clientes compradores", r.indicadores.compradores], ["Clientes recorrentes (%)", r.indicadores.recorrencia],
    ["Tempo médio de recompra (dias)", r.recompra.mediaDias], ["Intervalos de recompra", r.recompra.intervalos],
    ["Frete", r.indicadores.frete], ["Ajustes de frete a classificar", r.cobertura.ajustesFrete],
    ["Pedidos históricos na seleção", r.cobertura.pedidosTotalOriginalHistorico], ["Total original na fonte histórica", r.cobertura.totalOriginalHistorico],
    ["Receita reconciliada", r.reconciliacao.naoApurado ? "Não apurado" : r.reconciliacao.confere ? "Sim" : "Não"], [],
  ];
  linhas.push(["Cobertura dos dados", "Valor"]);
  for (const [campo, valor] of Object.entries(r.cobertura)) {
    if (campo === "avisos" || !r.permissoes.custos && ["custosEntrega", "custosProdutos"].includes(campo)) continue;
    linhas.push([campo, typeof valor === "boolean" ? valor ? "Sim" : "Não" : valor]);
  }
  linhas.push([]);
  if (r.filtros.aba === "produtos") { linhas.push(["Produto", "Unidade", "Receita líquida", "Quantidade", "Participação (%)", "Pedidos", "Ticket dos pedidos"]); for (const p of r.produtos.linhas) linhas.push([p.nome, p.unidade, p.receita, p.quantidade, p.participacao, p.pedidos, p.ticket]); }
  else if (r.filtros.aba === "clientes" && r.permissoes.contatos) { linhas.push(["Cliente", "Tipo", "Pedidos", "Faturamento", "Ticket", "Primeira compra", "Última compra", "Dias sem compra"]); for (const c of r.clientes.linhas) linhas.push([c.nome, c.tipo === "PF" ? "Física" : c.tipo === "PJ" ? "Jurídica" : "Não informado", c.compras, c.valor, c.ticket, c.primeira, c.ultima, c.diasSemCompra]); }
  else if (r.filtros.aba === "entregas") { linhas.push(["Região", "Entregas", "Frete", ...(r.permissoes.custos ? ["Custo conhecido", "Entregas com custo"] : []), "Destinos confirmados", "Aproximados", "Não validados"]); for (const e of r.entregas.linhas) linhas.push([e.nome, e.pedidos, e.frete, ...(r.permissoes.custos ? [e.custo, e.custosConhecidos] : []), e.confirmados, e.aproximados, e.naoValidados]); }
  else if (r.filtros.aba === "rentabilidade" && r.permissoes.custos) linhas.push(["Custo de produção", r.rentabilidade.custoProdutos], ["Margem", r.rentabilidade.margem], ["Base dos custos", r.rentabilidade.baseCustos], ["Frete com custo conhecido", r.rentabilidade.freteCoberto], ["Custo de entrega conhecido", r.rentabilidade.custoEntrega], ["Subsídio na base conhecida", r.rentabilidade.subsidio]);
  else {
    linhas.push(["Evolução das vendas"], ["De", "Até", "Faturamento", "Pedidos", "Faturamento anterior", "Pedidos anteriores", "Cobertura"]);
    for (const s of r.serie) linhas.push([s.de, s.ate, s.vendas, s.pedidos, s.anteriorVendas, s.anteriorPedidos, s.coberto ? s.parcial ? "Parcial" : "Disponível" : "Sem cobertura"]);
    linhas.push([], ["Produtos que mais vendem"], ["Produto", "Unidade", "Receita líquida", "Quantidade", "Participação (%)", "Pedidos", "Ticket dos pedidos"]);
    for (const p of r.ranking) linhas.push([p.nome, p.unidade, p.receita, p.quantidade, p.participacao, p.pedidos, p.ticket]);
    linhas.push([], ["Categorias mais vendidas (vínculos podem se sobrepor)"], ["Categoria", "Receita dos itens", "Pedidos"]);
    for (const c of r.rankingCategorias) linhas.push([c.nome, c.receita, c.pedidos]);
    if (r.permissoes.contatos) {
      linhas.push([], ["Pessoa física e jurídica"], ["Tipo", "Pedidos", "Faturamento", "Ticket médio"]);
      for (const c of r.distribuicaoClientes ?? []) linhas.push([c.tipo === "PF" ? "Pessoa física" : c.tipo === "PJ" ? "Pessoa jurídica" : "Sem classificação", c.pedidos, c.faturamento, c.ticket]);
      linhas.push([], ["Ranking de clientes"], ["Cliente", "Tipo", "Pedidos", "Faturamento"]);
      for (const c of r.rankingClientes) linhas.push([c.nome, c.tipo === "PF" ? "Física" : c.tipo === "PJ" ? "Jurídica" : "Não informado", c.compras, c.valor]);
    }
    linhas.push([], ["Entregas por região"], ["Região", "Entregas", "Frete", ...(r.permissoes.custos ? ["Custo conhecido", "Entregas com custo"] : []), "Confirmados", "Aproximados", "Não validados"]);
    for (const e of r.regioes) linhas.push([e.nome, e.pedidos, e.frete, ...(r.permissoes.custos ? [e.custo, e.custosConhecidos] : []), e.confirmados, e.aproximados, e.naoValidados]);
    linhas.push([], ["Combinações frequentes"], ["Produto A", "Produto B", "Pedidos", "Participação observada (%)"]);
    for (const c of r.oportunidades.combinacoes) linhas.push([c.produtoA, c.produtoB, c.pedidos, c.participacao]);
    if (r.permissoes.contatos) linhas.push(["Clientes sem recomprar", r.oportunidades.semRecompra, "Intervalo em dias", r.oportunidades.dias]);
    if (r.permissoes.custos) linhas.push(["Frete na base com custo conhecido", r.oportunidades.freteCoberto], ["Custo efetivo na mesma base", r.oportunidades.custoEntrega], ["Entregas com custo conhecido", r.oportunidades.entregasComCusto]);
    linhas.push([], ["Pedidos da seleção"], ["Pedido", "Data", "Faturamento", "Frete", "Origem", "Canal", "Modalidade", "Redução sem componente apurado", ...(r.permissoes.contatos ? ["Comprador"] : [])]);
    for (const p of r.pedidos.linhas) linhas.push([p.numero, p.data, p.receita, p.frete, p.origem, p.canal, p.modalidade, p.ajusteNaoClassificado ?? 0, ...(r.permissoes.contatos ? [p.cliente] : [])]);
  }
  return "\uFEFF" + linhas.map(l => l.map(celulaCsvBi).join(";")).join("\r\n") + "\r\n";
}
