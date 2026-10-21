// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientesVenda } from "@/app/(protegido)/vendas/clientes/clientes-client";
import type { ClienteConsulta } from "@/app/(protegido)/vendas/clientes/tipos";

const sim = vi.hoisted(() => ({ salvar: vi.fn(), historico: vi.fn(), refresh: vi.fn(), identidade: vi.fn() }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: sim.identidade, consultarIdentidadeClientePedido: sim.identidade }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/actions", () => ({ salvarClienteVendaAction: sim.salvar, alterarStatusCadastroVendaAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/credito-actions", () => ({ ajustarCreditoClienteAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/historico-actions", () => ({ consultarHistoricoPedidosClienteAction: sim.historico }));
vi.mock("@/app/(protegido)/vendas/clientes/cadastro-actions", () => ({  buscarCnpjClienteAction: vi.fn(), buscarCepClienteAction: vi.fn().mockResolvedValue({ erro: "Consulta fictícia indisponível" }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));
const cliente: ClienteConsulta = { id: "c1", versao: 1, nome: "Ágata fictícia", primeiroNome: "Ágata", sobrenome: "fictícia", tipo: "PF", documento: null, email: "", telefone: "+5511999991234", contato: null, observacoes: "Observação fictícia", enderecos: [{ nome: "Cobrança", destinatario: "Ágata fictícia", pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", numero: "10", complemento: "Sala fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" }], ativo: true, resumoPedidos: { ultimoPedido: "2026-10-01T02:00:00.000Z", quantidadePedidos: 2, valorTotalGasto: "120.50" } };
const formas = [{ id: "pix", nome: "Pix", tipo: "PIX", ativo: true }, { id: "boleto", nome: "Boleto", tipo: "BOLETO", ativo: true }];
const montar = (clientes = [cliente], verPedidos = true) => render(<ClientesVenda clientes={clientes} formasPagamento={formas} adicionar editar verPedidos={verPedidos} />);
beforeEach(() => { sim.identidade.mockResolvedValue({ email: false, documento: false }); sim.salvar.mockResolvedValue({ ok: true }); sim.historico.mockResolvedValue({ pedidos: [], total: 0, pagina: 1, tamanhoPagina: 25 }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("clientes com padrões de Insumos", () => {
  it("link da atividade abre o cliente inativo na página correta sem editor nem acesso de edição", () => {
    const clientes = Array.from({ length: 30 }, (_, i) => ({ ...cliente, id: `alvo-${i}`, nome: `Cliente sintético ${i}`, ativo: i !== 29 }));
    render(<ClientesVenda clientes={clientes} entidadeInicialId="alvo-29" pagina={1} busca="busca anterior" situacao="ativos" adicionar={false} editar={false} verPedidos={false} />);
    expect(screen.getByText("Pag. 2")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Detalhes de Cliente sintético 29" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Buscar clientes" })).toHaveProperty("value", "");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Histórico de pedidos" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Crédito disponível" })).toBeNull();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it.each([undefined, "ausente", "<c1>", "x".repeat(161)])("ignora alvo ausente/inválido %s e conserva os filtros", entidadeInicialId => {
    render(<ClientesVenda clientes={[cliente]} entidadeInicialId={entidadeInicialId} busca="Ágata" adicionar={false} editar={false} />);
    expect(screen.getByRole("textbox", { name: "Buscar clientes" })).toHaveProperty("value", "Ágata");
    expect(screen.queryByRole("region", { name: "Detalhes de Ágata fictícia" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("busca sem acentos e filtros imediatos fecham detalhes, sem botão de envio", async () => {
    montar([cliente, { ...cliente, id: "pj", nome: "Empresa fictícia", tipo: "PJ" }, { ...cliente, id: "inativo", nome: "Cliente inativo", ativo: false }]);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    expect(screen.getByRole("region", { name: "Detalhes de Ágata fictícia" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: "agata" } });
    expect(screen.queryByRole("region", { name: "Detalhes de Ágata fictícia" })).toBeNull();
    expect(screen.queryByText("Empresa fictícia")).toBeNull();
    expect(screen.queryByRole("button", { name: "Buscar" })).toBeNull();
    await u.click(screen.getByRole("button", { name: "Limpar busca" }));
    await u.click(screen.getByRole("button", { name: "Pessoa jurídica (1)" }));
    expect(screen.queryByText("Ágata fictícia")).toBeNull();
    expect(screen.getByText("Empresa fictícia")).toBeTruthy();
  });
  it("conta cada tipo e status com a busca e os demais filtros, incluindo opções vazias", async () => {
    montar([cliente, { ...cliente, id: "pj", nome: "Empresa fictícia", tipo: "PJ" }, { ...cliente, id: "pf-inativo", nome: "Ágata inativa", ativo: false }, { ...cliente, id: "pj-inativo", nome: "Empresa inativa", tipo: "PJ", ativo: false }]);
    const u = userEvent.setup();
    const tipos = within(screen.getByRole("group", { name: "Filtrar clientes por tipo" }));
    expect(tipos.getByRole("button", { name: "Todos (2)", pressed: true })).toBeTruthy();
    expect(tipos.getByRole("button", { name: "Pessoa física (1)" })).toBeTruthy();
    await u.click(tipos.getByRole("button", { name: "Pessoa jurídica (1)" }));
    expect(tipos.getByRole("button", { name: "Pessoa física (1)" })).toBeTruthy();
    await u.click(screen.getByRole("combobox", { name: "Filtrar clientes por status" }));
    expect(await screen.findByRole("option", { name: "Ativos (1)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Inativos (1)" })).toBeTruthy();
    await u.click(screen.getByRole("option", { name: "Todos os status (2)" }));
    expect(tipos.getByRole("button", { name: "Todos (4)" })).toBeTruthy();
    expect(tipos.getByRole("button", { name: "Pessoa física (2)" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: "agata" } });
    expect(tipos.getByRole("button", { name: "Todos (2)" })).toBeTruthy();
    expect(tipos.getByRole("button", { name: "Pessoa física (2)" })).toBeTruthy();
    expect(tipos.getByRole("button", { name: "Pessoa jurídica (0)", pressed: true })).toHaveProperty("disabled", false);
    expect(screen.getByRole("combobox", { name: "Filtrar clientes por status" }).textContent).toContain("Todos os status (0)");
    await u.click(tipos.getByRole("button", { name: "Pessoa física (2)" }));
    expect(screen.getByText("Ágata fictícia")).toBeTruthy();
    expect(screen.getByText("Ágata inativa")).toBeTruthy();
    await u.click(screen.getByRole("combobox", { name: "Filtrar clientes por status" }));
    await u.click(await screen.findByRole("option", { name: "Inativos (1)" }));
    expect(tipos.getByRole("button", { name: "Pessoa física (1)" })).toBeTruthy();
    expect(screen.queryByText("Ágata fictícia")).toBeNull();
    expect(screen.getByText("Ágata inativa")).toBeTruthy();
  });
  it("ordena valores numericamente e pagina 25 clientes", () => {
    const lista = Array.from({ length: 26 }, (_, i) => ({ ...cliente, id: `c${i}`, nome: `Cliente ${String(i).padStart(2, "0")}`, resumoPedidos: { ...cliente.resumoPedidos!, valorTotalGasto: String(i === 0 ? 100 : i === 1 ? 20 : 30 + i) } }));
    montar(lista);
    expect(screen.getByText("Mostrando 25 de 26 clientes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todos (26)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Cliente 25")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pessoa física (26)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Valor total já gasto" }));
    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas[0].textContent).toContain("Cliente 01");
    fireEvent.click(screen.getByRole("button", { name: "Valor total já gasto" }));
    expect(screen.getAllByRole("row")[1].textContent).toContain("Cliente 00");
  });
  it("encontra documentos com máscara e respeita o fuso da empresa", () => {
    render(<ClientesVenda clientes={[{ ...cliente, documento: "12345678909", resumoPedidos: { ...cliente.resumoPedidos!, ultimoPedido: "2026-10-01T03:30:00Z" } }]} adicionar={false} editar={false} fusoHorario="America/Manaus" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: "123.456.789-09" } });
    expect(screen.getByText("Ágata fictícia")).toBeTruthy();
    expect(screen.getByText("30/09/2026")).toBeTruthy();
  });
  it("conserva a data civil da compra no último pedido e no histórico do cliente", async () => {
    sim.historico.mockResolvedValue({ pedidos: [{ id: "pedido-compra", numero: 53, status: "CONFIRMADO", dataPedido: "2026-09-30", baseDataPedido: "COMPRA", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Manaus", total: "120.50" }], total: 1, pagina: 1, tamanhoPagina: 25 });
    render(<ClientesVenda clientes={[{ ...cliente, resumoPedidos: { ...cliente.resumoPedidos!, ultimoPedido: "2026-09-30" } }]} adicionar={false} editar={false} verPedidos fusoHorario="America/Manaus" />);
    expect(screen.getByText("30/09/2026")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    await userEvent.click(screen.getByRole("tab", { name: "Histórico de pedidos" }));
    await screen.findByRole("link", { name: "Pedido #53" });
    const historico = within(screen.getByRole("tabpanel"));
    expect(historico.getByText("30/09/2026")).toBeTruthy();
    expect(historico.getByText("Data da compra")).toBeTruthy();
    expect(historico.queryByText(/29\/09|00:00/)).toBeNull();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it.each(["  EMAIL.ALIAS@EXAMPLE.INVALID  ", "987.654.321-00"])("encontra a raiz por identidade anterior %s sem trocar seus dados atuais", async consulta => {
    const raiz = { ...cliente, email: "principal@example.invalid", emailsAlternativos: ["email.alias@example.invalid"], documentosAlternativos: ["98765432100"] };
    montar([raiz, { ...cliente, id: "outra-pessoa", nome: "Outra Pessoa Sintética" }]);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: consulta } });
    expect(screen.getByText("Ágata fictícia")).toBeTruthy();
    expect(screen.queryByText("Outra Pessoa Sintética")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Editar Ágata fictícia" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("E-mail")).toHaveProperty("value", "principal@example.invalid");
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("editar abre diretamente sem expandir a linha e sem salvar ao perder foco", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar Ágata fictícia" }));
    expect(screen.queryByRole("region", { name: "Detalhes de Ágata fictícia" })).toBeNull();
    const dialogo = within(screen.getByRole("dialog"));
    fireEvent.change(dialogo.getAllByRole("textbox", { name: "Nome Completo *" })[0], { target: { value: "Novo nome" } });
    fireEvent.blur(dialogo.getAllByRole("textbox", { name: "Nome Completo *" })[0]);
    expect(sim.salvar).not.toHaveBeenCalled();
    await u.click(dialogo.getByRole("tab", { name: "Regras de pagamento" }));
    fireEvent.change(dialogo.getByRole("spinbutton", { name: "Dias máximos do boleto após a entrega" }), { target: { value: "7" } });
    await u.click(dialogo.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Novo nome", primeiroNome: "Novo", sobrenome: "nome", telefone: cliente.telefone, enderecos: cliente.enderecos, regrasPagamento: expect.objectContaining({ boletoDiasAposEntrega: 7 }) })));
  });
  it("volta à aba de dados quando nome obrigatório falta", async () => {
    montar([]);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Novo cliente" }));
    await u.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await u.click(await screen.findByRole("option", { name: "Pessoa Física" }));
    await u.click(screen.getByRole("tab", { name: "Regras de pagamento" }));
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).not.toHaveBeenCalled();
    expect((await screen.findAllByRole("textbox", { name: "Nome Completo *" }))[0]).toBeTruthy();
  });
  it("consulta histórico só ao abrir aba; falha recuperável e link para detalhe", async () => {
    sim.historico.mockResolvedValueOnce({ erro: "Falha fictícia" }).mockResolvedValueOnce({ pedidos: [{ id: "pedido-1", numero: 42, status: "CONFIRMADO", dataPedido: "2026-10-01T15:00:00Z", baseDataPedido: "CONFIRMACAO", previsaoData: "2026-10-02", previsaoJanela: "10:00–12:00", entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "120.50" }], total: 1, pagina: 1, tamanhoPagina: 25 });
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    expect(sim.historico).not.toHaveBeenCalled();
    await u.click(screen.getByRole("tab", { name: "Histórico de pedidos" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha fictícia");
    await u.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("link", { name: "Pedido #42" })).toHaveProperty("href", expect.stringContaining("/vendas/pedidos/pedido-1"));
    expect(screen.getByText(/02\/10\/2026 · 10:00/)).toBeTruthy();
  });
  it("volta ao tipo ainda não escolhido sem salvar nem simular carregamento", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Novo cliente" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "novo@example.invalid" } });
    await u.click(screen.getByRole("tab", { name: "Regras de pagamento" }));
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Escolha o tipo de cliente antes de salvar.");
    expect(await screen.findByRole("combobox", { name: "Tipo de cliente" })).toBeTruthy();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("perfil sem acesso a pedidos não apresenta histórico", async () => {
    montar([{ ...cliente, resumoPedidos: null }], false);
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    expect(screen.queryByRole("tab", { name: "Histórico de pedidos" })).toBeNull();
    expect(sim.historico).not.toHaveBeenCalled();
  });
  it("busca empresa pelos contatos ativos e mostra Nome Completo na aba Contatos", async () => {
    const empresa = { ...cliente, id: "empresa-contatos", nome: "Empresa sintética", tipo: "PJ" as const, contatosEmpresa: [
      { id: "contato-1", nome: "Maria da Silva Sintética", primeiroNome: "Maria", sobrenome: "da Silva Sintética", email: "contato@example.invalid", telefone: "+5511900001234" },
      { id: "contato-2", nome: "José Sintético", primeiroNome: "José", sobrenome: "Sintético", email: null, telefone: null },
    ] };
    montar([empresa], false);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: "jose sintetico" } });
    expect(screen.getByText("Empresa sintética")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: "+55 (11) 90000-1234" } });
    expect(screen.getByText("Empresa sintética")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir detalhes de Empresa sintética" }));
    await userEvent.setup().click(screen.getByRole("tab", { name: "Contatos" }));
    const painel = within(screen.getByRole("tabpanel"));
    expect(painel.getByText("Maria da Silva Sintética")).toBeTruthy();
    expect(painel.getByRole("columnheader", { name: "Nome Completo" })).toBeTruthy();
    expect(painel.queryByRole("columnheader", { name: "Sobrenome" })).toBeNull();
    expect(painel.getByText("contato@example.invalid")).toBeTruthy();
    expect(painel.getByText("José Sintético")).toBeTruthy();
    expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.historico).not.toHaveBeenCalled();
  });
  it("mostra vazio de contatos no PJ sem criar cadastro nem exibir aba em PF", async () => {
    montar([{ ...cliente, tipo: "PJ", contatosEmpresa: [] }], false);
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    await userEvent.setup().click(screen.getByRole("tab", { name: "Contatos" }));
    expect(screen.getByText("Nenhum contato adicional cadastrado.")).toBeTruthy(); expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("exibe data histórica original e status revertido, sem inventar confirmação ou entrega", async () => {
    sim.historico.mockResolvedValue({ pedidos: [{ id: "pedido-historico", numero: 20001, status: "HISTORICO_REVERTIDO", dataPedido: "2026-09-01T02:59:00Z", baseDataPedido: "CRIACAO_HISTORICA", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "0.30" }], total: 1, pagina: 1, tamanhoPagina: 25 });
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    await u.click(screen.getByRole("tab", { name: "Histórico de pedidos" }));
    await screen.findByRole("link", { name: "Pedido #20001" });
    const historico = within(screen.getByRole("tabpanel"));
    expect(historico.getByRole("columnheader", { name: "Data do pedido" })).toBeTruthy();
    expect(historico.getByText(/31\/08\/2026,? 23:59/)).toBeTruthy();
    expect(historico.getByText("Criação na origem")).toBeTruthy();
    expect(historico.getByText("Histórico revertido")).toBeTruthy();
    expect(historico.getByText("Entrega não informada")).toBeTruthy();
    expect(historico.queryByText("Confirmação")).toBeNull();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("histórico usa a página devolvida pelo servidor após redução de resultados", async () => {
    const pedido = { id: "p", numero: 1, status: "CONFIRMADO", dataPedido: "2026-10-01T15:00:00Z", baseDataPedido: "CONFIRMACAO", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "10.00" };
    sim.historico.mockResolvedValueOnce({ pedidos: [pedido], total: 26, pagina: 1, tamanhoPagina: 25 }).mockResolvedValueOnce({ pedidos: [pedido], total: 1, pagina: 1, tamanhoPagina: 25 });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes de Ágata fictícia" }));
    fireEvent.click(screen.getByRole("tab", { name: "Histórico de pedidos" }));
    await screen.findByRole("link", { name: "Pedido #1" });
    const historico = within(screen.getByRole("tabpanel"));
    fireEvent.click(historico.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(historico.getByText("Mostrando 1 de 1 pedidos")).toBeTruthy());
    expect(historico.getByText("Pag. 1")).toBeTruthy();
    expect(historico.getByRole("button", { name: "Anterior" })).toHaveProperty("disabled", true);
  });
});


it("abre Pedidos no editor do cliente salvo sem gravar o cadastro e respeita a permissão", async () => {
  montar();
  await userEvent.setup().click(screen.getByRole("button", { name: "Editar Ágata fictícia" }));
  expect(sim.historico).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole("tab", { name: "Pedidos" }));
  await waitFor(() => expect(sim.historico).toHaveBeenCalledWith("c1", 1));
  expect(sim.salvar).not.toHaveBeenCalled();
  cleanup();
  montar([cliente], false);
  await userEvent.setup().click(screen.getByRole("button", { name: "Editar Ágata fictícia" }));
  expect(screen.queryByRole("tab", { name: "Pedidos" })).toBeNull();
});
