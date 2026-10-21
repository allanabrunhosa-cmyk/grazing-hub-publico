// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { replace, corrigir, devolver, revisar } = vi.hoisted(() => ({ replace: vi.fn(), corrigir: vi.fn(), devolver: vi.fn(), revisar: vi.fn() }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ corrigirRecebimentoPedidoAction: corrigir, criarRascunhoPedidoAction: vi.fn(), salvarRascunhoPedidoAction: vi.fn(), confirmarPedidoVendaAction: vi.fn(), revisarPedidoVendaAction: revisar, solicitarDevolucaoPedidoAction: devolver, cancelarPedidoVendaAction: vi.fn(), executarOperacaoPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/entregas-actions", () => ({ calcularFretePedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/custos-entrega-actions", () => ({ salvarCustoEntregaAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), criarClienteDoPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/produtos/embalagens-actions", () => ({ salvarTipoEmbalagemAction: vi.fn() }));
import { EditorPedido } from "@/app/(protegido)/vendas/pedidos/editor-pedido";
import { ModalPedido } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { OcorrenciasPedido } from "@/app/(protegido)/vendas/pedidos/ocorrencias-pedido";
const retorno = "/vendas/pedidos?canalId=site&pagina=3&modo=lista";
const dados = { horarios: null, catalogo: { produtos: [], grupos: [], categorias: [] }, clientes: [], canais: [], formas: [], categorias: [], contas: [], categoriasTaxa: [], categoriasDevolucao: [], creditos: {} } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
const pedido = { id: "pedido-ficticio", numero: 101, versao: 3, status: "CONFIRMADO", modoFinanceiro: "EXTERNO", clienteId: null, canalId: null, canalNomeSnapshot: "Site", compradorSnapshot: { nome: "Comprador fictício" }, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatarioSnapshot: null, enderecoSnapshot: null, observacoes: "", subtotal: "10", desconto: "0", frete: "0", total: "10", confirmadoEm: "2026-10-01T12:00:00Z", entregueEm: null, rascunho: null, itens: [], historico: [], historicoFinanceiro: [] };
const capacidades = { rascunho: false, confirmar: false, revisar: true, desconto: false, preco: false, cancelar: false, receber: false, condicao: false };
beforeEach(() => { vi.clearAllMocks(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
it("salvar orçamento usa laranja próprio de salvamento e confirmar mantém a ação principal", () => {
  render(<EditorPedido pedido={{ ...pedido, status: "RASCUNHO", rascunho: { atendimento: "RETIRADA", itens: [] } }} dados={dados} capacidades={{ ...capacidades, rascunho: true, confirmar: true }} emDialogo />);
  const salvar = screen.getByRole("button", { name: "Salvar orçamento" });
  expect(salvar.className).toContain("bg-[var(--ds-salvar-claro)]");
  expect(salvar.className.split(" ")).not.toContain("bg-destructive");
  expect(screen.getByRole("button", { name: "Confirmar pedido" }).className).toContain("bg-primary");
});
it.each(["EM_PREPARO", "PRONTO", "EM_ENTREGA", "ENTREGUE"])("editor considera a etapa %s para cancelar e preserva a entrega histórica", statusOperacional => {
  render(<EditorPedido pedido={{ ...pedido, statusOperacional, entregueEm: "2026-10-01T14:00:00Z" }} dados={dados} capacidades={{ ...capacidades, cancelar: true }} emDialogo />);
  const confirmar = screen.queryByRole("button", { name: "Confirmar cancelamento" });
  if (statusOperacional === "ENTREGUE") expect(confirmar).toBeNull();
  else expect(confirmar?.className.split(" ")).toContain("bg-destructive");
});
it("Novo pedido oferece somente grupos obrigatórios pelo vínculo, em linhas compactas", () => {
  const opcao = { id: "opcao", grupoId: "obrigatorio", nome: "Complemento obrigatório fictício", preco: "4", quantidade: "1", produtoId: null, ordem: 0, ativo: true };
  const grupo = { id: "obrigatorio", nome: "Obrigatório fictício", tipo: "COMPLEMENTAR", minimo: 0, maximo: 2, repetir: false, ativo: true, opcoes: [opcao] };
  const produto = { id: "produto", nome: "Produto fictício", ativo: true, unidade: "UN", preco: "10", classificacoes: ["PRINCIPAL"], categorias: [], grupos: [{ grupoId: "obrigatorio", usarPadrao: false, minimo: 1, maximo: 2 }, { grupoId: "opcional", usarPadrao: false, minimo: 0, maximo: 2 }, { grupoId: "extras", usarPadrao: false, minimo: 1, maximo: 2 }] };
  const catalogo = { ...dados.catalogo, produtos: [produto], grupos: [grupo, { ...grupo, id: "opcional", nome: "Opcional fictício", minimo: 1, opcoes: [{ ...opcao, id: "opcional", nome: "Opção oculta" }] }, { ...grupo, id: "extras", nome: "Extras ocultos", tipo: "EXTRAS" }] };
  render(<EditorPedido pedido={{ ...pedido, status: "RASCUNHO", rascunho: { atendimento: "RETIRADA", itens: [{ produtoId: "produto", quantidade: "1", escolhas: { opcao: 1 }, precoManual: null }] } }} dados={{ ...dados, catalogo } as unknown as typeof dados} capacidades={{ ...capacidades, rascunho: true }} emDialogo />);
  expect(screen.getByText("Obrigatório fictício")).toBeTruthy();
  expect(screen.queryByText("Opcional fictício")).toBeNull();
  expect(screen.queryByText("Extras ocultos")).toBeNull();
  const quantidade = screen.getByRole("spinbutton", { name: "Quantidade de Complemento obrigatório fictício no produto 1" });
  fireEvent.change(quantidade, { target: { value: "2" } }); expect((quantidade as HTMLInputElement).value).toBe("1");
  expect(screen.getByRole("button", { name: "Aumentar Quantidade de Complemento obrigatório fictício no produto 1" })).toHaveProperty("disabled", true);
  expect((screen.getByRole("textbox", { name: "Preço de Complemento obrigatório fictício no produto 1" }) as HTMLInputElement).readOnly).toBe(true);
});
it.each([
  { repassado: "0", concluido: null, rotulo: "Capturado; repasse pendente" },
  { repassado: "100", concluido: null, rotulo: "Capturado; repasse parcial" },
  { repassado: "300", concluido: "2026-10-04T00:00:00Z", rotulo: "Capturado; repasse concluído" },
])("cartão informa $rotulo conforme os repasses efetivos", ({ repassado, concluido, rotulo }) => {
  const financeiro = { recebido: repassado, saldo: "0", titulos: [{ id: "titulo", raiz: "parcela-1", valorOriginal: "300", valor: "300", status: "BAIXADO", vencimento: "2026-10-02T00:00:00Z", forma: { tipo: "CARTAO_CREDITO", nome: "Cartão fictício" }, dataPagamento: "2026-10-04T00:00:00Z" }], externos: [{ id: "captura", tituloId: "titulo", tipo: "CARTAO", status: "CAPTURADO", valorBruto: "300", parcelasCliente: 2, referenciaExterna: "captura-ficticia", documentoExterno: null, vencimentoExterno: null, confirmadoEm: "2026-10-02T00:00:00Z", taxa: "9", valorLiquido: "291", previsaoRepasse: null, repassadoEm: concluido }], repasses: repassado === "0" ? [] : [{ id: "repasse", pagamentoId: "captura", valorBruto: repassado, taxa: "0", valorLiquido: repassado, data: "2026-10-04T00:00:00Z" }] };
  render(<EditorPedido pedido={{ ...pedido, modoFinanceiro: "HUB", versaoFinanceiro: 1, financeiro }} dados={dados} capacidades={{ ...capacidades, receber: true, estornar: true, condicao: true }} emDialogo />);
  expect(screen.getByText(`Cartão · ${rotulo}`)).toBeTruthy();
  expect(Boolean(screen.queryByRole("button", { name: "Registrar repasse" }))).toBe(!concluido);
});
it("restauração total preserva o histórico e encerra a oferta de restaurar o mesmo crédito", () => {
  const financeiro = { recebido: "350.00", saldo: "0.00", creditoAplicado: "250.00", creditoRestaurado: "250.00", creditoRestauravel: "0.00", titulos: [] };
  render(<EditorPedido pedido={{ ...pedido, modoFinanceiro: "HUB", versaoFinanceiro: 1, financeiro }} dados={dados} capacidades={{ ...capacidades, cancelar: true, receber: true, condicao: true }} emDialogo />);
  expect(screen.getByText(/Crédito já restaurado deste pedido: R\$\s*250,00/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Restaurar crédito aprovado" })).toBeNull();
});
it("rascunho da correção financeira não marca o pedido comercial como editado", async () => {
  corrigir.mockResolvedValue({ ok: true });
  const financeiro = { recebido: "10.00", saldo: "0.00", titulos: [{ id: "titulo", revisao: "2026-10-02T12:00:00Z", raiz: "parcela-1", valorOriginal: "10", valor: "10", status: "BAIXADO", vencimento: "2026-10-02T12:00:00Z", forma: { tipo: "PIX", nome: "Pix fictício" }, dataPagamento: "2026-10-02T12:00:00Z" }] };
  render(<ModalPedido titulo="Pedido fictício" descricao="Teste de navegação" retorno={retorno} protegerAlteracoes><EditorPedido pedido={{ ...pedido, modoFinanceiro: "HUB", financeiro }} dados={dados} capacidades={{ ...capacidades, receber: true, estornar: true, condicao: true }} emDialogo /></ModalPedido>);
  fireEvent.click(screen.getByRole("button", { name: "Corrigir registro de recebimento" }));
  fireEvent.change(await screen.findByLabelText("Justificativa da correção"), { target: { value: "Correção fictícia" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar correção" }));
  await waitFor(() => expect(corrigir).toHaveBeenCalledWith(pedido.id, "titulo", "2026-10-02T12:00:00Z", "Correção fictícia", expect.any(String)));
  expect(screen.queryByText("Salve ou descarte as alterações comerciais antes desta ação.")).toBeNull();
});
it.each(["editor", "ocorrência"])("Comanda protege alterações de %s, mantém foco e abre destino apenas após descarte", async origem => {
  render(<ModalPedido titulo="Pedido fictício" descricao="Teste de navegação" retorno={retorno} protegerAlteracoes><EditorPedido pedido={pedido} dados={dados} capacidades={capacidades} emDialogo /><OcorrenciasPedido pedido={{ id: pedido.id, versao: 3, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", previsaoData: null, previsaoJanela: null, historico: [] }} editar /></ModalPedido>);
  if (origem === "editor") fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "Edição não salva" } });
  else fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência não salva" } });
  const comanda = screen.getByRole("link", { name: "Comanda de produção · A4 ou 80 mm" });
  comanda.focus(); fireEvent.click(comanda);
  await screen.findByText("Sair sem salvar?"); expect(replace).not.toHaveBeenCalled(); expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continuar editando" })));
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  await waitFor(() => expect(document.activeElement).toBe(comanda));
  expect((screen.getByLabelText(origem === "editor" ? "Observações" : "Motivo / descrição") as HTMLInputElement).value).toContain("não salva");
  fireEvent.click(comanda); fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
  const url = new URL(replace.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
  expect(url.pathname).toBe("/vendas/pedidos/pedido-ficticio/comanda"); expect(url.searchParams.get("retorno")).toBe(retorno);
  expect(screen.queryByRole("button", { name: "Preparação e entrega" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Configurar Entregas" })).toBeNull();
});

it("devolução sem retenção exige motivo visível e preserva o rascunho de crédito após atualizar", async () => {
  const financeiro = { recebido: "350", saldo: "0", elegivel: "350", titulos: [], externos: [], tratamentos: [] };
  const p = { ...pedido, modoFinanceiro: "HUB", versaoFinanceiro: 1, status: "CANCELADO", financeiro };
  const cap = { ...capacidades, cancelar: true, receber: true, condicao: true };
  devolver.mockResolvedValue({ tratamento: { id: "dev", tipo: "DEVOLUCAO", status: "SOLICITADA", valor: "100", retido: "0", motivo: "Cancelamento fictício" } });
  const view = (valor: typeof p) => <ModalPedido titulo="Pedido fictício" descricao="Teste de navegação" retorno={retorno} protegerAlteracoes><EditorPedido pedido={valor} dados={dados} capacidades={cap} emDialogo /></ModalPedido>;
  const { rerender } = render(view(p));
  expect(screen.getByRole("button", { name: "Solicitar devolução" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Valor a devolver" }), { target: { value: "100,00" } });
  fireEvent.change(screen.getByLabelText("Motivo da devolução"), { target: { value: "Cancelamento fictício" } });
  fireEvent.change(screen.getByLabelText("Referência da comunicação"), { target: { value: "Crédito em edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Solicitar devolução" }));
  await waitFor(() => expect(devolver).toHaveBeenCalledWith(p.id, "100.00", "0.00", "Cancelamento fictício", "", "", expect.any(String)));
  rerender(view({ ...p, versao: 4, financeiro: { ...financeiro, elegivel: "250" } }));
  expect((screen.getByLabelText("Referência da comunicação") as HTMLInputElement).value).toBe("Crédito em edição");
  expect(screen.getByText(/Valor disponível para tratamento:/).textContent).toContain("250");
  fireEvent.click(screen.getByRole("link", { name: "Comanda de produção · A4 ou 80 mm" }));
  expect(await screen.findByText("Sair sem salvar?")).toBeTruthy();
});
it("atualização externa preserva venda em edição e sua versão, sem sobrescrever concorrência", async () => {
  revisar.mockResolvedValue({ erro: "Pedido alterado por outro operador" });
  const { rerender } = render(<EditorPedido pedido={pedido} dados={dados} capacidades={capacidades} emDialogo />);
  fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "Texto ainda não salvo" } });
  rerender(<EditorPedido pedido={{ ...pedido, versao: 4, observacoes: "Alteração de outro operador" }} dados={dados} capacidades={capacidades} emDialogo />);
  expect((screen.getByLabelText("Observações") as HTMLInputElement).value).toBe("Texto ainda não salvo");
  fireEvent.click(screen.getByRole("button", { name: "Registrar revisão" }));
  await waitFor(() => expect(revisar).toHaveBeenCalledWith(pedido.id, 3, expect.objectContaining({ observacoes: "Texto ainda não salvo" }), expect.any(String)));
});

it("trava os campos durante a solicitação e devolve o rascunho intacto após falha", async () => {
  let responder!: (valor: { erro: string }) => void;
  devolver.mockImplementation(() => new Promise(resolve => { responder = resolve; }));
  render(<EditorPedido pedido={{ ...pedido, modoFinanceiro: "HUB", versaoFinanceiro: 1, status: "CANCELADO", financeiro: { recebido: "350", saldo: "0", elegivel: "350", titulos: [], externos: [], tratamentos: [] } }} dados={dados} capacidades={{ ...capacidades, cancelar: true, receber: true, condicao: true }} emDialogo />);
  const motivo = screen.getByLabelText("Motivo da devolução") as HTMLInputElement;
  const comunicacao = screen.getByLabelText("Referência da comunicação") as HTMLInputElement;
  fireEvent.change(screen.getByRole("textbox", { name: "Valor a devolver" }), { target: { value: "100,00" } });
  fireEvent.change(motivo, { target: { value: "Motivo preservado" } });
  fireEvent.change(comunicacao, { target: { value: "Crédito ainda em edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Solicitar devolução" }));
  await waitFor(() => expect(devolver).toHaveBeenCalledTimes(1));
  expect(motivo.matches(":disabled")).toBe(true);
  expect(comunicacao.matches(":disabled")).toBe(true);
  await act(async () => responder({ erro: "Falha transitória fictícia" }));
  expect(await screen.findByText("Falha transitória fictícia")).toBeTruthy();
  expect(motivo.matches(":disabled")).toBe(false);
  expect(motivo.value).toBe("Motivo preservado");
  expect(comunicacao.value).toBe("Crédito ainda em edição");
});

it("seleção de pagamento também preserva rascunho e versão diante de atualização externa", async () => {
  const usuario = userEvent.setup();
  revisar.mockResolvedValue({ erro: "Conflito de versão fictício" });
  const opcoes = { ...dados, formas: [{ id: "pix", nome: "Pix fictício", tipo: "PIX", permiteParcelamento: false, maximoParcelas: 1 }] } as typeof dados;
  const { rerender } = render(<EditorPedido pedido={pedido} dados={opcoes} capacidades={capacidades} emDialogo />);
  await usuario.click(screen.getByRole("combobox", { name: "Forma de pagamento" }));
  await usuario.click(await screen.findByRole("option", { name: "Pix fictício" }));
  rerender(<EditorPedido pedido={{ ...pedido, versao: 4 }} dados={opcoes} capacidades={capacidades} emDialogo />);
  expect(screen.getByRole("combobox", { name: "Forma de pagamento" }).textContent).toContain("Pix fictício");
  fireEvent.click(screen.getByRole("button", { name: "Registrar revisão" }));
  await waitFor(() => expect(revisar).toHaveBeenCalledWith(pedido.id, 3, expect.objectContaining({ pagamentoInformado: { formaId: "pix", parcelas: 1, vencimentos: [] } }), expect.any(String)));
});
