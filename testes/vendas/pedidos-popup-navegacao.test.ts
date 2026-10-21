import { describe, expect, it } from "vitest";
import { filtrosDoRetornoGestor, retornoGestorSeguro, rotaPopupPedido } from "@/app/(protegido)/vendas/pedidos/pedidos-navegacao";

describe("retorno validado dos popups de Pedidos", () => {
  const retorno = "/vendas/pedidos?modo=lista&busca=Pedido+fict%C3%ADcio&canalId=site&clienteId=cliente&produtoId=produto&status=CONFIRMADO&de=2026-10-01&ate=2026-10-02&pagina=3&data=2026-10-01&baseData=agenda&operacional=PRONTO&etapaGestor=pronto&visao=historico";
  it("conserva visualização, canal, consulta, agenda, filtros e página ao abrir detalhe, novo, comanda ou gestão", () => {
    for (const caminho of ["/vendas/pedidos/novo", "/vendas/pedidos/pedido-ficticio", "/vendas/pedidos/pedido-ficticio/comanda", "/vendas/pedidos/gestao?clienteId=ficticio&pagina=2"]) {
      const destino = new URL(rotaPopupPedido(caminho, retorno), "https://pedidos.grazinghub.com.br");
      expect(destino.searchParams.get("retorno")).toBe(retornoGestorSeguro(retorno));
      expect(filtrosDoRetornoGestor(destino.searchParams.get("retorno"))).toEqual(Object.fromEntries(new URL(retorno, destino).searchParams));
    }
    expect(new URL(rotaPopupPedido("/vendas/pedidos/gestao?clienteId=ficticio&pagina=2", retorno), "https://pedidos.grazinghub.com.br").searchParams.get("pagina")).toBe("2");
  });
  it.each([undefined, [retorno], "https://pedidos.grazinghub.com.br/vendas/pedidos", "https://example.invalid", "//example.invalid/vendas/pedidos", "/\\example.invalid/vendas/pedidos", "/financeiro", "/vendas/pedidos/novo", "/vendas/pedidos/../clientes"])("rejeita retorno externo ou fora da visualização: %s", valor => {
    expect(retornoGestorSeguro(valor)).toBe("/vendas/pedidos");
  });
  it("remove parâmetros desconhecidos e fragmentos sem perder busca", () => {
    expect(retornoGestorSeguro("/vendas/pedidos?modo=calendario&busca=ficticio&retorno=https://example.invalid&segredo=falso#fora")).toBe("/vendas/pedidos?busca=ficticio&modo=calendario");
    expect(rotaPopupPedido("https://example.invalid/fora", retorno)).toBe(retornoGestorSeguro(retorno));
  });
  it("volta à consulta de cancelados preservando somente a página válida", () => {
    expect(retornoGestorSeguro("/vendas/pedidos/cancelados?pagina=3&retorno=https://example.invalid#fora")).toBe("/vendas/pedidos/cancelados?pagina=3");
    for (const pagina of ["0", "-1", "10001", "abc"]) expect(retornoGestorSeguro(`/vendas/pedidos/cancelados?pagina=${pagina}`)).toBe("/vendas/pedidos/cancelados");
    const destino = new URL(rotaPopupPedido("/vendas/pedidos/cancelado-ficticio", "/vendas/pedidos/cancelados?pagina=2"), "https://pedidos.grazinghub.com.br");
    expect(destino.searchParams.get("retorno")).toBe("/vendas/pedidos/cancelados?pagina=2");
  });
});
