// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sim = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), mudar: vi.fn(), configurarEstoque: vi.fn(), guard: vi.fn(), pathname: "/vendas/pedidos" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: sim.push, replace: sim.replace, refresh: sim.refresh }), usePathname: () => sim.pathname }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/pedidos/gestor-actions", () => ({ mudarStatusGestorPedidoAction: sim.mudar, salvarMovimentacaoEstoqueGestorPedidosAction: sim.configurarEstoque }));
vi.mock("@/app/(protegido)/vendas/pedidos/modal-pedido", () => ({ navegarComPedidoAberto: sim.guard }));

vi.mock("@/app/(protegido)/vendas/pedidos/resumo-pedido", () => ({ ResumoPedido: ({ pedido, fechar }: { pedido: { numero: number }; fechar: () => void }) => <div role="dialog" aria-label={`Resumo comercial #${pedido.numero}`}><button onClick={fechar}>Fechar resumo</button></div> }));

import { GestorPedidos } from "@/app/(protegido)/vendas/pedidos/gestor-client";
import { criarGestorFixture } from "../visual/gestor-fixtures";

beforeEach(() => { sim.mudar.mockReset(); sim.guard.mockReset().mockReturnValue(false); sim.pathname = "/vendas/pedidos"; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

async function escolherModo(usuario: ReturnType<typeof userEvent.setup>, nome: "Kanban" | "Calendário" | "Lista") {
  await usuario.click(screen.getByRole("combobox", { name: "Modo de visualização" }));
  await usuario.click(await screen.findByRole("option", { name: nome === "Kanban" ? "Quadros" : nome }));
}

function verificarModo(modo: "quadros" | "calendario" | "lista") {
  if (modo === "calendario") expect(screen.getByRole("region", { name: "Calendário de pedidos" })).toBeTruthy();
  else expect(screen.getByRole("combobox", { name: "Modo de visualização" }).textContent).toContain(modo === "quadros" ? "Quadros" : "Lista");
}

describe("Interface do gestor de pedidos", () => {
  it("abre a pesquisa histórica no menu sem misturar a fila operacional", async () => {
    const props = criarGestorFixture();
    render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Pedidos históricos" }));
    const destino = new URL(sim.push.mock.lastCall![0], "https://pedidos.example.test");
    expect(destino.searchParams.get("status")).toBe("HISTORICO");
    expect(destino.searchParams.get("modo")).toBe("lista");
    expect(destino.searchParams.has("etapaGestor")).toBe(false);
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("mostra o legado em lista com modalidade desconhecida e somente consulta", async () => {
    const props = criarGestorFixture(); props.filtros = { status: "HISTORICO", modo: "quadros" };
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], origem: "HISTORICO_LEGADO", status: "HISTORICO", operacional: "HISTORICO", numero: 22851, atendimento: null }];
    render(<GestorPedidos {...props} />);
    const lista = screen.getByRole("region", { name: "Lista de pedidos" });
    expect(within(lista).getByRole("link", { name: "#22851" })).toBeTruthy();
    expect(within(lista).getByText("Histórico")).toBeTruthy();
    expect(within(lista).getByText("Modalidade não comprovada")).toBeTruthy();
    expect(within(lista).getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual(["Ver pedido histórico #22851"]);
    await userEvent.click(within(lista).getByRole("button", { name: "Ver pedido histórico #22851" }));
    expect(sim.push).toHaveBeenCalled(); expect(sim.mudar).not.toHaveBeenCalled();
  });
  it("prioriza agenda e destinatário no card, com próximo passo, produção e menu no topo", () => {
    const props = criarGestorFixture();
    render(<GestorPedidos {...props} />);
    const card = screen.getByLabelText("Pedido #101");
    expect(within(card).getByText("Para: Destinatário Exemplo")).toBeTruthy();
    expect(within(card).getByText("30/09/2026 · 14:00–16:00")).toBeTruthy();
    expect(within(card).queryByText(/^há /)).toBeNull();
    expect(within(card).queryByRole("button", { name: "Ver pedido #101" })).toBeNull();
    const topo = card.querySelector('.gestor-cartao-menu')!;
    expect(within(topo as HTMLElement).getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual([
      "Avançar pedido #101 para Pronto", "Imprimir produção do pedido #101", "Mais ações do pedido #101",
    ]);
    expect(card.querySelector('.gestor-cartao-rapidas')).toBeNull();
  });

  it("encaminha o cancelamento do menu ao detalhe com contexto e proteção de rascunho", async () => {
    const props = criarGestorFixture(); props.capacidades.cancelar = true;
    props.filtros = { modo: "quadros", busca: "Caixa", canalId: "site" };
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    await usuario.click(await screen.findByRole("menuitem", { name: "Cancelar pedido" }));
    const destino = new URL(sim.push.mock.lastCall![0], "https://pedidos.example.test");
    expect(destino.pathname).toBe("/vendas/pedidos/pedido-ficticio-1");
    expect(destino.searchParams.get("cancelar")).toBe("1");
    expect(destino.searchParams.get("retorno")).toContain("canalId=site");
    expect(destino.searchParams.get("retorno")).toContain("busca=Caixa");
    expect(sim.guard).toHaveBeenCalledWith(`${destino.pathname}${destino.search}`);
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it.each(["sem permissão", "iFood", "já cancelado"])("oculta cancelamento no menu de pedido %s", async caso => {
    const props = criarGestorFixture(); props.filtros.modo = "lista";
    props.capacidades.cancelar = caso !== "sem permissão";
    if (caso === "iFood") props.resultado.pedidos[0].origem = "IFOOD";
    if (caso === "já cancelado") props.resultado.pedidos[0].status = "CANCELADO";
    render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    const menu = await screen.findByRole("menu", { name: "Mais ações do pedido #101" });
    expect(within(menu).queryByRole("menuitem", { name: "Cancelar pedido" })).toBeNull();
  });

  it("explica o cancelamento indisponível na etapa entregue, sem abrir nem executar a ação", async () => {
    const props = criarGestorFixture(); props.capacidades.cancelar = true;
    props.resultado.pedidos[0].operacional = "ENTREGUE";
    props.resultado.pedidos[0].entregueEm = "2026-10-01T12:00:00Z";
    render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    const menu = await screen.findByRole("menu", { name: "Mais ações do pedido #101" });
    const cancelar = within(menu).getByRole("menuitem", { name: "Cancelar pedido" });
    expect(cancelar.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(cancelar.getAttribute("aria-describedby")!)?.textContent).toBe("Pedido entregue. Retorne a uma etapa anterior para cancelar.");
    expect(cancelar.textContent).toContain("Pedido entregue. Retorne a uma etapa anterior para cancelar.");
    expect(within(menu).getAllByRole("menuitem").at(-1)).toBe(cancelar);
    fireEvent.click(cancelar);
    expect(sim.push).not.toHaveBeenCalled(); expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("reabre cancelamento ao retornar da entrega assim que o servidor confirma a nova etapa", async () => {
    const props = criarGestorFixture(); props.capacidades.cancelar = true;
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], operacional: "EM_ENTREGA", entregueEm: null }];
    sim.mudar.mockResolvedValueOnce({ versao: 3, statusOperacional: "ENTREGUE" }).mockResolvedValueOnce({ versao: 4, statusOperacional: "EM_ENTREGA" });
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Avançar pedido #101 para Entregues" }));
    await waitFor(() => expect(sim.refresh).toHaveBeenCalledTimes(1));
    await usuario.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    await usuario.click(await screen.findByRole("menuitem", { name: "Retornar pedido #101 para Em rota" }));
    await waitFor(() => expect(sim.refresh).toHaveBeenCalledTimes(2));
    await usuario.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    const cancelar = await screen.findByRole("menuitem", { name: "Cancelar pedido" });
    expect(cancelar.getAttribute("aria-disabled")).not.toBe("true");
    await usuario.click(cancelar);
    expect(sim.push.mock.lastCall?.[0]).toContain("cancelar=1");
  });

  it.each(["EM_PREPARO", "PRONTO", "EM_ENTREGA"] as const)("permite cancelar na etapa %s com primeira entrega preservada", async operacional => {
    const props = criarGestorFixture(); props.capacidades.cancelar = true;
    props.resultado.pedidos[0].operacional = operacional;
    props.resultado.pedidos[0].entregueEm = "2026-10-01T12:00:00Z";
    render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    const cancelar = await screen.findByRole("menuitem", { name: "Cancelar pedido" });
    expect(cancelar.getAttribute("aria-disabled")).not.toBe("true");
    await userEvent.click(cancelar);
    expect(sim.push.mock.lastCall?.[0]).toContain("cancelar=1");
  });

  it("mantém o quadro quando a navegação para cancelar depende de descarte", async () => {
    const props = criarGestorFixture(); props.capacidades.cancelar = true;
    sim.guard.mockReturnValue(true);
    render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Cancelar pedido" }));
    expect(sim.guard.mock.lastCall?.[0]).toContain("cancelar=1");
    expect(sim.push).not.toHaveBeenCalled();
    verificarModo("quadros");
  });

  it.each([false, true])("mostra configuração iFood somente no menu quando a capacidade administrativa é %s", async permitido => {
    render(<GestorPedidos {...criarGestorFixture()} configurarIfood={permitido} />);
    expect(screen.queryByText("Configurar iFood")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    const menu = await screen.findByRole("menu", { name: "Mais opções de pedidos" });
    if (!permitido) { expect(within(menu).queryByRole("menuitem", { name: "Configurar iFood" })).toBeNull(); return; }
    const atalho = await within(menu).findByRole("menuitem", { name: "Configurar iFood" });
    await userEvent.click(atalho);
    await waitFor(() => expect(sim.guard).toHaveBeenCalledWith("/vendas/pedidos/ifood"));
    await waitFor(() => expect(sim.push.mock.lastCall?.[0]).toBe("/vendas/pedidos/ifood"));
  });

  it("protege a edição pendente antes de abrir a configuração iFood", async () => {
    sim.guard.mockReturnValue(true);
    render(<GestorPedidos {...criarGestorFixture()} configurarIfood />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Configurar iFood" }));
    await waitFor(() => expect(sim.guard).toHaveBeenCalledWith("/vendas/pedidos/ifood"));
    expect(sim.push).not.toHaveBeenCalled();
    expect(sim.replace).not.toHaveBeenCalled();
  });

  it("destaca pedido iFood aguardando aceite sem classificá-lo como interrompido ou liberar produção", () => {
    const props = criarGestorFixture();
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], origem: "IFOOD", status: "RECEBIDO_EXTERNO", operacional: "PENDENTE" }];
    render(<GestorPedidos {...props} />);
    const grupo = screen.getByRole("region", { name: "Novo pedido" });
    expect(within(grupo).getByRole("link", { name: "#101" })).toBeTruthy();
    expect(within(grupo).getByText("Aguardando confirmação")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Pedidos aguardando confirmação iFood" })).toBeNull();
    expect(screen.queryByText("Declinados, estornados e interrompidos")).toBeNull();
    expect(screen.queryByRole("button", { name: /Iniciar preparo.*#101/ })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Em preparo" })).queryByRole("link", { name: "#101" })).toBeNull();
  });
  it.each(["calendario", "lista"])("mostra orçamento destacado e confirmado juntos em %s, sem liberar produção do orçamento", async modo => {
    const props = criarGestorFixture(); props.filtros.modo = modo;
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], status: "RASCUNHO", operacional: "PENDENTE" }, props.resultado.pedidos[1]];
    render(<GestorPedidos {...props} />);
    if (modo === "calendario") {
      expect(screen.getByRole("button", { name: "Expandir pedido #102" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Expandir pedido #101" }).closest('[data-status="RASCUNHO"]')).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: "Expandir pedido #101" }));
    } else expect(screen.getByRole("link", { name: "#102" })).toBeTruthy();
    const orcamento = screen.getByRole("link", { name: "#101" });
    expect(orcamento.closest('[data-status="RASCUNHO"]')).toBeTruthy();
    if (modo === "lista") expect(screen.getByText("Em orçamento", { selector: '[data-slot="badge"]' }).className).toContain("bg-warning-bg");
    else expect(within(orcamento.closest('[data-slot="card"]')!).getByText("Em orçamento")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /(?:Avançar|Retornar|Iniciar preparo).*#101/ })).toBeNull();
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("mostra o filtro explícito de confirmados e permite removê-lo para voltar a todas as situações", async () => {
    const props = criarGestorFixture(); props.filtros.status = "CONFIRMADO";
    render(<GestorPedidos {...props} />);
    expect(screen.getByText("Situação: Confirmado")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Situação" }));
    expect(new URL(sim.push.mock.lastCall![0], "https://pedidos.grazinghub.com.br").searchParams.has("status")).toBe(false);
  });
  it("remove o status operacional como um único filtro sem manter situação oculta", async () => {
    const props = criarGestorFixture(); props.filtros = { modo: "lista", status: "CONFIRMADO", etapaGestor: "rota", canalId: "site", busca: "Caixa", pagina: "2" };
    render(<GestorPedidos {...props} />);
    expect(screen.queryByText("Situação: Confirmado")).toBeNull();
    expect(screen.getByText("Status: A caminho")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Status" }));
    const rota = new URL(sim.push.mock.lastCall![0], "https://pedidos.grazinghub.com.br");
    for (const chave of ["status", "etapaGestor", "operacional", "pagina"]) expect(rota.searchParams.has(chave)).toBe(false);
    expect(rota.searchParams.get("canalId")).toBe("site"); expect(rota.searchParams.get("busca")).toBe("Caixa");
    expect(sim.mudar).not.toHaveBeenCalled();
  });
  it("abre no Kanban com cinco etapas e conserva busca em todos os modos", async () => {
    render(<GestorPedidos {...criarGestorFixture()} />);
    const usuario = userEvent.setup();
    verificarModo("quadros");
    expect(screen.getByRole("heading", { name: "Pedidos", level: 1 })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Modo de visualização" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Lista|Kanban/ })).toBeNull();
    for (const nome of ["Novo pedido", "Em preparo", "Pronto para entrega / retirada", "A caminho", "Entregue"]) expect(screen.getByRole("region", { name: nome })).toBeTruthy();
    for (const modo of ["Calendário", "Lista", "Kanban"] as const) {
      await escolherModo(usuario, modo);
      verificarModo({ "Calendário": "calendario", "Lista": "lista", "Kanban": "quadros" }[modo] as "calendario" | "lista" | "quadros");
      expect(screen.getByRole("textbox", { name: "Buscar pedidos" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Filtros" })).toBeTruthy();
    }
    expect(sim.mudar).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Buscar" })).toBeNull();
  });

  it("leva o contexto aplicado para os popups e remove as saídas de preparação", async () => {
    const props = criarGestorFixture();
    props.filtros = { modo: "lista", busca: "Caixa", canalId: "site", pagina: "2" };
    render(<GestorPedidos {...props} />);
    const destinos = [screen.getByRole("link", { name: "#101" }).getAttribute("href")!, screen.getByRole("button", { name: "Novo pedido" }).getAttribute("href")!];
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Histórico e gestão" }));
    destinos.push(sim.push.mock.lastCall![0]);
    for (const destino of destinos) {
      const url = new URL(destino, "https://pedidos.grazinghub.com.br");
      const retorno = new URL(url.searchParams.get("retorno")!, url);
      expect(retorno.pathname).toBe("/vendas/pedidos");
      for (const [chave, valor] of Object.entries(props.filtros)) expect(retorno.searchParams.get(chave)).toBe(valor);
    }
    expect(screen.queryByRole("link", { name: "Ver operação" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Prontidão dos produtos" })).toBeNull();
  });

  it("mostra datas civis, status colorido e retorno sequencial no calendário", async () => {
    const props = criarGestorFixture(); props.filtros.modo = "calendario";
    render(<GestorPedidos {...props} />);
    const dia = screen.getByRole("region", { name: "Pedidos de 30/09" });
    const entregue = within(dia).getByRole("article", { name: "Pedido #104" });
    expect(entregue.getAttribute("data-etapa")).toBe("entregues");
    expect(within(entregue).queryByRole("button", { name: /Retornar|Avançar/ })).toBeNull();
    await userEvent.click(within(entregue).getByRole("button", { name: "Expandir pedido #104" }));
    const detalhes = screen.getByRole("dialog", { name: "Detalhes do pedido #104" });
    await userEvent.click(within(detalhes).getByRole("button", { name: "Mais ações do pedido #104" }));
    expect(await screen.findByRole("menuitem", { name: "Retornar pedido #104 para Em rota" })).toBeTruthy();
    expect(within(detalhes).queryByRole("button", { name: /Avançar/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Pedidos sem data de entrega" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar preparo do pedido #105" })).toBeTruthy();
  });

  it("limita o slot a número, cliente, horário e canal e revela o cartão completo por teclado", async () => {
    const props = criarGestorFixture(); props.filtros.modo = "calendario";
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    const slot = screen.getByRole("article", { name: "Pedido #101" });
    const gatilhoDoSlot = within(slot).getByRole("button", { name: "Expandir pedido #101" });
    expect(gatilhoDoSlot.children).toHaveLength(2);
    expect(gatilhoDoSlot.children[0].textContent).toBe("#101Cliente Exemplo A");
    expect(gatilhoDoSlot.children[1].textContent).toBe("14:00–16:00Site");
    expect(within(slot).queryByRole("link")).toBeNull();
    expect(within(slot).getAllByRole("button")).toHaveLength(1);
    const gatilho = within(slot).getByRole("button", { name: "Expandir pedido #101" });
    gatilho.focus();
    await usuario.keyboard("{Enter}");
    const detalhes = screen.getByRole("dialog", { name: "Detalhes do pedido #101" });
    expect(within(detalhes).getByText("Cliente Exemplo A")).toBeTruthy();
    expect(within(detalhes).getByText("Para: Destinatário Exemplo")).toBeTruthy();
    expect(within(detalhes).getByTitle("2 × Caixa de degustação")).toBeTruthy();
    expect(within(detalhes).getByRole("link", { name: "#101" })).toBeTruthy();
    expect(within(detalhes).getByRole("button", { name: "Mais ações do pedido #101" })).toBeTruthy();
    expect(within(detalhes).getByRole("button", { name: "Avançar pedido #101 para Pronto" })).toBeTruthy();
    fireEvent.keyDown(detalhes, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(gatilho);
  });

  it("fecha o painel e abre diretamente o pedido com retorno ao calendário", async () => {
    const props = criarGestorFixture(); props.filtros.modo = "calendario";
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Expandir pedido #101" }));
    await usuario.click(screen.getByRole("link", { name: "#101" }));
    await waitFor(() => expect(sim.push).toHaveBeenCalledTimes(1));
    const destino = new URL(sim.push.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
    expect(destino.pathname).toBe("/vendas/pedidos/pedido-ficticio-1");
    expect(destino.searchParams.get("retorno")).toContain("modo=calendario");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("delegar a troca de modo ao painel conserva o Kanban, a consulta e o canal até resolver a saída", async () => {
    const props = criarGestorFixture();
    props.filtros = { modo: "quadros", busca: "Caixa", canalId: "site", pagina: "2" };
    sim.guard.mockReturnValue(true);
    render(<GestorPedidos {...props} />);
    await escolherModo(userEvent.setup(), "Lista");
    expect(sim.guard).toHaveBeenCalledTimes(1);
    const destino = new URL(sim.guard.mock.calls[0][0], "https://pedidos.example.test");
    expect(destino.searchParams.get("modo")).toBe("lista");
    expect(destino.searchParams.get("busca")).toBe("Caixa");
    expect(destino.searchParams.get("canalId")).toBe("site");
    expect(destino.searchParams.has("pagina")).toBe(false);
    verificarModo("quadros");
    expect(screen.queryByRole("region", { name: "Lista de pedidos" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement).value).toBe("Caixa");
    expect(screen.getByText("Canal: Site")).toBeTruthy();
    expect(sim.push).not.toHaveBeenCalled();
    expect(sim.replace).not.toHaveBeenCalled();
  });

  it("delegar o filtro ao painel não confirma canal nem normaliza a busca antes da decisão", async () => {
    vi.useFakeTimers();
    const props = criarGestorFixture(); props.filtros = { modo: "quadros", busca: "Caixa", canalId: "site" };
    sim.guard.mockReturnValue(true);
    render(<GestorPedidos {...props} />);
    const campo = screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "  Caixa recente  " } });
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const filtro = screen.getByRole("dialog", { name: "Canal" });
    fireEvent.click(within(filtro).getByRole("checkbox", { name: /^iFood \(\d[\d.]*\)$/ }));
    expect(sim.guard).toHaveBeenCalledTimes(1);
    const destino = new URL(sim.guard.mock.calls[0][0], "https://pedidos.example.test");
    expect(destino.searchParams.get("canalId")).toBe("ifood");
    expect(destino.searchParams.get("busca")).toBe("Caixa recente");
    expect(campo.value).toBe("  Caixa recente  ");
    expect(within(filtro).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(filtro).getByRole("checkbox", { name: /^iFood \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Canal: Site")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(sim.push).not.toHaveBeenCalled();
    expect(sim.replace).not.toHaveBeenCalled();
  });

  it("consulta a proteção ao terminar de fechar o cartão do calendário antes de abrir o pedido", async () => {
    const props = criarGestorFixture(); props.filtros = { modo: "calendario", busca: "Caixa", canalId: "site" };
    sim.guard.mockReturnValue(true);
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Expandir pedido #101" }));
    expect(sim.guard).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("link", { name: "#101" }));
    await waitFor(() => expect(sim.guard).toHaveBeenCalledTimes(1));
    const destino = new URL(sim.guard.mock.calls[0][0], "https://pedidos.example.test");
    expect(destino.pathname).toBe("/vendas/pedidos/pedido-ficticio-1");
    const retorno = new URL(destino.searchParams.get("retorno")!, destino);
    expect(retorno.searchParams.get("modo")).toBe("calendario");
    expect(retorno.searchParams.get("busca")).toBe("Caixa");
    expect(retorno.searchParams.get("canalId")).toBe("site");
    expect(screen.queryByRole("dialog", { name: "Detalhes do pedido #101" })).toBeNull();
    verificarModo("calendario");
    expect(sim.push).not.toHaveBeenCalled();
    expect(sim.replace).not.toHaveBeenCalled();
  });

  it("agrupa pedido imediato pela data no fuso de origem sem exigir previsão agendada", () => {
    const props = criarGestorFixture(); props.filtros.modo = "calendario";
    props.resultado.pedidos = [{ ...props.resultado.pedidos[4], prazo: "IMEDIATO", previsaoData: null, dataGestor: "2026-09-30" }];
    render(<GestorPedidos {...props} />);
    expect(within(screen.getByRole("region", { name: "Pedidos de 30/09" })).getByRole("article", { name: "Pedido #105" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Pedidos sem data de entrega" })).toBeNull();
  });

  it("lista criação e canal em colunas próprias, com ações diretas e sem expansão", async () => {
    const props = criarGestorFixture(); props.filtros.modo = "lista";
    props.resultado.pedidos[0].criadoEm = "2026-10-09T02:15:00Z";
    render(<GestorPedidos {...props} />);
    expect(screen.getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Pedido", "Criação", "Cliente", "Canal", "Itens", "Entrega / retirada", "Total", "Status", "Ações"]);
    const linha = screen.getByRole("link", { name: "#101" }).closest("tr")!;
    const celulas = within(linha).getAllByRole("cell");
    expect(celulas[1].textContent).toBe("08/10/202623:15");
    expect(celulas[2].textContent).not.toContain("Site");
    expect(celulas[3].textContent).toBe("Site");
    expect(within(linha).getByTitle("2 × Caixa de degustação")).toBeTruthy();
    expect(linha.textContent).toContain("300,00");
    expect(linha.textContent).not.toContain("Rua de Cobrança");
    expect(within(celulas[8]).getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual(["Avançar pedido #101 para Pronto", "Imprimir produção do pedido #101", "Mais ações do pedido #101"]);
    expect(within(linha).queryByRole("button", { name: /Expandir|Recolher/ })).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(props.resultado.pedidos.length + 1);
    expect(sim.push).not.toHaveBeenCalled(); expect(sim.mudar).not.toHaveBeenCalled();
    await userEvent.click(within(linha).getByText("Cliente Exemplo A"));
    expect(sim.push).toHaveBeenCalledTimes(1);
    expect(sim.push.mock.lastCall![0]).toContain("/pedido-ficticio-1?");
  });

  it("a ação direta de fluxo na lista não abre o painel nem expande a linha", async () => {
    const props = criarGestorFixture(); props.filtros.modo = "lista";
    sim.mudar.mockResolvedValue({ versao: 3, statusOperacional: "PRONTO" });
    render(<GestorPedidos {...props} />);
    const linha = screen.getByRole("link", { name: "#101" }).closest("tr")!;
    await userEvent.click(within(linha).getByRole("button", { name: "Avançar pedido #101 para Pronto" }));
    await waitFor(() => expect(sim.refresh).toHaveBeenCalledTimes(1));
    expect(sim.mudar.mock.lastCall?.slice(0, 3)).toEqual(["pedido-ficticio-1", 2, "avancar"]);
    expect(sim.push).not.toHaveBeenCalled();
    expect(screen.getAllByRole("row")).toHaveLength(props.resultado.pedidos.length + 1);
  });

  it("mostra data e hora externas de criação iFood no fuso do pedido", () => {
    const props = criarGestorFixture(); props.filtros.modo = "lista";
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], origem: "IFOOD", criadoEm: "2026-10-09T13:00:00Z", criadoEmExterno: "2026-10-09T02:15:00Z", fusoHorario: "America/Manaus" }];
    render(<GestorPedidos {...props} />);
    const linha = screen.getByRole("link", { name: "#101" }).closest("tr")!;
    expect(within(linha).getAllByRole("cell")[1].textContent).toBe("08/10/202622:15");
  });

  it("preserva a data civil de entrega na lista e mantém o cálculo fora da apresentação", () => {
    const props = criarGestorFixture(); props.filtros.modo = "lista";
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], fusoHorario: "America/Manaus", dataGestor: "2026-09-29" }];
    render(<GestorPedidos {...props} />);
    const linha = screen.getByRole("link", { name: "#101" }).closest("tr")!;
    expect(linha.textContent).toContain("29/09");
    expect(linha.textContent).toContain("14:00–16:00");
  });

  it("oferece resumo comercial separado da produção e do detalhe sem executar mutação", async () => {
    const props = criarGestorFixture(); props.capacidades.cancelar = true;
    props.resultado.pedidos[0].operacional = "PRONTO";
    render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    const menu = await screen.findByRole("menu", { name: "Mais ações do pedido #101" });
    expect(within(menu).queryByRole("menuitem", { name: "Impressão de produção" })).toBeNull();
    expect(within(menu).getAllByRole("menuitem").map(i => i.textContent)).toEqual(["Retornar para Em preparo", "Resumo do pedido", "Cancelar pedido"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Resumo do pedido" }));
    expect(await screen.findByRole("dialog", { name: "Resumo comercial #101" })).toBeTruthy();
    expect(sim.push).not.toHaveBeenCalled(); expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("filtra status com contagens do servidor preservando busca e canal e reiniciando página", async () => {
    const props = criarGestorFixture(); props.filtros = { busca: "Caixa", canalId: "site", pagina: "2", modo: "lista" };
    props.resultado.contagensStatus = { todos: 57, orcamento: 8, novo: 2, preparo: 18, pronto: 11, rota: 12, entregues: 6, cancelado: 0 };
    render(<GestorPedidos {...props} />);
    const filtros = screen.getByRole("group", { name: "Status dos pedidos" });
    expect(within(filtros).getByRole("button", { name: "Todos (57)" })).toBeTruthy();
    await userEvent.click(within(filtros).getByRole("button", { name: "A caminho (12)" }));
    const rota = new URL(sim.push.mock.lastCall![0], "https://pedidos.grazinghub.com.br");
    expect(rota.searchParams.get("etapaGestor")).toBe("rota"); expect(rota.searchParams.get("busca")).toBe("Caixa");
    expect(rota.searchParams.get("canalId")).toBe("site"); expect(rota.searchParams.has("pagina")).toBe(false);
  });

  it("mantém orçamento e cancelado fora do Kanban e abre orçamento pela lista sem liberar produção", async () => {
    const props = criarGestorFixture();
    props.resultado.pedidos = [
      { ...props.resultado.pedidos[0], status: "RASCUNHO", operacional: "PENDENTE" },
      { ...props.resultado.pedidos[1], status: "CANCELADO", operacional: "INTERROMPIDO" },
    ];
    props.filtros.status = "todos";
    const { rerender } = render(<GestorPedidos {...props} />);
    for (const nome of ["Novo pedido", "Em preparo", "Pronto para entrega / retirada", "A caminho", "Entregue"]) expect(within(screen.getByRole("region", { name: nome })).queryByRole("link")).toBeNull();
    expect(screen.queryByRole("region", { name: "Pedidos em orçamento" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Declinados, estornados e interrompidos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "#101" })).toBeNull();
    expect(screen.queryByRole("link", { name: "#102" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Avançar|Retornar|Iniciar preparo/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Orçamentos/ }));
    const url = new URL(sim.push.mock.lastCall![0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.get("modo")).toBe("lista");
    expect(url.searchParams.get("status")).toBe("RASCUNHO");
    expect(url.searchParams.has("pagina")).toBe(false);
    rerender(<GestorPedidos {...props} filtros={{ status: "RASCUNHO", modo: "lista" }} resultado={{ ...props.resultado, pedidos: [props.resultado.pedidos[0]] }} />);
    verificarModo("lista");
    expect(screen.getByRole("link", { name: "#101" }).closest('[data-status="RASCUNHO"]')).toBeTruthy();
    expect(screen.queryByRole("button", { name: /(?:Avançar|Retornar|Iniciar preparo).*#101/ })).toBeNull();
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("abre cancelados pelo filtro contado na lista e mantém a consulta sem ações de produção", async () => {
    const props = criarGestorFixture();
    props.filtros = { modo: "quadros", busca: "Cliente", canalId: "site", pagina: "2" };
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], status: "CANCELADO", operacional: "INTERROMPIDO" }];
    props.resultado.contagensStatus.cancelado = 1;
    const { rerender } = render(<GestorPedidos {...props} />);
    await userEvent.click(within(screen.getByRole("group", { name: "Status dos pedidos" })).getByRole("button", { name: "Cancelado (1)" }));
    const url = new URL(sim.push.mock.lastCall![0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.get("modo")).toBe("lista");
    expect(url.searchParams.get("status")).toBe("CANCELADO");
    expect(url.searchParams.get("busca")).toBe("Cliente");
    expect(url.searchParams.get("canalId")).toBe("site");
    expect(url.searchParams.has("pagina")).toBe(false);
    expect(url.searchParams.has("etapaGestor")).toBe(false);
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, status: "CANCELADO", modo: "lista", pagina: undefined }} />);
    verificarModo("lista");
    expect(screen.getByRole("link", { name: "#101" }).closest('[data-status="CANCELADO"]')).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Avançar|Retornar|Iniciar preparo/ })).toBeNull();
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("oculta criação e mudanças de etapa quando o acesso é somente consulta", async () => {
    const props = criarGestorFixture(); props.capacidades = { adicionar: false, preparar: false, expedir: false };
    render(<GestorPedidos {...props} />);
    expect(screen.queryByRole("button", { name: /^(?:Avançar pedido|Retornar pedido|Iniciar preparo)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo pedido" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    expect(await screen.findByRole("menuitem", { name: "Atualizar pedidos" })).toBeTruthy();
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("preserva os nomes Declinado e Estornado no histórico sem oferecer transição de produção", () => {
    const props = criarGestorFixture();
    props.filtros = { modo: "lista", status: "todos" };
    props.resultado.pedidos = [
      { ...props.resultado.pedidos[0], status: "DECLINADO", operacional: "INTERROMPIDO" },
      { ...props.resultado.pedidos[1], status: "ESTORNADO", operacional: "INTERROMPIDO" },
    ];
    render(<GestorPedidos {...props} />);
    expect(screen.getByText("Declinado")).toBeTruthy();
    expect(screen.getByText("Estornado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Avançar|Retornar|Iniciar preparo/ })).toBeNull();
  });

  it("clicar no pedido abre o detalhe preservando filtros, sem botão de olho", async () => {
    render(<GestorPedidos {...criarGestorFixture()} />);
    expect(screen.queryByRole("button", { name: "Ver pedido #101" })).toBeNull();
    await userEvent.click(screen.getByRole("link", { name: "#101" }));
    expect(sim.push).toHaveBeenCalledTimes(1);
    const destino = new URL(sim.push.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
    expect(destino.pathname).toBe("/vendas/pedidos/pedido-ficticio-1");
    expect(destino.searchParams.get("retorno")).toBe("/vendas/pedidos?status=todos&modo=quadros");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelados" })).toBeNull();
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("solicita impressão do resumo fictício e escapa observações sem confirmar venda", async () => {
    const props = criarGestorFixture();
    props.filtros.status = "todos";
    props.filtros.modo = "lista";
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], status: "RASCUNHO", operacional: "PENDENTE", observacoes: "<script>observação-fictícia</script>" }];
    props.resultado.pedidos[0].itensDetalhes[0].observacoes = "<em>Separar complementos fictícios</em>";
    props.resultado.pedidos[0].itensDetalhes[0].quantidade = "0.125";
    props.resultado.pedidos[0].itensDetalhes[0].unidade = "KG";
    const escrever = vi.fn(), imprimir = vi.fn();
    const abrir = vi.spyOn(window, "open").mockReturnValue({ document: { write: escrever, close: vi.fn() }, focus: vi.fn(), print: imprimir } as unknown as Window);
    try {
      render(<GestorPedidos {...props} />);
      await userEvent.click(screen.getByRole("button", { name: "Imprimir produção do pedido #101" }));
      const html = escrever.mock.calls[0][0];
      expect(html).toContain("Em orçamento — não iniciar produção");
      expect(html).toContain("width:72mm");
      expect(html).toContain('class="quantidade destaque">0,125 KG');
      expect(html).toContain("Queijo brie");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;em&gt;Separar complementos fictícios&lt;/em&gt;");
      expect(html).not.toContain("<em>");
      expect(imprimir).toHaveBeenCalledTimes(1);
      expect(sim.mudar).not.toHaveBeenCalled();
    } finally { abrir.mockRestore(); }
  });

  it("trava duplo clique e só confirma o status operacional devolvido pelo servidor", async () => {
    let resolver!: (resultado: { ok: true; id: string; numero: number; versao: number; status: string; statusOperacional: string }) => void;
    sim.mudar.mockReturnValue(new Promise(res => { resolver = res; }));
    render(<GestorPedidos {...criarGestorFixture()} />);
    const botao = screen.getByRole("button", { name: "Avançar pedido #101 para Pronto" });
    act(() => { fireEvent.click(botao); fireEvent.click(botao); });
    expect(sim.mudar).toHaveBeenCalledTimes(1);
    expect(sim.mudar).toHaveBeenCalledWith("pedido-ficticio-1", 2, "avancar", expect.any(String));
    expect(botao.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Pedido #101: Pronto para entrega / retirada.")).toBeNull();
    await act(async () => { resolver({ ok: true, id: "pedido-ficticio-1", numero: 101, versao: 3, status: "CONFIRMADO", statusOperacional: "PRONTO" }); });
    await waitFor(() => expect(screen.getByText("Pedido #101: Pronto para entrega / retirada.")).toBeTruthy());
    const coluna = screen.getByRole("region", { name: "Pronto para entrega / retirada" });
    expect(within(coluna).getByRole("link", { name: /#101/ })).toBeTruthy();
    expect(sim.refresh).toHaveBeenCalledTimes(1);
  });

  it("preserva o impedimento e a mesma chave na nova tentativa sem anunciar sucesso", async () => {
    sim.mudar.mockResolvedValue({ erro: "Registre todas as quantidades antes de avançar." });
    render(<GestorPedidos {...criarGestorFixture()} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Avançar pedido #101 para Pronto" }));
    const chave = sim.mudar.mock.calls[0][3];
    expect(screen.getByRole("alert").textContent).toContain("Registre todas as quantidades");
    await usuario.click(screen.getByRole("button", { name: "Ver pendência do pedido #101" }));
    expect(sim.push).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    await escolherModo(usuario, "Lista");
    expect(screen.getByRole("alert").textContent).toContain("Registre todas as quantidades");
    await usuario.click(screen.getByRole("button", { name: "Avançar pedido #101 para Pronto" }));
    expect(sim.mudar.mock.calls[1][3]).toBe(chave);
    expect(sim.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText("Pedido #101: Pronto para entrega / retirada.")).toBeNull();
  });

  it("incorpora a carteira recebida ao atualizar sem conservar pedidos que saíram do filtro", async () => {
    const props = criarGestorFixture(); props.filtros.etapaGestor = "preparo";
    props.resultado.pedidos = [props.resultado.pedidos[0]];
    const { rerender } = render(<GestorPedidos {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções de pedidos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Atualizar pedidos" }));
    expect(sim.refresh).toHaveBeenCalledTimes(1);
    rerender(<GestorPedidos {...props} resultado={{ ...props.resultado, pedidos: [], quantidadeTotal: 0, paginas: 0 }} />);
    await waitFor(() => expect(screen.queryByRole("link", { name: /#101/ })).toBeNull());
    expect(screen.getByText("Nenhum pedido corresponde aos filtros.")).toBeTruthy();
  });

  it("oferece apenas canal, aplica no clique e preserva busca e visualização", async () => {
    const props = criarGestorFixture(); props.filtros = { status: "CONFIRMADO", busca: "Caixa", clienteId: "cliente-0", produtoId: "caixa", de: "2026-09-01", pagina: "2" };
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    const formulario = screen.getByRole("dialog", { name: "Canal" });
    expect(within(formulario).queryByRole("combobox")).toBeNull();
    expect(within(formulario).queryByRole("button", { name: "Aplicar filtros" })).toBeNull();
    expect(within(formulario).queryByLabelText("De")).toBeNull();
    await usuario.click(within(formulario).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }));
    expect(within(formulario).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("true");
    const filtro = new URL(sim.push.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
    expect(filtro.searchParams.get("canalId")).toBe("site");
    expect(filtro.searchParams.get("busca")).toBe("Caixa");
    expect(filtro.searchParams.has("pagina")).toBe(false);
    await usuario.keyboard("{Escape}");
    await escolherModo(usuario, "Calendário");
    const modo = new URL(sim.push.mock.calls.at(-1)![0], "https://pedidos.grazinghub.com.br");
    expect(modo.searchParams.get("canalId")).toBe("site");
    expect(modo.searchParams.get("clienteId")).toBe("cliente-0");
    expect(modo.searchParams.get("busca")).toBe("Caixa");
    expect(modo.searchParams.get("de")).toBe("2026-09-01");
    expect(modo.searchParams.has("pagina")).toBe(false);
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    const reaberto = screen.getByRole("dialog", { name: "Canal" });
    expect(within(reaberto).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("true");
    verificarModo("calendario");
  });

  it("mantém o rótulo do filtro fora do X oficial e remove pelo teclado sem perder a consulta", async () => {
    const props = criarGestorFixture();
    props.filtros = { canalId: "site", busca: "Caixa", modo: "lista", pagina: "2" };
    render(<GestorPedidos {...props} />);
    const rotulo = screen.getByText("Canal: Site");
    const remover = screen.getByRole("button", { name: "Remover filtro Canal" });
    expect(remover.contains(rotulo)).toBe(false);
    expect(remover.textContent).toBe("");
    expect(remover.getAttribute("data-acao")).toBe("excluir");
    expect(remover.querySelector("svg.lucide-x")).toBeTruthy();
    remover.focus();
    await userEvent.setup().keyboard("{Enter}");
    const url = new URL(sim.push.mock.calls.at(-1)![0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.has("canalId")).toBe(false);
    expect(url.searchParams.has("pagina")).toBe(false);
    expect(url.searchParams.get("busca")).toBe("Caixa");
    expect(url.searchParams.get("modo")).toBe("lista");
    expect(screen.queryByText("Canal: Site")).toBeNull();
  });

  it("abre a configuração local sem alterar busca, filtro, visualização ou URL", async () => {
    const props = criarGestorFixture();
    props.filtros = { modo: "lista", busca: "Caixa", canalId: "site", pagina: "2" };
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await escolherModo(usuario, "Calendário");
    const navegacoes = sim.push.mock.calls.length;
    await usuario.click(screen.getByRole("button", { name: "Configurar estoque dos pedidos" }));
    expect(screen.getByRole("dialog", { name: "Estoque dos pedidos" })).toBeTruthy();
    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sim.push).toHaveBeenCalledTimes(navegacoes);
    expect(sim.replace).not.toHaveBeenCalled();
    expect(sim.refresh).not.toHaveBeenCalled();
    expect(sim.configurarEstoque).not.toHaveBeenCalled();
    verificarModo("calendario");
    expect((screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement).value).toBe("Caixa");
    expect(screen.getByText("Canal: Site")).toBeTruthy();
  });

  it("preserva a visualização mais recente ao filtrar antes da confirmação do servidor", async () => {
    const props = criarGestorFixture();
    const { rerender } = render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await escolherModo(usuario, "Lista");
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    await usuario.click(screen.getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }));
    const url = new URL(sim.push.mock.calls.at(-1)![0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.get("modo")).toBe("lista");
    expect(url.searchParams.get("canalId")).toBe("site");
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, canalId: "site" }} />);
    verificarModo("lista");
    expect(screen.getByRole("region", { name: "Lista de pedidos" })).toBeTruthy();
    expect(screen.getByText("Canal: Site")).toBeTruthy();
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, modo: "lista", canalId: "site" }} />);
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, modo: "quadros" }} />);
    verificarModo("quadros");
    expect(screen.queryByRole("button", { name: "Remover filtro Canal" })).toBeNull();
  });

  it("compacta os cartões com produtos e preserva comprador, destinatário e canal na lista", async () => {
    const props = criarGestorFixture();
    props.resultado.pedidos[1].destinatarioSnapshot = { nome: " cliente exemplo b ", contato: "Contato fictício" };
    props.resultado.pedidos[3].canal = "Parceiro iFood independente";
    render(<GestorPedidos {...props} />);
    const primeiro = screen.getByLabelText("Pedido #101");
    expect(within(primeiro).getByText("Cliente Exemplo A")).toBeTruthy();
    expect(within(primeiro).getByText("Para: Destinatário Exemplo")).toBeTruthy();
    const detalhe = new URL(within(primeiro).getByRole("link", { name: "#101" }).getAttribute("href")!, "https://pedidos.grazinghub.com.br");
    expect(detalhe.pathname).toBe("/vendas/pedidos/pedido-ficticio-1");
    expect(detalhe.searchParams.get("retorno")).toContain("modo=quadros");
    expect(within(primeiro).queryByRole("button", { name: "Ver pedido #101" })).toBeNull();
    expect(within(primeiro).getByRole("button", { name: "Mais ações do pedido #101" })).toBeTruthy();
    expect(within(primeiro).getByTitle("2 × Caixa de degustação")).toBeTruthy();
    expect(within(primeiro).getByRole("list", { name: "Itens do pedido #101" })).toBeTruthy();
    await escolherModo(userEvent.setup(), "Lista");
    const linhaPrimeiro = screen.getByRole("link", { name: "#101" }).closest("tr")!;
    expect(within(linhaPrimeiro).getByText("Cliente Exemplo A")).toBeTruthy();
    expect(within(linhaPrimeiro).getByText("Para: Destinatário Exemplo")).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "#102" }).closest("tr")!).queryByText(/^Para:/)).toBeNull();
    for (const [numero, canal] of [[101, "Site"], [102, "iFood"], [103, "GF"], [104, "Parceiro iFood independente"], [105, "Sem canal"]] as const) {
      expect(within(screen.getByRole("link", { name: `#${numero}` }).closest("tr")!).getByText(canal)).toBeTruthy();
    }
    expect(sim.mudar).not.toHaveBeenCalled();
  });

  it("busca automaticamente após a pausa e preserva foco, cursor e filtros", async () => {
    vi.useFakeTimers();
    const props = criarGestorFixture();
    props.filtros = { status: "CONFIRMADO", clienteId: "cliente-0", canalId: "site", etapaGestor: "preparo", pagina: "2" };
    const { rerender } = render(<GestorPedidos {...props} />);
    const campo = screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement;
    campo.focus();
    fireEvent.change(campo, { target: { value: "Caixa" } });
    campo.setSelectionRange(2, 2);
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(sim.replace).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(sim.replace).toHaveBeenCalledTimes(1);
    expect(sim.replace).toHaveBeenCalledWith(expect.any(String), { scroll: false });
    const url = new URL(sim.replace.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.get("busca")).toBe("Caixa");
    expect(url.searchParams.get("clienteId")).toBe("cliente-0");
    expect(url.searchParams.get("canalId")).toBe("site");
    expect(url.searchParams.get("etapaGestor")).toBe("preparo");
    expect(url.searchParams.has("pagina")).toBe(false);
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, busca: "Caixa" }} resultado={{ ...props.resultado, pedidos: [] }} />);
    expect(screen.getByRole("textbox", { name: "Buscar pedidos" })).toBe(campo);
    expect(document.activeElement).toBe(campo);
    expect(campo.value).toBe("Caixa");
    expect(campo.selectionStart).toBe(2);
    expect(sim.push).not.toHaveBeenCalled();
  });

  it("não deixa uma resposta anterior apagar a busca mais recente", async () => {
    vi.useFakeTimers();
    const props = criarGestorFixture();
    const { rerender } = render(<GestorPedidos {...props} />);
    const campo = screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement;
    campo.focus();
    fireEvent.change(campo, { target: { value: "Caixa" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.change(campo, { target: { value: "Caixa nova" } });
    campo.setSelectionRange(6, 6);
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, busca: "Caixa" }} resultado={{ ...props.resultado, pedidos: [] }} />);
    expect(campo.value).toBe("Caixa nova");
    expect(campo.selectionStart).toBe(6);
    expect(document.activeElement).toBe(campo);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(new URL(sim.replace.mock.calls.at(-1)![0], "https://pedidos.grazinghub.com.br").searchParams.get("busca")).toBe("Caixa nova");
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, busca: "Caixa nova" }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sim.replace).toHaveBeenCalledTimes(2);
  });

  it("mantém a busca enviada junto ao canal e não agenda uma navegação duplicada", async () => {
    vi.useFakeTimers();
    const props = criarGestorFixture();
    const { rerender } = render(<GestorPedidos {...props} />);
    const campo = screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "Cliente recente" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }));
    expect(new URL(sim.push.mock.calls.at(-1)![0], "https://pedidos.grazinghub.com.br").searchParams.get("busca")).toBe("Cliente recente");
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros }} />);
    expect(campo.value).toBe("Cliente recente");
    expect(screen.getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Canal: Site")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sim.replace).not.toHaveBeenCalled();
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, busca: "Cliente recente", canalId: "site" }} />);
    expect(campo.value).toBe("Cliente recente");
  });

  it("aguarda o fim da composição e Enter confirma uma vez sem debounce duplicado", async () => {
    vi.useFakeTimers();
    render(<GestorPedidos {...criarGestorFixture()} />);
    const campo = screen.getByRole("textbox", { name: "Buscar pedidos" });
    fireEvent.compositionStart(campo);
    fireEvent.change(campo, { target: { value: "Cliente composto" } });
    fireEvent.keyDown(campo, { key: "Enter", isComposing: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sim.replace).not.toHaveBeenCalled();
    fireEvent.compositionEnd(campo);
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(sim.replace).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(sim.replace).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sim.replace).toHaveBeenCalledTimes(1);
  });

  it("cancela buscas anteriores, limpa o texto e não navega depois de desmontar", async () => {
    vi.useFakeTimers();
    const props = criarGestorFixture(); props.filtros = { ...props.filtros, busca: "Anterior", canalId: "site", pagina: "3" };
    const { unmount } = render(<GestorPedidos {...props} />);
    const campo = screen.getByRole("textbox", { name: "Buscar pedidos" });
    fireEvent.change(campo, { target: { value: "Primeira" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    fireEvent.change(campo, { target: { value: "Segunda" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(sim.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(sim.replace).toHaveBeenCalledTimes(1);
    const url = new URL(sim.replace.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.has("busca")).toBe(false);
    expect(url.searchParams.get("canalId")).toBe("site");
    expect(url.searchParams.has("pagina")).toBe(false);
    fireEvent.change(campo, { target: { value: "Sem navegação" } });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sim.replace).toHaveBeenCalledTimes(1);
  });

  it("mantém o filtro de canal aberto após selecionar e fecha por Escape ou fora", async () => {
    render(<GestorPedidos {...criarGestorFixture()} />);
    const usuario = userEvent.setup();
    const gatilho = screen.getByRole("button", { name: "Filtros" });
    await usuario.click(gatilho);
    const formulario = screen.getByRole("dialog", { name: "Canal" });
    await usuario.click(within(formulario).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }));
    expect(screen.getByRole("dialog", { name: "Canal" })).toBeTruthy();
    expect(sim.push).toHaveBeenCalledTimes(1);
    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Canal" })).toBeNull());
    expect(document.activeElement).toBe(gatilho);
    await usuario.click(gatilho);
    expect(within(screen.getByRole("dialog", { name: "Canal" })).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("true");
    await usuario.click(screen.getByRole("heading", { name: "Pedidos", level: 1 }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Canal" })).toBeNull());
    expect(sim.push).toHaveBeenCalledTimes(1);
    expect(sim.replace).not.toHaveBeenCalled();
  });

  it("remove só o canal e ignora respostas anteriores enquanto aguarda o último filtro", async () => {
    const props = criarGestorFixture(); props.filtros = { modo: "calendario", busca: "Caixa", canalId: "site", pagina: "2" };
    const { rerender } = render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    await usuario.click(within(screen.getByRole("dialog", { name: "Canal" })).getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }));
    const url = new URL(sim.push.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
    expect(url.searchParams.get("modo")).toBe("calendario");
    expect(url.searchParams.get("busca")).toBe("Caixa");
    for (const chave of ["canalId", "pagina"]) expect(url.searchParams.has(chave)).toBe(false);
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros }} />);
    expect(screen.getByRole("checkbox", { name: /^Site \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("checkbox", { name: /^Todos os canais \(\d[\d.]*\)$/ }).getAttribute("aria-checked")).toBe("true");
    rerender(<GestorPedidos {...props} filtros={{ ...props.filtros, canalId: undefined }} />);
    expect((screen.getByRole("textbox", { name: "Buscar pedidos" }) as HTMLInputElement).value).toBe("Caixa");
  });

  it("pagina pelos botões preservando busca e filtros ativos", async () => {
    const props = criarGestorFixture(); props.filtros = { status: "CONFIRMADO", modo: "lista", busca: "Caixa", canalId: "site", etapaGestor: "pronto", pagina: "2" };
    props.resultado = { ...props.resultado, quantidadeTotal: 120, pagina: 2, paginas: 3 };
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    const paginas = screen.getByRole("navigation", { name: "Páginas de pedidos" });
    await usuario.click(within(paginas).getByRole("button", { name: "Próxima" }));
    await usuario.click(within(paginas).getByRole("button", { name: "Anterior" }));
    expect(sim.push).toHaveBeenCalledTimes(2);
    for (const [indice, pagina] of [[0, "3"], [1, "1"]] as const) {
      const url = new URL(sim.push.mock.calls[indice][0], "https://pedidos.grazinghub.com.br");
      expect(url.searchParams.get("pagina")).toBe(pagina);
      for (const chave of ["modo", "busca", "canalId", "etapaGestor", "status"] as const) expect(url.searchParams.get(chave)).toBe(props.filtros[chave]);
    }
  });
});
