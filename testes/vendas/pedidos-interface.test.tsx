// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/produtos/embalagens-actions",()=>({salvarTipoEmbalagemAction:vi.fn()}));
vi.mock("@/app/(protegido)/vendas/pedidos/entregas-actions", () => ({ calcularFretePedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/custos-entrega-actions", () => ({ salvarCustoEntregaAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({
  criarRascunhoPedidoAction: vi.fn(), salvarRascunhoPedidoAction: vi.fn(), confirmarPedidoVendaAction: vi.fn(),
  revisarPedidoVendaAction: vi.fn(), cancelarPedidoVendaAction: vi.fn(), registrarEntregaPedidoVendaAction: vi.fn(),
  consultarCreditoClientePedidoAction: vi.fn(async () => ({ ok: true, limite: "50000.00", emAberto: "1200.00", disponivel: "48800.00" })),
}));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), criarClienteDoPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));

import { criarRascunhoPedidoAction, salvarRascunhoPedidoAction, confirmarPedidoVendaAction } from "@/app/(protegido)/vendas/pedidos/actions";
import { buscarCepPedidoAction } from "@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions";
import userEvent from "@testing-library/user-event";
import { ModalNovoPedido } from "@/app/(protegido)/vendas/pedidos/@modal/(.)novo/modal-novo-pedido";
import { EditorPedido } from "@/app/(protegido)/vendas/pedidos/editor-pedido";

afterEach(cleanup);
async function escolherCobranca(nome: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Endereço de cobrança" }));
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(`^${nome}( ·|$)`) }));
}

describe("livro de entregas no pedido", () => {
  const entrega = (numero: string, nome: string) => ({ destinatario: { nome, contato: "+5511999990000" }, endereco: { ...cobranca, numero } });
  function dadosComEntregas() {
    const primeira = entrega("101", "Primeira destinatária"), segunda = { ...entrega("202", "Segunda destinatária"), textoOriginal: "Referência original preservada\nSem alteração na fonte" };
    return { ...dadosFormulario, clientes: dadosFormulario.clientes.map(c => ({ ...c, versao: 3, enderecos: [...c.enderecos, { ...cobranca, tipo: "PF" as const, nomeCompleto: "Titular da segunda cobrança", telefone: "+5511988880000", numero: "303" }], entregaPadrao: { ...primeira, enderecos: [primeira, segunda], selecionado: 0 } })) };
  }
  it("seleciona e edita só a segunda entrega, copia a cobrança selecionada e preserva a primeira", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear(); vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência do livro sintético" });
    render(<EditorPedido dados={dadosComEntregas()} capacidades={{ ...capacidades, editarCliente: true }} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" })); await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    await usuario.click(screen.getByRole("combobox", { name: "Endereço de entrega" })); await usuario.click(await screen.findByRole("option", { name: /Entrega 2 · Segunda destinatária/ }));
    const slot = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
    expect((slot.getByLabelText("Número *") as HTMLInputElement).value).toBe("202");
    expect(slot.getByText(/Referência original preservada/)).toBeTruthy();
    fireEvent.change(slot.getByLabelText("Nome Completo *"), { target: { value: "Segunda atualizada" } });
    await escolherCobranca("Cobrança 2");
    fireEvent.click(screen.getByRole("button", { name: "Copiar endereço de cobrança" }));
    expect((slot.getByLabelText("Número *") as HTMLInputElement).value).toBe("303");
    expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" })); await screen.findByText("Conferência do livro sintético");
    expect(vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0]).toMatchObject({
      destinatario: { nome: "Titular da segunda cobrança", contato: "+5511988880000" }, endereco: { numero: "303" },
      clienteAtualizacao: { entregaPadrao: { selecionado: 1, endereco: { numero: "303" }, enderecos: [
        { destinatario: { nome: "Primeira destinatária" }, endereco: { numero: "101" } },
        { destinatario: { nome: "Titular da segunda cobrança", contato: "+5511988880000" }, endereco: { numero: "303" }, textoOriginal: "Referência original preservada\nSem alteração na fonte" },
      ] } },
    });
  });
  it("reabre endereço próprio do pedido sem sobrescrever opção cadastral por semelhança", async () => {
    vi.mocked(salvarRascunhoPedidoAction).mockClear(); vi.mocked(salvarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência do endereço próprio" });
    const proprio = entrega("999", "Destinatário deste pedido"), pedido = { id: "pedido-entrega-propria", numero: 7, versao: 2, status: "RASCUNHO", historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", atendimento: "ENTREGA", prazo: "IMEDIATO", itens: [], cobranca, ...proprio } };
    render(<EditorPedido dados={dadosComEntregas()} pedido={pedido} capacidades={{ ...capacidades, editarCliente: true }} />);
    expect((screen.getByRole("combobox", { name: "Endereço de entrega" }) as HTMLInputElement).value).toBe("Endereço deste pedido");
    const slot = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
    fireEvent.change(slot.getByLabelText("Nome Completo"), { target: { value: "Destinatário próprio atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" })); await screen.findByText("Conferência do endereço próprio");
    const enviado = vi.mocked(salvarRascunhoPedidoAction).mock.lastCall?.[2];
    expect(enviado).toMatchObject({ destinatario: { nome: "Destinatário próprio atualizado" }, endereco: { numero: "999" } });
    expect(enviado).not.toHaveProperty("clienteAtualizacao");
  });
  it("escolher entrega sem permissão cadastral altera só o pedido e mantém adicionar/remover bloqueados", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear(); vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência sem edição cadastral" });
    render(<EditorPedido dados={dadosComEntregas()} capacidades={{ ...capacidades, editarCliente: false }} />);
    const usuario = userEvent.setup(); await usuario.click(screen.getByRole("combobox", { name: "Cliente" })); await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    await usuario.click(screen.getByRole("combobox", { name: "Endereço de entrega" })); await usuario.click(await screen.findByRole("option", { name: /Entrega 2 · Segunda destinatária/ }));
    expect((screen.getByRole("button", { name: "Adicionar endereço de entrega" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Remover entrega 2" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" })); await screen.findByText("Conferência sem edição cadastral");
    const enviado = vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0];
    expect(enviado).toMatchObject({ destinatario: { nome: "Segunda destinatária" }, endereco: { numero: "202" } }); expect(enviado).not.toHaveProperty("clienteAtualizacao");
  });
  it("adiciona e remove uma entrega no rascunho sem perder opções anteriores nem salvar ao sair do campo", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear(); vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência da remoção da entrega" });
    render(<EditorPedido dados={dadosComEntregas()} capacidades={{ ...capacidades, editarCliente: true }} />);
    const usuario = userEvent.setup(); await usuario.click(screen.getByRole("combobox", { name: "Cliente" })); await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar endereço de entrega" }));
    const modal = within(screen.getByRole("dialog", { name: "Adicionar endereço de entrega" }));
    fireEvent.change(modal.getByLabelText("Nome Completo *"), { target: { value: "Nova destinatária descartada" } });
    vi.mocked(buscarCepPedidoAction).mockResolvedValueOnce({ endereco: { logradouro: "Rua Sintética Nova", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
    fireEvent.change(modal.getByLabelText("CEP *"), { target: { value: "01001000" } });
    fireEvent.blur(modal.getByLabelText("CEP *"));
    await waitFor(() => expect(modal.getByLabelText("Logradouro *")).toHaveProperty("value", "Rua Sintética Nova"));
    fireEvent.change(modal.getByLabelText("Número *"), { target: { value: "404" } });
    expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
    await usuario.click(modal.getByRole("button", { name: "Adicionar endereço" }));
    const slot = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
    fireEvent.blur(slot.getByLabelText("Nome Completo *")); expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remover entrega 3" }));
    await usuario.click(screen.getByRole("button", { name: "Confirmar remoção de Entrega 3" }));
    expect((slot.getByLabelText("Nome Completo *") as HTMLInputElement).value).toBe("Segunda destinatária");
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" })); await screen.findByText("Conferência da remoção da entrega");
    const enviado = vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0] as { clienteAtualizacao?: { entregaPadrao?: import("@/lib/vendas/dominio").EntregaPadraoCliente | null } } | undefined;
    const livro = enviado?.clienteAtualizacao?.entregaPadrao;
    expect(livro?.enderecos).toHaveLength(2); expect(livro?.enderecos?.map(e => e.endereco.numero)).toEqual(["101", "202"]);
    expect(livro?.selecionado).toBe(1); expect(livro?.textoOriginal).toContain("Referência original preservada");
  });
});

const catalogoComplementos = {
  categorias: [],
  produtos: [
    { id: "principal", nome: "Kit de teste", ativo: true, classificacoes: ["PRINCIPAL"], unidade: "UN", categorias: [], grupos: [{ grupoId: "obrigatorio", usarPadrao: false, minimo: 1, maximo: 1 }, { grupoId: "opcional", usarPadrao: false, minimo: 0, maximo: 2 }], preco: "30" },
    { id: "complemento", nome: "Queijo inteiro", ativo: true, classificacoes: ["COMPLEMENTO"], unidade: "KG", categorias: [], grupos: [], preco: "50" },
  ],
  grupos: [
    { id: "obrigatorio", nome: "Tamanho obrigatório", tipo: "COMPOSICAO", ativo: true, minimo: 0, maximo: 1, repetir: false, opcoes: [{ id: "tamanho", nome: "Médio", ativo: true, preco: "10", quantidade: "1", produtoId: null }] },
    { id: "opcional", nome: "Porções adicionais", tipo: "COMPLEMENTAR", ativo: true, minimo: 1, maximo: 2, repetir: false, opcoes: [{ id: "porcao", nome: "Porção de queijo", ativo: true, preco: "7.25", quantidade: "0.3", produtoId: "complemento" }, { id: "sem-ficha", nome: "Sem produto vinculado", ativo: true, preco: "2", quantidade: "1", produtoId: null }] },
  ],
};

describe("complementos dentro do produto e leitura de porções históricas", () => {
  it("mostra somente grupos obrigatórios e salva as escolhas no mesmo item", async () => {
    const usuario = userEvent.setup();
    const dados = { ...dadosFormulario, catalogo: catalogoComplementos, canais: [{ id: "site", nome: "SITE" }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
    render(<EditorPedido dados={dados} capacidades={capacidades} />);
    await usuario.click(screen.getByRole("button", { name: "Adicionar produto" }));
    await usuario.click(screen.getByRole("combobox", { name: "Produto 1" }));
    expect(screen.queryByRole("option", { name: "Queijo inteiro" })).toBeNull();
    await usuario.click(await screen.findByRole("option", { name: "Kit de teste" }));
    expect(screen.getByText("Tamanho obrigatório")).toBeTruthy();
    expect(screen.queryByText("Porções adicionais")).toBeNull();
    expect(screen.queryByLabelText(/Porção de queijo/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Quantidade de Médio no produto 1"), { target: { value: "1" } });
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência sintética" });
    await usuario.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Conferência sintética");
    expect(vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0]).toMatchObject({ itens: [{ produtoId: "principal", escolhas: { tamanho: 1 } }] });
    expect(vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0]).toHaveProperty("itens.length", 1);
  });
  it("oculta opcionais mas preserva escolhas anteriores ao salvar um ajuste obrigatório", async () => {
    const dados = { ...dadosFormulario, catalogo: catalogoComplementos } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
    const pedido = { id: "anterior", numero: 1, versao: 1, status: "RASCUNHO", modoFinanceiro: "EXTERNO", historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: null, canalId: null, atendimento: "RETIRADA", prazo: "IMEDIATO", observacoes: "", desconto: "0", frete: "0", itens: [{ produtoId: "principal", quantidade: "1", escolhas: { porcao: 2 }, precoManual: null }] } };
    render(<EditorPedido dados={dados} pedido={pedido} capacidades={capacidades} />);
    expect(screen.queryByText("Porções adicionais")).toBeNull();
    expect(screen.queryByLabelText(/Porção de queijo/)).toBeNull();
    expect(screen.queryByLabelText(/Sem produto vinculado/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Quantidade de Médio no produto 1"), { target: { value: "1" } });
    expect(screen.getByText("Valor total").parentElement?.textContent).toContain("54,50");
    vi.mocked(salvarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência de escolhas históricas" });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Conferência de escolhas históricas");
    expect(vi.mocked(salvarRascunhoPedidoAction).mock.lastCall?.[2]).toMatchObject({ itens: [{ escolhas: { porcao: 2, tamanho: 1 } }] });
  });
  it("reabre porção confirmada com origem e unidade comercial em vez de trocar para o produto-base", () => {
    const dados = { ...dadosFormulario, catalogo: catalogoComplementos, canais: [{ id: "site", nome: "SITE" }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
    const pedido = { id: "confirmado", numero: 2, versao: 2, status: "CONFIRMADO", modoFinanceiro: "EXTERNO", clienteId: null, canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, subtotal: "14.50", total: "14.50", frete: "0", desconto: "0", historico: [], historicoFinanceiro: [], itens: [{ produtoId: "complemento", quantidade: "2", unidadeSnapshot: "UN", precoOriginal: "7.25", precoAplicado: "7.25", acrescimos: "0", totalLinha: "14.50", escolhasSnapshot: [], produtoSnapshot: { nome: "Porção de queijo", complementoAvulso: { produtoOrigemId: "principal", grupoId: "opcional", opcaoId: "porcao" } } }] };
    render(<EditorPedido dados={dados} pedido={pedido} capacidades={{ ...capacidades, revisar: true }} />);
    expect((screen.getByRole("combobox", { name: "Produto 1" }) as HTMLInputElement).value).toBe("Porção de queijo");
    expect((screen.getByRole("spinbutton", { name: "Qtd. do produto 1 em UN" }) as HTMLInputElement).value).toBe("2");
    expect(screen.queryByRole("spinbutton", { name: /em KG/ })).toBeNull();
  });
});

describe("detalhe histórico de Pedidos", () => {
  it("mostra comprador, produto, escolha e total confirmados mesmo sem cadastro atual disponível", () => {
    const dados = { catalogo: { produtos: [], grupos: [], categorias: [] }, clientes: [], canais: [] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
    const pedido = {
      id: "pedido-sintetico", numero: 42, versao: 2, status: "CONFIRMADO", clienteId: "cliente-antigo", canalId: "canal-antigo", canalNomeSnapshot: "INTERNO",
      compradorSnapshot: { nome: "Comprador original" }, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null,
      destinatarioSnapshot: { nome: "Comprador original", contato: "" }, enderecoSnapshot: null, observacoes: "", subtotal: "120", desconto: "10", frete: "0", total: "110",
      confirmadoEm: "2026-09-24T12:00:00.000Z", entregueEm: null, rascunho: null,
      itens: [{ produtoId: "produto-antigo", quantidade: "1", unidadeSnapshot: "UN", precoOriginal: "0", precoAplicado: "0", acrescimos: "120", desconto: "10", totalLinha: "110", estadoComposicao: "PENDENTE", produtoSnapshot: { nome: "Caixa original", tipoEmbalagem: { id: "caixa-historica", nome: "Embalagem histórica" } }, escolhasSnapshot: [{ opcaoId: "opcao-antiga", opcaoNome: "Tamanho médio", quantidade: 1 }] }],
      historico: [], historicoFinanceiro: [],
    };
    render(<EditorPedido dados={dados} pedido={pedido} capacidades={{ rascunho: false, confirmar: false, revisar: false, desconto: false, preco: false, cancelar: false, receber: false, condicao: false }} />);
    const resumo = screen.getByRole("heading", { name: "Venda comercial registrada" }).closest("section")!;
    expect(resumo.textContent).toContain("Comprador original");
    expect(resumo.textContent).toContain("Caixa original");
    expect(resumo.textContent).toContain("Tamanho médio");
    expect(resumo.textContent).toContain("R$ 110,00");
    expect(resumo.textContent).toContain("Composição e CMV pendentes");
    expect(resumo.textContent).not.toContain("Embalagem histórica");
  });
});

const capacidades = { rascunho: true, confirmar: true, revisar: false, desconto: true, preco: false, cancelar: false, receber: false, condicao: false, criarCliente: true };
const cobranca = { destinatario: "", nome: "Cobrança", pais: "Brasil", cep: "01001000", logradouro: "Rua Fictícia", numero: "10", complemento: "Casa", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const dadosFormulario = { dataCompraPadrao: "2026-10-20", horarios: null, catalogo: { produtos: [], grupos: [], categorias: [] }, clientes: [{ id: "cliente-ficticio", nome: "Cliente Fictício", primeiroNome: "Cliente", sobrenome: "Fictício", tipo: "PJ", documento: "12345678000190", razaoSocial: "Empresa Fictícia", inscricaoEstadual: "123", email: "cliente@example.invalid", dataNascimento: "2000-01-01", telefone: "+5511999990000", contato: null, enderecos: [cobranca] }], canais: [], formas: [], categorias: [], contas: [], categoriasTaxa: [], categoriasDevolucao: [], creditos: {} } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];

describe("Data da compra junto ao pagamento", () => {
  it("inicia com hoje da loja, mantém a data de entrega separada e só grava ao salvar", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência da compra retroativa" });
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} dataInicial="2026-11-12" />);
    const compra = screen.getByLabelText("Data da compra");
    expect(compra).toHaveProperty("value", "2026-10-20");
    expect(screen.getByLabelText("Data de entrega")).toHaveProperty("value", "2026-11-12");
    expect(compra.closest("[data-pedido-campo=pagamento]")?.contains(screen.getByRole("combobox", { name: "Forma de pagamento" }))).toBe(true);
    fireEvent.change(compra, { target: { value: "2026-09-30" } });
    fireEvent.blur(compra);
    expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Conferência da compra retroativa");
    expect(vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0]).toMatchObject({ dataCompra: "2026-09-30", previsaoData: "2026-11-12" });
  });
  it("reabre a data salva em orçamento manual externo e conserva alterações durante refresh", () => {
    const pedido = { id: "compra-data", numero: 51, versao: 1, origem: "INTERNO", status: "RASCUNHO", modoFinanceiro: "EXTERNO", dataCompra: "2026-09-30", historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", atendimento: "RETIRADA", prazo: "IMEDIATO", itens: [], cobranca } };
    const tela = render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} pedido={pedido} />);
    expect(screen.getByLabelText("Data da compra")).toHaveProperty("value", "2026-09-30");
    expect(screen.getByLabelText("Data da compra")).toHaveProperty("readOnly", false);
    fireEvent.change(screen.getByLabelText("Data da compra"), { target: { value: "2026-09-29" } });
    tela.rerender(<EditorPedido dados={dadosFormulario} capacidades={capacidades} pedido={{ ...pedido, versao: 2 }} />);
    expect(screen.getByLabelText("Data da compra")).toHaveProperty("value", "2026-09-29");
  });
  it("não presume hoje para orçamento antigo sem data e bloqueia a data de integração", () => {
    const pedido = { id: "compra-legada", numero: 52, versao: 1, origem: "IFOOD", status: "RASCUNHO", modoFinanceiro: "EXTERNO", dataCompra: null, historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", atendimento: "RETIRADA", prazo: "IMEDIATO", itens: [], cobranca } };
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} pedido={pedido} />);
    expect(screen.getByLabelText("Data da compra")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Data da compra")).toHaveProperty("readOnly", true);
    fireEvent.change(screen.getByLabelText("Data da compra"), { target: { value: "2026-10-20" } });
    expect(screen.getByLabelText("Data da compra")).toHaveProperty("value", "");
  });
  it("permite desistir da data digitada em orçamento legado sem obrigar preenchimento histórico", async () => {
    vi.mocked(salvarRascunhoPedidoAction).mockClear();
    vi.mocked(salvarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência do legado sem data" });
    const pedido = { id: "compra-legada-manual", numero: 54, versao: 1, origem: "INTERNO", status: "RASCUNHO", modoFinanceiro: "EXTERNO", dataCompra: null, historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", atendimento: "RETIRADA", prazo: "IMEDIATO", itens: [], cobranca } };
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} pedido={pedido} />);
    const compra = screen.getByLabelText("Data da compra");
    expect(compra).toHaveProperty("required", false);
    fireEvent.change(compra, { target: { value: "2026-09-30" } });
    fireEvent.change(compra, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Conferência do legado sem data");
    expect(vi.mocked(salvarRascunhoPedidoAction).mock.lastCall?.[2]).not.toHaveProperty("dataCompra");
  });
});

it.each([
  ["  CLIENTE@EXAMPLE.INVALID  ", "Cliente Fictício"],
  ["12.345.678/0001-90", "Cliente Fictício"],
  ["123.456.789-09", "Pessoa Sintética"],
  ["  EMAIL.ALIAS@EXAMPLE.INVALID  ", "Cliente Fictício"],
  ["987.654.321-00", "Cliente Fictício"],
])("busca cliente por %s sem alterar o nome exibido nem criar cadastro", async (consulta, nome) => {
  const pessoa = { ...dadosFormulario.clientes[0], id: "pessoa-sintetica", nome: "Pessoa Sintética", tipo: "PF", documento: "12345678909", email: "pessoa@example.invalid" };
  const raiz = { ...dadosFormulario.clientes[0], emailsAlternativos: ["email.alias@example.invalid"], documentosAlternativos: ["98765432100"] };
  render(<EditorPedido dados={{ ...dadosFormulario, clientes: [raiz, pessoa] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"]} capacidades={capacidades} />);
  const usuario = userEvent.setup(), busca = screen.getByRole("combobox", { name: "Cliente" });
  expect(busca).toHaveProperty("placeholder", "Nome, e-mail ou CPF/CNPJ");
  await usuario.click(busca);
  await usuario.type(busca, consulta);
  const opcao = await screen.findByRole("option", { name: nome });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  await usuario.click(opcao);
  expect(busca).toHaveProperty("value", nome);
  expect(screen.getByLabelText("E-mail")).toHaveProperty("value", nome === "Pessoa Sintética" ? "pessoa@example.invalid" : "cliente@example.invalid");
  expect(screen.getByLabelText("E-mail")).toHaveProperty("readOnly", true);
  expect(screen.getByLabelText("E-mail")).toHaveProperty("required", false);
  expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
});

it("busca pelo e-mail antigo e salva o orçamento com o ID da raiz sem gravar os dados de busca", async () => {
  const raiz = { ...dadosFormulario.clientes[0], emailsAlternativos: ["email.alias@example.invalid"], documentosAlternativos: ["98765432100"] };
  render(<EditorPedido dados={{ ...dadosFormulario, clientes: [raiz] }} capacidades={capacidades} />);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
  await usuario.type(screen.getByRole("combobox", { name: "Cliente" }), "email.alias@example.invalid");
  await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
  vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência da raiz selecionada" });
  fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
  await screen.findByText("Conferência da raiz selecionada");
  const entrada = vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0];
  expect(entrada).toHaveProperty("clienteId", raiz.id);
  expect(entrada).not.toHaveProperty("clienteNovo");
  expect(entrada).not.toHaveProperty("clienteAtualizacao");
  expect(JSON.stringify(entrada)).not.toContain("email.alias@example.invalid");
  expect(JSON.stringify(entrada)).not.toContain("documentosAlternativos");
});

it("exige e-mail válido para salvar cadastro novo e mantém foco no campo sem gravar", async () => {
  render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
  const email = screen.getByLabelText("E-mail");
  expect(email.matches(":disabled")).toBe(false);
  expect(email).toHaveProperty("required", true);
  await escolherTipo();
  fireEvent.change(screen.getAllByLabelText("Nome Completo *")[0], { target: { value: "Nova Pessoa" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
  await screen.findByText("Informe um e-mail válido para cadastrar o cliente.");
  await waitFor(() => expect(document.activeElement).toBe(email));
  expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
  fireEvent.change(email, { target: { value: "emailsemarroba" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
  await screen.findByText("Informe um e-mail válido para cadastrar o cliente.");
  expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
});

it("conserva o primeiro e-mail colado antes do tipo no popup e mantém a proteção do rascunho", async () => {
  const usuario = userEvent.setup();
  render(<ModalNovoPedido><EditorPedido dados={dadosFormulario} capacidades={capacidades} emDialogo /></ModalNovoPedido>);
  const email = screen.getByLabelText("E-mail");
  await usuario.click(email);
  await usuario.paste("primeiro@example.invalid");
  expect(email).toHaveProperty("value", "primeiro@example.invalid");
  expect(screen.getByRole("combobox", { name: "Tipo de cliente" }).textContent).toContain("Selecione o tipo");
  await usuario.keyboard("{Escape}");
  expect(await screen.findByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
});

it("Principal usa documento JSON do cadastro sem herdar titular antigo do rascunho", async () => {
  const principalCadastro = { ...cobranca, tipo: "PF", nomeCompleto: "Titular do Cadastro", documento: "12345678909" };
  const principalRascunho = { ...cobranca, tipo: "PF", nomeCompleto: "Terceiro do Rascunho", documento: "98765432100", numero: "42" };
  const adicional = { ...cobranca, tipo: "PF", nomeCompleto: "Titular Adicional", documento: "11122233344", numero: "99" };
  const dados = { ...dadosFormulario, clientes: [{ ...dadosFormulario.clientes[0], tipo: "PF", nome: "Titular do Cadastro", documento: null, razaoSocial: null, inscricaoEstadual: null, enderecos: [principalCadastro] }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
  const pedido = { id: "rascunho-titular-legado", numero: 41, versao: 1, status: "RASCUNHO", modoFinanceiro: "EXTERNO", historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", atendimento: "RETIRADA", prazo: "IMEDIATO", observacoes: "", desconto: "0", frete: "0", itens: [], cobranca: principalRascunho, enderecosCobranca: [principalRascunho, adicional], cobrancaSelecionada: 0 } };
  render(<EditorPedido dados={dados} pedido={pedido} capacidades={{ ...capacidades, editarCliente: false }} />);
  const geral = within(screen.getByRole("heading", { name: "Informações gerais" }).closest("section")!);
  const principal = within(screen.getByRole("group", { name: "Principal" }));
  expect(geral.getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  expect(geral.getByLabelText("CPF")).toHaveProperty("readOnly", true);
  expect(principal.getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  expect(principal.getByLabelText("CPF")).toHaveProperty("readOnly", true);
  expect(principal.getByLabelText("Nome Completo")).toHaveProperty("value", "Titular do Cadastro");
  expect(principal.getByLabelText("Número")).toHaveProperty("value", "42");
  await escolherCobranca("Cobrança 2");
  const segunda = within(screen.getByRole("group", { name: "Cobrança 2" }));
  expect(segunda.getByLabelText("CPF")).toHaveProperty("value", "111.222.333-44");
  expect(segunda.getByLabelText("Nome Completo")).toHaveProperty("value", "Titular Adicional");
  expect(geral.getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  vi.mocked(salvarRascunhoPedidoAction).mockClear();
  vi.mocked(salvarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência do vínculo da Principal" });
  fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
  await screen.findByText("Conferência do vínculo da Principal");
  const entrada = vi.mocked(salvarRascunhoPedidoAction).mock.lastCall?.[2];
  expect(entrada).toMatchObject({ enderecosCobranca: [{ documento: "12345678909", nomeCompleto: "Titular do Cadastro", numero: "42" }, { documento: "11122233344", nomeCompleto: "Titular Adicional", numero: "99" }], cobrancaSelecionada: 1, cobranca: { documento: "11122233344" } });
  expect(entrada).not.toHaveProperty("clienteAtualizacao");
});

it("permite preencher a entrega antes do cadastro e mantém complemento opcional nos dois endereços", () => {
  render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
  const entrega = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
  for (const nome of ["CEP", "Número", "Complemento (opcional)"]) expect(entrega.getByLabelText(nome).matches(":disabled")).toBe(false);
  expect((entrega.getByLabelText("Complemento (opcional)") as HTMLInputElement).required).toBe(false);
  const cobranca = within(screen.getByRole("heading", { name: "Cobrança" }).parentElement!);
  expect((cobranca.getByLabelText("Complemento (opcional)") as HTMLInputElement).required).toBe(false);
});
const valor = (nome: string) => (screen.getAllByLabelText(nome)[0] as HTMLInputElement).value;

it("o máximo vale para o grupo inteiro e digitar outra opção não ultrapassa esse teto", async () => {
  const catalogo = { ...catalogoComplementos, grupos: catalogoComplementos.grupos.map(g => g.id !== "obrigatorio" ? g : { ...g, opcoes: [...g.opcoes, { ...g.opcoes[0], id: "segunda", nome: "Grande" }] }) };
  const pedido = { id: "rascunho-grupo", numero: 3, versao: 1, status: "RASCUNHO", modoFinanceiro: "HUB", historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", atendimento: "RETIRADA", prazo: "IMEDIATO", observacoes: "", desconto: "0", frete: "0", itens: [{ produtoId: "principal", quantidade: "1", escolhas: {}, precoManual: null }] } };
  render(<EditorPedido dados={{ ...dadosFormulario, catalogo } as unknown as React.ComponentProps<typeof EditorPedido>["dados"]} pedido={pedido} capacidades={capacidades} />);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Aumentar Quantidade de Médio no produto 1" }));
  expect(valor("Quantidade de Médio no produto 1")).toBe("1");
  expect(screen.getByRole("button", { name: "Aumentar Quantidade de Grande no produto 1" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Aumentar Quantidade de Médio no produto 1" })).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Quantidade de Grande no produto 1"), { target: { value: "1" } });
  expect(valor("Quantidade de Grande no produto 1")).toBe("0");
  await usuario.click(screen.getByRole("button", { name: "Diminuir Quantidade de Médio no produto 1" }));
  expect(screen.getByRole("button", { name: "Aumentar Quantidade de Grande no produto 1" })).toHaveProperty("disabled", false);
  await usuario.click(screen.getByRole("button", { name: "Aumentar Quantidade de Grande no produto 1" }));
  expect(valor("Quantidade de Grande no produto 1")).toBe("1");
});

it("valida apenas a cobrança selecionada sem edição e destaca e foca seu número pendente", async () => {
  vi.mocked(salvarRascunhoPedidoAction).mockClear(); vi.mocked(confirmarPedidoVendaAction).mockClear();
  const pedido = { id: "rascunho-endereco", numero: 4, versao: 1, status: "RASCUNHO", modoFinanceiro: "HUB", versaoFinanceiro: 1, historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", observacoes: "", desconto: "0", frete: "0", cobranca, enderecosCobranca: [cobranca, { ...cobranca, numero: "" }], cobrancaSelecionada: 1, itens: [], pagamentoInformado: { formaId: "pix", parcelas: 1, vencimentos: [] } } };
  render(<EditorPedido dados={dadosFormulario} pedido={pedido} capacidades={capacidades} />);
  await escolherCobranca("Principal");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar pedido" }));
  // Somente o endereço selecionado é usado quando o cadastro não foi alterado.
  expect(await screen.findByText("Adicione ao menos um produto antes de confirmar.")).toBeTruthy();
  await escolherCobranca("Cobrança 2");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar pedido" }));
  expect(await screen.findByText("Informe o número do endereço.")).toBeTruthy();
  const numero = within(screen.getByRole("group", { name: "Cobrança 2" })).getByLabelText("Número");
  await waitFor(() => expect(document.activeElement).toBe(numero));
  expect(numero.getAttribute("aria-invalid")).toBe("true");
  expect(salvarRascunhoPedidoAction).not.toHaveBeenCalled(); expect(confirmarPedidoVendaAction).not.toHaveBeenCalled();
});
async function escolherTipo(nome = "Pessoa Física") {
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
  await usuario.click(await screen.findByRole("option", { name: nome }));
}

describe("Novo Pedido sem janelas sobrepostas", () => {
  it("edita cadastro, cobrança e entrega padrão só ao salvar, mantendo o e-mail travado", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Falha sintética; rascunho preservado" });
    const dados = { ...dadosFormulario, clientes: dadosFormulario.clientes.map(c => ({ ...c, versao: 3, entregaPadrao: { destinatario: { nome: "Destinatária Inicial", contato: "" }, endereco: { ...cobranca, numero: "202" } } })) };
    render(<EditorPedido dados={dados} capacidades={{ ...capacidades, editarCliente: true }} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
    await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    expect((screen.getByLabelText("Nome Fantasia *") as HTMLInputElement).readOnly).toBe(false);
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "alterado@example.invalid" } });
    expect(valor("E-mail")).toBe("cliente@example.invalid");
    fireEvent.change(screen.getByLabelText("Nome Fantasia *"), { target: { value: "Fantasia atualizada" } });
    fireEvent.blur(screen.getByLabelText("Nome Fantasia *"));
    const camposCobranca = within(screen.getByRole("heading", { name: "Cobrança" }).closest("section")!);
    fireEvent.change(camposCobranca.getByLabelText("Número"), { target: { value: "42" } });
    const entrega = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
    fireEvent.change(entrega.getByLabelText("Nome Completo *"), { target: { value: "Nova destinatária" } });
    expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Falha sintética; rascunho preservado");
    expect(vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0]).toMatchObject({ clienteId: "cliente-ficticio", clienteAtualizacao: { id: "cliente-ficticio", versao: 3, nome: "Fantasia atualizada", email: "cliente@example.invalid", enderecos: [{ numero: "42" }], entregaPadrao: { destinatario: { nome: "Nova destinatária" } } } });
    expect(valor("Nome Fantasia *")).toBe("Fantasia atualizada");
  });
  it("mantém cadastro travado sem permissão de edição de Clientes", async () => {
    render(<EditorPedido dados={dadosFormulario} capacidades={{ ...capacidades, editarCliente: false }} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
    await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    expect((screen.getByLabelText("Nome Fantasia *") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByRole("combobox", { name: "Tipo de cliente" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("usa a revisão devolvida pelo salvamento na próxima edição e não envia endereços sem alterações", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear(); vi.mocked(salvarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ ok: true, id: "orcamento-editado", numero: 1, versao: 1, status: "RASCUNHO", clienteId: "cliente-ficticio", clienteVersao: 4 });
    vi.mocked(salvarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência da segunda gravação" });
    const dados = { ...dadosFormulario, clientes: dadosFormulario.clientes.map(c => ({ ...c, versao: 3 })) };
    render(<EditorPedido dados={dados} capacidades={{ ...capacidades, editarCliente: true }} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
    await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    fireEvent.change(screen.getByLabelText("Nome Fantasia *"), { target: { value: "Primeira alteração" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Orçamento salvo.");
    expect((vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0] as { clienteAtualizacao: object }).clienteAtualizacao).not.toHaveProperty("enderecos");
    fireEvent.change(screen.getByLabelText("Nome Fantasia *"), { target: { value: "Segunda alteração" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Conferência da segunda gravação");
    expect(vi.mocked(salvarRascunhoPedidoAction).mock.lastCall?.[2]).toMatchObject({ clienteAtualizacao: { versao: 4, nome: "Segunda alteração" } });
  });
  it("selecionar cliente e trocar aba de cobrança não solicita atualização cadastral", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ erro: "Conferência sem edição" });
    const dados = { ...dadosFormulario, clientes: dadosFormulario.clientes.map(c => ({ ...c, versao: 3, enderecos: [...c.enderecos, { ...cobranca, numero: "20" }] })) };
    render(<EditorPedido dados={dados} capacidades={{ ...capacidades, editarCliente: true }} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
    await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    await escolherCobranca("Cobrança 2");
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Conferência sem edição");
    expect(vi.mocked(criarRascunhoPedidoAction).mock.lastCall?.[0]).not.toHaveProperty("clienteAtualizacao");
  });
  it("exibe títulos externos, cadastro completo e um único diálogo sem criação separada", () => {
    render(<ModalNovoPedido><EditorPedido dados={dadosFormulario} capacidades={capacidades} emDialogo /></ModalNovoPedido>);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    for (const nome of ["Informações gerais", "Cobrança", "Entrega", "Pedido"]) expect(screen.getByRole("heading", { name: nome })).toBeTruthy();
    for (const nome of ["Nome Completo *", "CPF", "E-mail", "Data de nasc.", "Telefone *"]) expect(screen.getAllByLabelText(nome)[0]).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Novo cliente" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar novo cliente" })).toBeNull();
    for (const titulo of ["Informações gerais", "Cobrança", "Entrega", "Pedido"]) expect(screen.getByRole("heading", { name: titulo }).closest(".rounded-2xl")).toBeNull();
    for (const nome of [/Origem externa/, /Estabelecimento na origem/, /Código do pedido externo/, /^Prazo$/]) expect(screen.queryByText(nome)).toBeNull();
    expect(screen.getByRole("button", { name: "Entrega", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirada", pressed: false })).toBeTruthy();
  });
  it("mantém veículo e frete após os produtos e antes dos ajustes sem embalagem por item", () => {
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar produto" }));
    expect(screen.queryByLabelText(/Tipo de embalagem do item/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Frete da entrega" })).toBeNull();
    const itens = screen.getByRole("combobox", { name: "Produto 1" });
    const veiculo = screen.getByRole("combobox", { name: "Tipo de veículo" });
    const frete = screen.getByRole("textbox", { name: "Frete" });
    const cupom = screen.getByLabelText("Cupom de desconto");
    expect(itens.compareDocumentPosition(veiculo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(veiculo.compareDocumentPosition(frete) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(frete.compareDocumentPosition(cupom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(frete.closest("section")).toBe(screen.getByRole("heading", { name: "Pedido" }).closest("section"));
  });
  it("seleção preenche campos pessoais e cobrança, sinaliza e permite copiar a cobrança", async () => {
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
    await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    expect(valor("Nome Fantasia *")).toBe("Cliente Fictício"); expect(screen.queryByLabelText("Nome *")).toBeNull();
    expect(valor("CNPJ")).toBe("12.345.678/0001-90"); expect(valor("Razão social")).toBe("Empresa Fictícia");
    expect(valor("E-mail")).toBe("cliente@example.invalid"); expect(valor("Data de nasc.")).toBe("2000-01-01");
    expect(screen.queryByLabelText("DDD *")).toBeNull(); expect(valor("Telefone *")).toBe("+55 (11) 99999-0000");
    expect(screen.getByText("Dados preenchidos pelo cadastro selecionado.")).toBeTruthy();
    const entrega = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
    fireEvent.change(entrega.getByLabelText("Nome Completo"), { target: { value: "Destinatária Fictícia" } });
    fireEvent.change(entrega.getByLabelText("Telefone"), { target: { value: "11999990001" } });
    expect((entrega.getByLabelText("Telefone") as HTMLInputElement).value).toBe("+55 (11) 99999-0001");
    fireEvent.click(screen.getByRole("button", { name: "Copiar endereço de cobrança" }));
    expect((entrega.getByLabelText("Logradouro") as HTMLInputElement).value).toBe("Rua Fictícia");
    expect((entrega.getByLabelText("Nome Completo") as HTMLInputElement).value).toBe("Empresa Fictícia");
    expect((entrega.getByLabelText("Telefone") as HTMLInputElement).value).toBe("+55 (11) 99999-0000");
    expect(screen.getByText("Endereço copiado")).toBeTruthy();
    expect(screen.queryByLabelText("Usar endereço cadastrado")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpar cliente" }));
    expect(valor("Nome Completo *")).toBe(""); expect(screen.queryByText("Dados preenchidos pelo cadastro selecionado.")).toBeNull();
  });
  it("salva novo cliente no próprio pedido com dados pessoais, telefone e cobrança, sem abrir diálogo", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValueOnce({ ok: true, id: "pedido-novo", numero: 1, versao: 1, status: "RASCUNHO", clienteId: "cliente-novo" });
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "novo@example.invalid" } });
    await escolherTipo();
    for (const [nome, texto] of [["Nome Completo *", "Novo Fictício"], ["Telefone *", "11999990000"]]) fireEvent.change(screen.getAllByLabelText(nome)[0], { target: { value: texto } });
    const secao = within(screen.getByRole("heading", { name: "Cobrança" }).closest("section")!);
    vi.mocked(buscarCepPedidoAction).mockResolvedValueOnce({ endereco: { logradouro: "Rua Fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
    for (const [nome, texto] of [["CEP", "01001000"], ["Número", "10"], ["Complemento (opcional)", "Casa"]]) fireEvent.change(secao.getByLabelText(nome), { target: { value: texto } });
    fireEvent.blur(secao.getByLabelText("CEP"));
    await waitFor(() => expect((secao.getByLabelText("Logradouro") as HTMLInputElement).value).toBe("Rua Fictícia"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await waitFor(() => expect(criarRascunhoPedidoAction).toHaveBeenLastCalledWith(expect.objectContaining({ clienteNovo: expect.objectContaining({ primeiroNome: "Novo", sobrenome: "Fictício", telefone: "+5511999990000", enderecos: [expect.objectContaining({ numero: "10", nome: "Principal" })] }) }), expect.any(String)));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("retirada oculta endereço de entrega, conserva cobrança e salva sem endereço nem frete", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValue({ ok: true, id: "pedido-ficticio", numero: 1, versao: 1, status: "RASCUNHO" });
    const usuario = userEvent.setup(); render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    await usuario.click(screen.getByRole("combobox", { name: "Cliente" }));
    await usuario.click(await screen.findByRole("option", { name: "Cliente Fictício" }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar endereço de cobrança" }));
    await usuario.click(screen.getByRole("button", { name: "Retirada" }));
    const entrega = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
    expect(entrega.queryByRole("combobox", { name: "País" })).toBeNull();
    expect(entrega.queryByLabelText("Logradouro")).toBeNull();
    expect(entrega.queryByRole("button", { name: "Copiar endereço de cobrança" })).toBeNull();
    expect(screen.getByLabelText("Logradouro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await waitFor(() => expect(criarRascunhoPedidoAction).toHaveBeenCalledWith(expect.objectContaining({ atendimento: "RETIRADA", endereco: null, frete: "0.00" }), expect.any(String)));
    await waitFor(() => expect((screen.getByRole("button", { name: "Salvar orçamento" }) as HTMLButtonElement).disabled).toBe(false));
    await usuario.click(screen.getByRole("button", { name: "Entrega" }));
    expect((entrega.getByLabelText("Logradouro") as HTMLInputElement).value).toBe("Rua Fictícia");
  });
  it("bloqueia confirmação sem pagamento antes de criar pedido, mantendo orçamento disponível", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear(); vi.mocked(confirmarPedidoVendaAction).mockClear();
    render(<EditorPedido dados={dadosFormulario} capacidades={{ ...capacidades, confirmar: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pedido" }));
    expect((await screen.findByRole("alert")).textContent).toContain("pagamento");
    const pagamento = screen.getByRole("combobox", { name: "Forma de pagamento" });
    await waitFor(() => expect(document.activeElement).toBe(pagamento));
    expect(pagamento.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").parentElement?.contains(pagamento)).toBe(true);
    expect(criarRascunhoPedidoAction).not.toHaveBeenCalled(); expect(confirmarPedidoVendaAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar orçamento" })).toBeTruthy();
  });
  it("quantidade usa rótulo curto e unidade fixa sem alterar a quantidade digitada", () => {
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar produto" }));
    expect(screen.getByText("Qtd.")).toBeTruthy();
    const quantidade = screen.getByRole("spinbutton", { name: "Qtd. do produto 1 em UN" }) as HTMLInputElement;
    expect(quantidade.parentElement?.textContent).toContain("UN");
    fireEvent.change(quantidade, { target: { value: "3" } }); expect(quantidade.value).toBe("3");
    expect(screen.queryByText(/Qtd\. \(/)).toBeNull();
  });
  it("data estabelece prazo e entrega; cadastro incompleto impede salvar", async () => {
    vi.mocked(criarRascunhoPedidoAction).mockClear();
    vi.mocked(criarRascunhoPedidoAction).mockResolvedValue({ ok: true, id: "pedido-ficticio", numero: 1, versao: 1, status: "RASCUNHO" });
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    fireEvent.change(screen.getByLabelText("Data de entrega"), { target: { value: "2026-10-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await waitFor(() => expect(criarRascunhoPedidoAction).toHaveBeenLastCalledWith(expect.objectContaining({ atendimento: "ENTREGA", prazo: "AGENDADO", previsaoData: "2026-10-03" }), expect.any(String)));
    fireEvent.change(screen.getByLabelText("Data de entrega"), { target: { value: "" } });
    expect(valor("Data de entrega")).toBe("");
    cleanup(); vi.mocked(criarRascunhoPedidoAction).mockClear();
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "incompleto@example.invalid" } });
    await escolherTipo();
    fireEvent.change(screen.getAllByLabelText("Nome Completo *")[0], { target: { value: "Não salvo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await screen.findByText("Informe DDI do Brasil, DDD e telefone com oito ou nove dígitos.");
    expect(criarRascunhoPedidoAction).not.toHaveBeenCalled();
  });
  it("formata DDI, DDD e telefone de oito ou nove dígitos no mesmo campo e limpar cliente apaga os campos", async () => {
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    await escolherTipo();
    fireEvent.change(screen.getAllByLabelText("Nome Completo *")[0], { target: { value: "Novo" } });
    fireEvent.change(screen.getByLabelText("Telefone *"), { target: { value: "1133334444" } });
    expect(valor("Telefone *")).toBe("+55 (11) 3333-4444");
    fireEvent.change(screen.getByLabelText("Telefone *"), { target: { value: "+55 (11) 3333-44445" } });
    expect(valor("Telefone *")).toBe("+55 (11) 33334-4445");
    fireEvent.change(screen.getByLabelText("Telefone *"), { target: { value: "+55 (11) 333344445" } });
    expect(valor("Telefone *")).toBe("+55 (11) 3333-4444");
    fireEvent.change(screen.getByLabelText("Telefone *"), { target: { value: "+55 (21) 97658-6412" } });
    expect(valor("Telefone *")).toBe("+55 (21) 97658-6412");
    fireEvent.click(screen.getByRole("button", { name: "Limpar cliente" }));
    expect(valor("Nome Completo *")).toBe(""); expect(valor("Telefone *")).toBe("");
  });
  it("restringe CPF a dígitos e exige formato válido para e-mail informado", async () => {
    render(<EditorPedido dados={dadosFormulario} capacidades={capacidades} />);
    await escolherTipo();
    const geral = within(screen.getByRole("heading", { name: "Informações gerais" }).closest("section")!);
    const cpf = geral.getByLabelText("CPF");
    fireEvent.change(cpf, { target: { value: "12345678901" } });
    expect(fireEvent.keyDown(cpf, { key: "a" })).toBe(false);
    fireEvent.change(cpf, { target: { value: "123abc45678901" } });
    expect(cpf).toHaveProperty("value", "123.456.789-01");
    const email = screen.getByLabelText("E-mail") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "emailsemarroba" } }); expect(email.checkValidity()).toBe(false);
    fireEvent.change(email, { target: { value: "cliente@example.invalid" } }); expect(email.checkValidity()).toBe(true);
  });
  it("mantém a proteção ao sair pela confirmação sobreposta", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<ModalNovoPedido><EditorPedido dados={dadosFormulario} capacidades={capacidades} emDialogo /></ModalNovoPedido>);
    await escolherTipo();
    fireEvent.input(screen.getAllByLabelText("Nome Completo *")[0], { target: { value: "Rascunho" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await screen.findByText("Sair sem salvar?");
    expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(valor("Nome Completo *")).toBe("Rascunho");
    expect(screen.queryByText("Sair sem salvar?")).toBeNull();
  });
});

it("quantidade fracionária ,5 recalcula o total do pedido e só envia mediante salvar", async () => {
 const u=userEvent.setup();vi.mocked(salvarRascunhoPedidoAction).mockClear();
 const dados={...dadosFormulario,catalogo:catalogoComplementos,canais:[{id:"site",nome:"SITE"}]} as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
 const pedido={id:"fracao",numero:3,versao:1,status:"RASCUNHO",modoFinanceiro:"EXTERNO",historico:[],historicoFinanceiro:[],itens:[],rascunho:{clienteId:null,canalId:"site",atendimento:"RETIRADA",prazo:"IMEDIATO",observacoes:"",desconto:"0",frete:"0",itens:[{produtoId:"complemento",quantidade:"1",escolhas:{},precoManual:null}]}} as unknown as React.ComponentProps<typeof EditorPedido>["pedido"];
 render(<EditorPedido dados={dados} pedido={pedido} capacidades={capacidades}/>);
 const campo=screen.getByRole("textbox",{name:"Qtd. do produto 1 em KG"}) as HTMLInputElement;
 await u.clear(campo);await u.type(campo,",5");expect(campo.value).toBe("0,5");
 expect(screen.getByText("Valor total").parentElement?.textContent).toContain("25,00");
 await u.tab();expect(vi.mocked(salvarRascunhoPedidoAction)).not.toHaveBeenCalled();
});
it("trocar a origem mantém o preço único e não pede condição financeira na confirmação", async () => {
  const dados = { ...dadosFormulario, catalogo: catalogoComplementos, canais: [{ id: "site", nome: "SITE" }, { id: "ifood", nome: "IFOOD" }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
  render(<EditorPedido dados={dados} capacidades={capacidades} />);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Adicionar produto" }));
  await usuario.click(screen.getByRole("combobox", { name: "Produto 1" }));
  await usuario.click(await screen.findByRole("option", { name: "Kit de teste" }));
  for (const canal of ["SITE", "IFOOD"]) {
    await usuario.click(screen.getByRole("button", { name: canal }));
    expect(screen.getByLabelText("Preço 1")).toHaveProperty("value", "30,00");
    expect(screen.getByText("Valor total").parentElement?.textContent).toContain("30,00");
  }
  expect(screen.queryByRole("combobox", { name: "Categoria de receita bruta" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Condição financeira da confirmação" })).toBeNull();
  expect(screen.queryByLabelText("Crédito do comprador a aplicar")).toBeNull();
  const geral = screen.getByRole("heading", { name: "Informações gerais" }).closest("section")!;
  expect(within(geral).getByText("Crédito disponível: R$ 50.000,00 (limite inicial do novo cliente).").className).toContain("text-xs");
});
it("confirma sem condição financeira e mostra o crédito do cliente selecionado ao fim de Informações gerais", async () => {
  vi.mocked(salvarRascunhoPedidoAction).mockClear(); vi.mocked(confirmarPedidoVendaAction).mockClear();
  vi.mocked(salvarRascunhoPedidoAction).mockResolvedValueOnce({ ok: true, id: "rascunho-hub", numero: 9, versao: 2, status: "RASCUNHO" });
  vi.mocked(confirmarPedidoVendaAction).mockResolvedValueOnce({ erro: "Defina a categoria de receita do canal SITE em Canais de venda antes de confirmar." });
  const pedido = { id: "rascunho-hub", numero: 9, versao: 1, status: "RASCUNHO", modoFinanceiro: "HUB", versaoFinanceiro: 1, historico: [], historicoFinanceiro: [], itens: [], rascunho: { clienteId: "cliente-ficticio", canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", observacoes: "", desconto: "0", frete: "0", itens: [{ produtoId: "principal", quantidade: "1", escolhas: { tamanho: 1 }, precoManual: null }], pagamentoInformado: { formaId: "pix", parcelas: 1, vencimentos: [] } } } as unknown as React.ComponentProps<typeof EditorPedido>["pedido"];
  const dados = { ...dadosFormulario, catalogo: catalogoComplementos, canais: [{ id: "site", nome: "SITE" }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
  render(<EditorPedido dados={dados} pedido={pedido} capacidades={capacidades} />);
  const geral = within(screen.getByRole("heading", { name: "Informações gerais" }).closest("section")!);
  expect(await geral.findByText("Crédito disponível: R$ 48.800,00 de R$ 50.000,00 · em aberto R$ 1.200,00.")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Condição financeira da confirmação" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar pedido" }));
  expect(await screen.findByText(/Defina a categoria de receita do canal SITE/)).toBeTruthy();
  expect(vi.mocked(confirmarPedidoVendaAction).mock.lastCall?.[3]).toBeUndefined();
});
it("a revisão mostra a negociação histórica ao trocar a origem, mesmo com catálogo mais barato", async () => {
  const dados = { ...dadosFormulario, catalogo: catalogoComplementos, canais: [{ id: "site", nome: "SITE" }, { id: "ifood", nome: "IFOOD" }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
  const pedido = { id: "historico", numero: 5, versao: 2, status: "CONFIRMADO", modoFinanceiro: "EXTERNO", clienteId: "cliente-ficticio", canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, desconto: "0", frete: "0", subtotal: "140", total: "140", historico: [], historicoFinanceiro: [], itens: [{ id: "item-historico", produtoId: "principal", quantidade: "1", unidadeSnapshot: "UN", precoOriginal: "130", precoAplicado: "130", acrescimos: "10", desconto: "0", totalLinha: "140", estadoComposicao: "PENDENTE", produtoSnapshot: { nome: "Kit anterior" }, escolhasSnapshot: [{ opcaoId: "tamanho", opcaoNome: "Médio", quantidade: 1 }] }] } as unknown as React.ComponentProps<typeof EditorPedido>["pedido"];
  render(<EditorPedido dados={dados} pedido={pedido} capacidades={{ ...capacidades, revisar: true }} />);
  expect(screen.getByLabelText("Preço 1")).toHaveProperty("value", "130,00");
  await userEvent.setup().click(screen.getByRole("button", { name: "IFOOD" }));
  expect(screen.getByLabelText("Preço 1")).toHaveProperty("value", "130,00");
  expect(screen.getByText("Valor total").parentElement?.textContent).toContain("140,00");
});
it("conserva preço e rótulo da escolha histórica após remover outro item", async () => {
  const dados = { ...dadosFormulario, catalogo: catalogoComplementos, canais: [{ id: "site", nome: "SITE" }] } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
  const historico = (id: string, preco: string, escolha: string) => ({ id, produtoId: "principal", quantidade: "1", unidadeSnapshot: "UN", precoOriginal: preco, precoAplicado: preco, acrescimos: escolha, desconto: "0", totalLinha: String(Number(preco) + Number(escolha)), estadoComposicao: "PENDENTE", produtoSnapshot: { nome: "Kit anterior" }, escolhasSnapshot: [{ opcaoId: "tamanho", opcaoNome: "Médio", quantidade: 1, preco: escolha }] });
  const pedido = { id: "historico-duplo", numero: 6, versao: 2, status: "CONFIRMADO", modoFinanceiro: "EXTERNO", clienteId: "cliente-ficticio", canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, desconto: "0", frete: "0", subtotal: "235", total: "235", historico: [], historicoFinanceiro: [], itens: [historico("primeiro", "90", "10"), historico("segundo", "130", "5")] } as unknown as React.ComponentProps<typeof EditorPedido>["pedido"];
  render(<EditorPedido dados={dados} pedido={pedido} capacidades={{ ...capacidades, revisar: true }} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Remover item 1" }));
  expect(screen.getByLabelText("Preço 1")).toHaveProperty("value", "130,00");
  expect(screen.getByLabelText("Quantidade de Médio no produto 1")).toHaveProperty("value", "1");
  expect(screen.getByLabelText("Preço de Médio no produto 1")).toHaveProperty("value", "5,00");
  expect(screen.getByText("Valor total").parentElement?.textContent).toContain("135,00");
});
