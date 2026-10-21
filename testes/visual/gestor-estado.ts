import { criarGestorFixture } from "./gestor-fixtures";

/** Estado exclusivamente sintético compartilhado pelos simuladores da prévia. */
const parametros = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
export const fixtureGestorVisual = criarGestorFixture({ referencia: parametros.has("referencia") });
if (parametros.has("ifood")) {
  fixtureGestorVisual.resultado.pedidos[0] = { ...fixtureGestorVisual.resultado.pedidos[0], origem: "IFOOD", status: "RECEBIDO_EXTERNO", operacional: "PENDENTE", confirmadoEm: null };
}
if (parametros.has("orcamento")) {
  fixtureGestorVisual.resultado.pedidos[0] = { ...fixtureGestorVisual.resultado.pedidos[0], status: "RASCUNHO", operacional: "PENDENTE", confirmadoEm: null };
}
