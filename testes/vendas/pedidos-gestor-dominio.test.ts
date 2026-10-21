import { describe, expect, it } from "vitest";
import { colunasGestor, dataPedidoGestor, etapaDoPedido, horaPedidoGestor, instantePedidoGestor, modoGestor, nomeStatusGestor, rotaGestor, tempoPedidoGestor } from "@/app/(protegido)/vendas/pedidos/gestor-dominio";

describe("Navegação e agrupamento do gestor", () => {
  it("separa cinco etapas e conserva o recebido externo sem tratá-lo como confirmação", () => {
    expect(colunasGestor.map(c => c.nome)).toEqual(["Novo pedido", "Em preparo", "Pronto para entrega / retirada", "A caminho", "Entregue"]);
    expect(etapaDoPedido("CONFIRMADO", "PENDENTE")?.id).toBe("novo");
    expect(etapaDoPedido("RECEBIDO_EXTERNO", "PENDENTE")?.id).toBe("novo");
    expect(etapaDoPedido("CONFIRMADO", "EM_PREPARO")?.id).toBe("preparo");
    expect(etapaDoPedido("RASCUNHO", "PENDENTE")).toBeUndefined();
    expect(etapaDoPedido("CANCELADO", "INTERROMPIDO")).toBeUndefined();
    expect(nomeStatusGestor("RASCUNHO", "PENDENTE")).toBe("Em orçamento");
    expect(nomeStatusGestor("CANCELADO", "INTERROMPIDO")).toBe("Cancelado");
    expect(etapaDoPedido("CONFIRMADO", "INTERROMPIDO")).toBeUndefined();
    expect(nomeStatusGestor("RECEBIDO_EXTERNO", "PENDENTE")).toBe("Novo pedido");
  });

  it("mostra hora no fuso do pedido e usa a criação externa somente quando informada", () => {
    const p = { criadoEm: "2026-10-09T22:20:00.000Z", criadoEmExterno: "2026-10-09T21:20:00.000Z" };
    expect(instantePedidoGestor(p)).toBe(p.criadoEmExterno);
    expect(instantePedidoGestor({ criadoEm: p.criadoEm })).toBe(p.criadoEm);
    expect(horaPedidoGestor(instantePedidoGestor(p), "America/Sao_Paulo")).toBe("18:20");
    expect(horaPedidoGestor("inválido", "America/Sao_Paulo")).toBe("—");
    expect(horaPedidoGestor(p.criadoEm, "Fuso/inexistente")).toBe("—");
  });

  it("calcula o tempo decorrido com relógio explícito, sem minutos negativos", () => {
    const agora = Date.parse("2026-10-09T21:24:00.000Z");
    expect(tempoPedidoGestor("2026-10-09T21:20:00.000Z", agora)).toBe("há 4 min");
    expect(tempoPedidoGestor("2026-10-09T18:02:00.000Z", agora)).toBe("há 3 h 22 min");
    expect(tempoPedidoGestor("2026-10-08T20:24:00.000Z", agora)).toBe("há 1 d 1 h");
    expect(tempoPedidoGestor("2026-10-09T21:25:00.000Z", agora)).toBe("agora");
    expect(tempoPedidoGestor("inválido", agora)).toBe("—");
  });

  it("formata a data completa da criação no fuso do pedido, sem confundir UTC com a data local", () => {
    expect(dataPedidoGestor("2026-10-09T02:15:00Z", "America/Sao_Paulo")).toBe("08/10/2026");
    expect(dataPedidoGestor("2026-10-09T02:15:00Z", "UTC")).toBe("09/10/2026");
    expect(dataPedidoGestor("inválido", "America/Sao_Paulo")).toBe("—");
    expect(dataPedidoGestor("2026-10-09T02:15:00Z", "Fuso/inexistente")).toBe("—");
  });

  it("preserva busca, filtros e período ao trocar a visualização ou a página", () => {
    const filtros = { busca: "Caixa & queijo", clienteId: "cliente-ficticio", produtoId: "produto-ficticio", canalId: "canal-ficticio", etapaGestor: "pronto", status: "CONFIRMADO", data: "2026-10-03", visao: "semana", pagina: "3" };
    const url = new URL(rotaGestor(filtros, { modo: "calendario", pagina: undefined }), "https://pedidos.grazinghub.com.br");
    expect(url.pathname).toBe("/vendas/pedidos");
    for (const [chave, valor] of Object.entries(filtros).filter(([chave]) => chave !== "pagina")) expect(url.searchParams.get(chave)).toBe(valor);
    expect(url.searchParams.get("modo")).toBe("calendario");
    expect(url.searchParams.has("pagina")).toBe(false);
    expect(new URL(rotaGestor(filtros, { pagina: "4" }), url).searchParams.get("busca")).toBe(filtros.busca);
  });

  it("remove somente o filtro solicitado e recusa parâmetros fora do contrato", () => {
    const url = new URL(rotaGestor({ busca: "Pedido fictício", clienteId: "cliente-ficticio", pagina: "2", redirecionar: "https://externo.invalid" } as Parameters<typeof rotaGestor>[0], { clienteId: undefined, pagina: undefined }), "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.get("busca")).toBe("Pedido fictício");
    expect([...url.searchParams.keys()]).toEqual(["busca"]);
    expect(modoGestor(undefined)).toBe("quadros");
    expect(modoGestor("inexistente")).toBe("quadros");
  });

  it("preserva os encerramentos comerciais distintos e não os transforma em uma etapa ativa", () => {
    for (const [status, nome] of [["DECLINADO", "Declinado"], ["ESTORNADO", "Estornado"]]) {
      expect(etapaDoPedido(status, "INTERROMPIDO")).toBeUndefined();
      expect(nomeStatusGestor(status, "INTERROMPIDO")).toBe(nome);
      expect(new URL(rotaGestor({ status, modo: "lista" }), "https://pedidos.grazinghub.com.br").searchParams.get("status")).toBe(status);
    }
  });
});
