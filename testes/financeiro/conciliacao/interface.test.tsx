// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lancamentoTeste } from "../dados-movimentacoes";
const s = vi.hoisted(() => ({ conciliar: vi.fn(), desfazer: vi.fn(), importar: vi.fn(), preparar: vi.fn(), baixar: vi.fn(), estornar: vi.fn(), refresh: vi.fn(), sucesso: vi.fn(), salvarBeneficiario: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: s.refresh, push: vi.fn() }) }));
vi.mock("@/app/(protegido)/financeiro/movimentacoes/conciliacao-actions", () => ({ conciliarExtratoAction: s.conciliar, desfazerConciliacaoAction: s.desfazer, importarExtratoAction: s.importar, prepararExtratoAction: s.preparar }));
vi.mock("@/app/(protegido)/financeiro/contas/actions", () => ({ baixarLancamentoAction: s.baixar, estornarBaixaLancamentoAction: s.estornar }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ criarLancamentoAction: vi.fn(), atualizarLancamentoAction: vi.fn(), excluirLancamentoAction: vi.fn(), obterResumoExclusaoLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({ salvarBeneficiarioAction: s.salvarBeneficiario, saveFornecedorAction: vi.fn(), createCanalPedidoAction: vi.fn(), createFormaPagamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/movimentacoes/baixar-nota", () => ({ baixarNotaFiscalAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: s.sucesso, error: vi.fn() } }));
import { ConciliacaoView } from "@/app/(protegido)/financeiro/movimentacoes/conciliacao-view";
import { MovimentacoesView } from "@/app/(protegido)/financeiro/movimentacoes/movimentacoes-view";
import { ImportarExtratoDialog } from "@/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog";
import type { ExtratoBancarioRow } from "@/lib/financeiro/conciliacao/types";
const linha = lancamentoTeste({ valor: 125.55, versao: "versao-teste", dataVencimento: "2026-09-11T15:00:00Z" });
const transacao: ExtratoBancarioRow = { id: "transacao", contaBancariaId: "banco", data: "2026-09-11", descricao: "PIX recebido do banco", valor: -125.55, identificador: "FITID1", arquivo: "extrato.ofx", conciliadaEm: null, conciliadaPorNome: null, lancamentoIds: [], historico: [] };
const opcoes = { categorias: [{ id: "despesas", nome: "Ocupação", grupo: "DESPESAS_OPERACIONAIS" as const }], fornecedores: [], formasPagamento: [], contasBancarias: [{ id: "banco", nome: "Conta principal" }] };
const acesso = { importar: true, conciliar: true, criar: true, baixar: true, desfazer: true, editarMovimentacao: true, excluirMovimentacao: true };
const props = { ...opcoes, linhas: [linha], transacoes: [transacao], acesso, periodo: { de: "2026-09-01", ate: "2026-09-30" }, aoAlterarPeriodo: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); s.conciliar.mockResolvedValue({ ok: true }); s.desfazer.mockResolvedValue({ ok: true }); s.baixar.mockResolvedValue({ ok: true }); s.estornar.mockResolvedValue({ ok: true }); s.salvarBeneficiario.mockResolvedValue({ ok: true, beneficiario: { id: "novo-beneficiario", nome: "MARIA SILVA", formaPagamentoId: null } }); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(cleanup);
it("explica o recebimento na origem e bloqueia seleção de pedido pendente", () => {
  render(<ConciliacaoView {...props} linhas={[{ ...linha, pedidoVendaId: "pedido-ficticio" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  expect((screen.getByRole("checkbox", { name: "Selecionar Aluguel da cozinha" }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/Registre o recebimento no pedido antes de conciliar/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Aluguel da cozinha" }));
  const detalhe = screen.getByRole("dialog");
  expect(within(detalhe).getByRole("button", { name: "Abrir pedido" })).toBeTruthy();
  expect(within(detalhe).queryByRole("button", { name: "Realizar movimentação" })).toBeNull();
});
it("pré-seleciona a sugestão e somente envia após confirmação explícita", async () => {
  const u = userEvent.setup(); render(<ConciliacaoView {...props} />);
  expect(screen.queryByRole("button", { name: "Conciliar selecionados" })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  const confirmar = screen.getByRole("button", { name: "Confirmar pré-conciliação" }) as HTMLButtonElement;
  expect(confirmar.disabled).toBe(false);
  expect((screen.getByRole("checkbox", { name: "Selecionar Aluguel da cozinha" }) as HTMLInputElement).checked).toBe(true);
  expect(s.conciliar).not.toHaveBeenCalled();
  await u.click(confirmar);
  await waitFor(() => expect(s.conciliar).toHaveBeenCalledWith({ transacaoId: "transacao", lancamentos: [{ id: "aluguel", versao: "versao-teste" }] }));
  expect(s.refresh).toHaveBeenCalledOnce();
});
it("abre os detalhes da movimentação sem alterar a seleção e permite editar, excluir e realizar", async () => {
  const u = userEvent.setup(); render(<ConciliacaoView {...props} />);
  const selecionar = screen.getByRole("checkbox", { name: "Selecionar Aluguel da cozinha" }) as HTMLInputElement;
  expect(selecionar.checked).toBe(false);
  await u.click(screen.getByRole("button", { name: "Ver detalhes de Aluguel da cozinha" }));
  expect(screen.getByRole("dialog", { name: "Detalhes da movimentação" })).toBeDefined();
  expect(selecionar.checked).toBe(false);
  expect(screen.getByRole("button", { name: "Editar" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Excluir" })).toBeDefined();
  await u.click(screen.getByRole("button", { name: "Realizar movimentação" }));
  expect(screen.getByRole("dialog", { name: "Realizar movimentação" })).toBeDefined();
  expect(screen.getByRole("combobox", { name: "Conta bancária da baixa" }).textContent).toContain("Conta principal");
  fireEvent.change(screen.getByLabelText("Data da transação"), { target: { value: "2026-09-11" } });
  await u.click(screen.getByRole("button", { name: "Confirmar baixa" }));
  await waitFor(() => expect(s.baixar).toHaveBeenCalledWith("aluguel", "banco", "2026-09-11"));
  expect(s.refresh).toHaveBeenCalledOnce();
});
it("marca pela caixa de seleção sem abrir os detalhes", async () => {
  const u = userEvent.setup(); render(<ConciliacaoView {...props} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("checkbox", { name: "Selecionar Aluguel da cozinha" }));
  expect(screen.queryByRole("dialog", { name: "Detalhes da movimentação" })).toBeNull();
});
it("oculta ações de alteração quando o perfil não possui as permissões", async () => {
  const u = userEvent.setup(); render(<ConciliacaoView {...props} acesso={{ ...acesso, baixar: false, editarMovimentacao: false, excluirMovimentacao: false }} />);
  await u.click(screen.getByRole("button", { name: "Ver detalhes de Aluguel da cozinha" }));
  expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Realizar movimentação" })).toBeNull();
});
it("bloqueia valor divergente e mantém seleção ao receber erro do servidor", async () => {
  const u = userEvent.setup(); const { rerender } = render(<ConciliacaoView {...props} linhas={[{ ...linha, valor: 100 }]} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" })); await u.click(screen.getByRole("checkbox"));
  expect((screen.getByRole("button", { name: "Conciliar selecionados" }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<ConciliacaoView {...props} />); s.conciliar.mockResolvedValueOnce({ erro: "O lançamento mudou." });
  await u.click(screen.getByRole("button", { name: "Confirmar pré-conciliação" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "O lançamento mudou.");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true); expect(s.refresh).not.toHaveBeenCalled();
});
it("permite combinar receita bruta e taxa de despesa pelo valor líquido", async () => {
  const u = userEvent.setup();
  const recebimento = { ...transacao, descricao: "PIX líquido do cliente", valor: 97 };
  const receita = lancamentoTeste({ id: "receita-bruta", descricao: "Receita bruta", tipo: "RECEITA", valor: 100, categoriaId: "receita", categoriaNome: "Receita de vendas", categoriaGrupo: "RECEITA_BRUTA", versao: "versao-receita" });
  const taxa = lancamentoTeste({ id: "taxa-pix", descricao: "Taxa Pix", tipo: "DESPESA", valor: 3, versao: "versao-taxa" });
  render(<ConciliacaoView {...props} transacoes={[recebimento]} linhas={[receita, taxa]} />);

  await u.click(screen.getByRole("button", { name: "Conferir PIX líquido do cliente" }));
  await u.click(screen.getByRole("checkbox", { name: "Selecionar Receita bruta" }));
  await u.click(screen.getByRole("checkbox", { name: "Selecionar Taxa Pix" }));
  expect(screen.getByText("Líquido selecionado").parentElement?.textContent).toContain("97,00");
  const conciliar = screen.getByRole("button", { name: "Conciliar selecionados" }) as HTMLButtonElement;
  expect(conciliar.disabled).toBe(false);
  await u.click(conciliar);
  await waitFor(() => expect(s.conciliar).toHaveBeenCalledWith({
    transacaoId: "transacao",
    lancamentos: [
      { id: "receita-bruta", versao: "versao-receita" },
      { id: "taxa-pix", versao: "versao-taxa" },
    ],
  }));
});
it("mostra a nota inteira, busca sem reduzir o total e confirma todos os seus itens", async () => {
  const u = userEvent.setup(); const nota = { id: "nota", numero: "123", serie: "1", fornecedorNome: "Horta da Serra" };
  render(<ConciliacaoView {...props} linhas={[
    { ...linha, id: "a", descricao: "Queijo", valor: 100, notaFiscal: nota },
    { ...linha, id: "b", descricao: "Fruta", valor: 25.55, notaFiscal: nota },
  ]} />);
  const regioes = screen.getAllByRole("region");
  expect(regioes[0].getAttribute("aria-label")).toBe("Extrato bancário");
  expect(regioes[1].getAttribute("aria-label")).toBe("Movimentações da empresa");
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(screen.getByText(/NF-e nº 123/)).toBeDefined();
  await u.type(screen.getByRole("textbox", { name: "Buscar movimentação da empresa" }), "Queijo");
  expect(within(regioes[1]).getAllByText(/125,55/).length).toBeGreaterThan(0);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("button", { name: "Confirmar pré-conciliação" }));
  await waitFor(() => expect(s.conciliar).toHaveBeenCalledWith({ transacaoId: "transacao", lancamentos: [{ id: "a", versao: "versao-teste" }, { id: "b", versao: "versao-teste" }] }));
});
it("mostra o valor final da parcela e discrimina os itens nos detalhes", async () => {
  const nota = { id: "nota-troppo", numero: "14902", serie: "1", fornecedorNome: "DMD TROPPO ALIMENTOS LTDA", parcela: { id: "parcela-troppo", numero: "001", valor: 704.90 } };
  render(<ConciliacaoView {...props} linhas={[
    { ...linha, id: "mostarda", descricao: "Mostarda", notaFiscalItemDescricao: "Caviar de mostarda", valor: 53, notaFiscal: nota },
    { ...linha, id: "geleia", descricao: "Geleia", notaFiscalItemDescricao: "Geleia de manga", valor: 106, notaFiscal: nota },
    { ...linha, id: "compota", descricao: "Compota", notaFiscalItemDescricao: "Compota de frutas", valor: 583, notaFiscal: nota },
  ]} transacoes={[{ ...transacao, descricao: "PIX DMD TROPPO ALIMENTOS LTDA", valor: -704.90 }]} />);
  const empresa = screen.getByRole("region", { name: "Movimentações da empresa" });
  expect(within(empresa).getAllByText(/704,90/).length).toBeGreaterThan(0);
  expect(within(empresa).queryByText(/742,00/)).toBeNull();
  fireEvent.click(within(empresa).getByText("Ver composição da nota (3 itens)"));
  expect(within(empresa).getByText("Caviar de mostarda")).toBeDefined();
  expect(within(empresa).getByText("Valor final da parcela")).toBeDefined();
  fireEvent.click(within(empresa).getByRole("button", { name: "Ver detalhes de DMD TROPPO ALIMENTOS LTDA" }));
  const detalhe = screen.getByRole("dialog", { name: "DMD TROPPO ALIMENTOS LTDA" });
  expect(within(detalhe).getByText("Caviar de mostarda")).toBeDefined();
  fireEvent.click(within(detalhe).getByRole("button", { name: /Caviar de mostarda/ }));
  expect(screen.getByRole("dialog", { name: "Detalhes da movimentação" })).toBeDefined();
});
it("permite recusar a pré-seleção sem gravar e exige escolha manual em ambiguidades", async () => {
  const u = userEvent.setup(); const { rerender } = render(<ConciliacaoView {...props} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("checkbox"));
  expect((screen.getByRole("button", { name: "Conciliar selecionados" }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<ConciliacaoView {...props} linhas={[linha, { ...linha, id: "outra", descricao: "Outra despesa" }]} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  expect(screen.getByText(/Mais de uma correspondência/)).toBeDefined();
  expect(screen.getAllByRole("checkbox").every(c => !(c as HTMLInputElement).checked)).toBe(true);
  expect(s.conciliar).not.toHaveBeenCalled();
});
it("preenche as datas com a transação e permite ajustar a competência", async () => {
  const u = userEvent.setup(); render(<ConciliacaoView {...props} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("button", { name: "Criar despesa" }));
  expect((screen.getByLabelText("Competência") as HTMLInputElement).value).toBe("2026-09-11");
  await u.click(screen.getByRole("combobox", { name: "Categoria do novo lançamento" })); await u.click(await screen.findByRole("option", { name: "Ocupação" }));
  fireEvent.change(screen.getByLabelText("Competência"), { target: { value: "2026-08-01" } });
  await u.click(screen.getByRole("button", { name: "Criar e conciliar" }));
  await waitFor(() => expect(s.conciliar).toHaveBeenCalledWith(expect.objectContaining({ transacaoId: "transacao", novo: expect.objectContaining({ categoriaId: "despesas", dataCompetencia: "2026-08-01", dataVencimento: "2026-09-11" }) })));
});
it("cadastra e seleciona fornecedor ou beneficiário durante a conciliação", async () => {
  const u = userEvent.setup();
  render(<ConciliacaoView {...props} podeCadastrarBeneficiario />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("button", { name: "Criar despesa" }));
  await u.click(screen.getByRole("button", { name: "Cadastrar fornecedor ou beneficiário" }));
  await u.click(screen.getByRole("button", { name: /Beneficiário Pagamentos/ }));
  await u.type(screen.getByLabelText("Nome *"), "Maria Silva");
  await u.click(screen.getByRole("button", { name: "Cadastrar beneficiário" }));
  await waitFor(() => expect(s.salvarBeneficiario).toHaveBeenCalledOnce());
  expect(screen.getByRole("combobox", { name: "Fornecedor ou beneficiário do novo lançamento" }).textContent).toContain("MARIA SILVA");
  await u.click(screen.getByRole("combobox", { name: "Fornecedor ou beneficiário do novo lançamento" }));
  expect(await screen.findByRole("option", { name: "MARIA SILVA" })).toBeDefined();
});
it("cria e concilia uma receita usando as datas sugeridas", async () => {
  const receita = { ...transacao, descricao: "PIX recebido do cliente", valor: 125.55 };
  const u = userEvent.setup();
  render(<ConciliacaoView {...props} transacoes={[receita]} linhas={[]} categorias={[{ id: "receitas", nome: "Receita de vendas", grupo: "RECEITA_BRUTA" }]} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do cliente" }));
  await u.click(screen.getByRole("button", { name: "Criar receita" }));
  await u.click(screen.getByRole("combobox", { name: "Categoria do novo lançamento" }));
  await u.click(await screen.findByRole("option", { name: "Receita de vendas" }));
  expect((screen.getByLabelText("Competência") as HTMLInputElement).value).toBe("2026-09-11");
  expect((screen.getByLabelText("Vencimento") as HTMLInputElement).value).toBe("2026-09-11");
  await u.click(screen.getByRole("button", { name: "Criar e conciliar" }));
  await waitFor(() => expect(s.conciliar).toHaveBeenCalledWith(expect.objectContaining({
    transacaoId: "transacao",
    novo: expect.objectContaining({ categoriaId: "receitas", dataCompetencia: "2026-09-11", dataVencimento: "2026-09-11" }),
  })));
  expect(s.sucesso).toHaveBeenCalledWith("Conciliação concluída. Movimentações e relatórios atualizados.");
  expect(s.refresh).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Criar e conciliar" })).toBeNull();
});
it("mostra no formulário os campos obrigatórios inválidos", async () => {
  const u = userEvent.setup(); render(<ConciliacaoView {...props} />);
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("button", { name: "Criar despesa" }));
  await u.click(screen.getByRole("combobox", { name: "Categoria do novo lançamento" }));
  await u.click(await screen.findByRole("option", { name: "Ocupação" }));
  fireEvent.change(screen.getByLabelText("Competência"), { target: { value: "" } });
  await u.click(screen.getByRole("button", { name: "Criar e conciliar" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Preencha a descrição, a categoria, a competência e o vencimento com valores válidos.");
  expect(s.conciliar).not.toHaveBeenCalled();
});
it("revalidação mostra lançamento conciliado do outro lado e o filtro inclui histórico", async () => {
  const u = userEvent.setup(); const { rerender } = render(<ConciliacaoView {...props} />);
  rerender(<ConciliacaoView {...props} linhas={[{ ...linha, status: "BAIXADO", dataPagamento: "2026-09-11T15:00:00Z", contaBancariaId: "banco", transacaoExtratoId: "transacao" }]} transacoes={[{ ...transacao, conciliadaEm: "2026-09-11T15:00:00Z", conciliadaPorNome: "Admin", lancamentoIds: [linha.id] }]} />);
  expect(within(screen.getByRole("region", { name: "Movimentações da empresa" })).queryByText("Conciliado")).toBeNull();
  await u.click(screen.getByRole("button", { name: /^Conciliadas \(\d[\d.]*\)$/ }));
  expect(within(screen.getByRole("region", { name: "Movimentações da empresa" })).getByText("Conciliado")).toBeDefined();
  await u.click(screen.getByRole("button", { name: "Conferir PIX recebido do banco" }));
  await u.click(screen.getByRole("button", { name: "Desfazer conciliação" }));
  expect(screen.getByText(/Remove apenas o vínculo/)).toBeDefined(); await u.type(screen.getByLabelText("Motivo"), "Vínculo incorreto");
  await u.click(screen.getByRole("button", { name: "Desfazer vínculo" }));
  await waitFor(() => expect(s.desfazer).toHaveBeenCalledWith("transacao", "Vínculo incorreto"));
});
it("ordena os dois extratos do mais antigo para o mais novo e aplica um filtro geral", async () => {
  const u = userEvent.setup();
  const bancariaAntiga = { ...transacao, id: "banco-antiga", descricao: "BANCO PENDENTE ANTIGO", data: "2026-09-03" };
  const bancariaRecente = { ...transacao, id: "banco-recente", descricao: "BANCO PENDENTE RECENTE", data: "2026-09-20" };
  const bancariaConciliada = { ...transacao, id: "banco-conciliada", descricao: "BANCO CONCILIADO", data: "2026-09-10", conciliadaEm: "2026-09-10T12:00:00Z", conciliadaPorNome: "Admin", lancamentoIds: ["empresa-conciliada"] };
  const empresaAntiga = lancamentoTeste({ id: "empresa-antiga", descricao: "EMPRESA PENDENTE ANTIGA", valor: 70, dataVencimento: "2026-09-03T12:00:00Z" });
  const empresaRecente = lancamentoTeste({ id: "empresa-recente", descricao: "EMPRESA PENDENTE RECENTE", valor: 80, dataVencimento: "2026-09-20T12:00:00Z" });
  const empresaConciliada = lancamentoTeste({ id: "empresa-conciliada", descricao: "EMPRESA CONCILIADA", valor: 90, status: "BAIXADO", dataVencimento: "2026-09-10T12:00:00Z", dataPagamento: "2026-09-10T12:00:00Z", contaBancariaId: "banco", transacaoExtratoId: "banco-conciliada" });
  render(<ConciliacaoView {...props} linhas={[empresaRecente, empresaConciliada, empresaAntiga]} transacoes={[bancariaRecente, bancariaConciliada, bancariaAntiga]} />);

  const banco = screen.getByRole("region", { name: "Extrato bancário" });
  const empresa = screen.getByRole("region", { name: "Movimentações da empresa" });
  expect(within(banco).queryByText("BANCO CONCILIADO")).toBeNull();
  expect(within(empresa).queryByText("EMPRESA CONCILIADA")).toBeNull();
  expect(within(banco).getByText("BANCO PENDENTE ANTIGO").compareDocumentPosition(within(banco).getByText("BANCO PENDENTE RECENTE")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(empresa).getByText("EMPRESA PENDENTE ANTIGA").compareDocumentPosition(within(empresa).getByText("EMPRESA PENDENTE RECENTE")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await u.click(screen.getByRole("button", { name: /^Conciliadas \(\d[\d.]*\)$/ }));
  expect(within(banco).getByText("BANCO CONCILIADO")).toBeDefined();
  expect(within(empresa).getByText("EMPRESA CONCILIADA")).toBeDefined();
  expect(within(banco).queryByText("BANCO PENDENTE ANTIGO")).toBeNull();
  expect(within(empresa).queryByText("EMPRESA PENDENTE ANTIGA")).toBeNull();

  await u.click(screen.getByRole("button", { name: /^Todas \(\d[\d.]*\)$/ }));
  expect(within(banco).getByText("BANCO PENDENTE ANTIGO").compareDocumentPosition(within(banco).getByText("BANCO CONCILIADO")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(empresa).getByText("EMPRESA PENDENTE ANTIGA").compareDocumentPosition(within(empresa).getByText("EMPRESA CONCILIADA")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it("mantém um filtro de período compartilhado ao abrir a conciliação", async () => {
  const u = userEvent.setup(); render(<MovimentacoesView {...opcoes} linhas={[linha]} avulsas={[]} saldoInicial={0} conciliacao={{ acesso, transacoes: [transacao] }} />);
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-12" } });
  fireEvent.blur(screen.getByLabelText("De"));
  await u.click(screen.getByRole("button", { name: "Conciliação bancária" }));
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-09-12");
  expect(screen.queryByRole("button", { name: "Conferir PIX recebido do banco" })).toBeNull();
  expect(screen.queryByText("Aluguel da cozinha")).toBeNull();
});
it("não oferece Saldo do dia pendente para conciliação", () => {
  render(<ConciliacaoView {...props} transacoes={[{ ...transacao, descricao: "SALDO TOTAL DISPONÍVEL DIA" }]} />);
  expect(screen.queryByRole("button", { name: /Conferir SALDO TOTAL/ })).toBeNull();
  expect(screen.getByText("Nenhum extrato neste período. Importe o arquivo do banco ou amplie as datas.")).toBeDefined();
});
it("seletores oficiais preservam os índices numéricos e o formato do CSV enviado à conferência", async () => {
  s.preparar.mockResolvedValue({ erro: "Prévia fictícia." });
  const u = userEvent.setup();
  render(<ImportarExtratoDialog contaId="banco" contaNome="Conta principal" aoFechar={vi.fn()} aoImportar={vi.fn()} />);
  const arquivo = new File(["Dia;Descrição;Entrada;Saída\n2026-09-11;PIX;100,00;0,00"], "extrato-ficticio.csv", { type: "text/csv" });
  Object.defineProperty(arquivo, "text", { value: async () => "Dia;Descrição;Entrada;Saída\n2026-09-11;PIX;100,00;0,00" });
  await u.upload(screen.getByLabelText("Arquivo do banco"), arquivo);
  await u.click(await screen.findByRole("combobox", { name: "Data" }));
  await u.click(await screen.findByRole("option", { name: "1. Dia" }));
  await u.click(screen.getByRole("combobox", { name: "Valores do extrato" }));
  await u.click(await screen.findByRole("option", { name: "Entrada e saída separadas" }));
  await u.click(screen.getByRole("combobox", { name: "Entrada" }));
  await u.click(await screen.findByRole("option", { name: "3. Entrada" }));
  await u.click(screen.getByRole("combobox", { name: "Saída" }));
  await u.click(await screen.findByRole("option", { name: "4. Saída" }));
  expect(s.preparar).not.toHaveBeenCalled();
  expect(s.importar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Conferir extrato" }));
  await waitFor(() => expect(s.preparar).toHaveBeenCalledOnce());
  const formulario = s.preparar.mock.calls[0][0] as FormData;
  expect(JSON.parse(String(formulario.get("mapa")))).toEqual(expect.objectContaining({ cabecalho: 0, data: 0, descricao: 1, entrada: 2, saida: 3, identificador: -1, modo: "COLUNAS", formatoData: "BR", formatoValor: "BR" }));
  expect(s.importar).not.toHaveBeenCalled();
});

it("prévia de importação exige conta confirmada antes de gravar", async () => {
  s.preparar.mockResolvedValue({ previa: { nomeArquivo: "extrato.ofx", contaNome: "Conta principal", referenciaOfx: "001 / 1 / 123", linhasSaldoIgnoradas: 1, linhas: [{ indice: 0, data: "2026-09-11", descricao: "PIX", centavos: -100, identificador: "1", situacao: "NOVA" }] } });
  s.importar.mockResolvedValue({ importadas: 1, linhasSaldoIgnoradas: 1, de: "2026-09-11", ate: "2026-09-11" }); const aoImportar = vi.fn();
  const u = userEvent.setup(); render(<ImportarExtratoDialog contaId="banco" contaNome="Conta principal" aoFechar={vi.fn()} aoImportar={aoImportar} />);
  await u.upload(screen.getByLabelText("Arquivo do banco"), new File(["OFX"], "extrato.ofx"));
  await u.click(screen.getByRole("button", { name: "Conferir extrato" }));
  expect(await screen.findByText("1 linha informativa de saldo será ignorada.")).toBeDefined();
  const confirmar = await screen.findByRole("button", { name: "Importar 1 transações" }) as HTMLButtonElement; expect(confirmar.disabled).toBe(true);
  await u.click(screen.getByLabelText("Confirmei que este extrato pertence à conta Conta principal."));
  await waitFor(() => expect((screen.getByRole("button", { name: "Importar 1 transações" }) as HTMLButtonElement).disabled).toBe(false));
  await u.click(screen.getByRole("button", { name: "Importar 1 transações" })); await waitFor(() => expect(s.importar).toHaveBeenCalledOnce());
  expect((s.importar.mock.calls[0][0] as FormData).get("confirmarConta")).toBe("sim");
  expect(aoImportar).toHaveBeenCalledWith({ de: "2026-09-11", ate: "2026-09-11" });
});

it("possível duplicada do Itaú mostra a descrição anterior e fica desmarcada", async () => {
  s.preparar.mockResolvedValue({ previa: {
    nomeArquivo: "itau.ofx", contaNome: "Conta principal", referenciaOfx: "341 / 1 / 123", linhasSaldoIgnoradas: 1,
    linhas: [
      { indice: 0, data: "2026-09-10", descricao: "RENDIMENTOS APLIC AUT MAIS", centavos: 35, identificador: "20260910002", situacao: "POSSIVEL_DUPLICADA", observacao: 'Já existe uma movimentação nesta data e com este valor: "REND APLIC AUT APR". Importe somente se for outra transação.' },
      { indice: 1, data: "2026-09-11", descricao: "PIX NOVO", centavos: -100, identificador: "20260911001", situacao: "NOVA" },
    ],
  } });
  const u = userEvent.setup();
  render(<ImportarExtratoDialog contaId="banco" contaNome="Conta principal" aoFechar={vi.fn()} aoImportar={vi.fn()} />);
  await u.upload(screen.getByLabelText("Arquivo do banco"), new File(["OFX"], "itau.ofx"));
  await u.click(screen.getByRole("button", { name: "Conferir extrato" }));
  expect(await screen.findByText(/REND APLIC AUT APR/)).toBeDefined();
  expect((screen.getByRole("checkbox", { name: "Importar RENDIMENTOS APLIC AUT MAIS linha 1" }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("checkbox", { name: "Importar PIX NOVO linha 2" }) as HTMLInputElement).checked).toBe(true);
  expect(s.importar).not.toHaveBeenCalled();
});

it("mostra e pré-seleciona a candidata a sete dias mesmo fora do período bancário, sem conciliar automaticamente", () => {
  render(<ConciliacaoView {...props} periodo={{ de: "2026-09-01", ate: "2026-09-30" }}
    transacoes={[{ ...transacao, data: "2026-09-01", descricao: "PIX HORTA DA SERRA" }]}
    linhas={[{ ...linha, dataVencimento: "2026-08-25T12:00:00Z", fornecedorNome: "Horta da Serra" }]} />);
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Conferir PIX HORTA DA SERRA" }));
  expect((screen.getByRole("checkbox", { name: "Selecionar Horta da Serra" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText(/vencimento a até 7 dias/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Confirmar pré-conciliação" }) as HTMLButtonElement).disabled).toBe(false);
  expect(s.conciliar).not.toHaveBeenCalled();
});
it("situações contam transações do banco na conta e período, incluindo zero", () => {
  render(<ConciliacaoView {...props} transacoes={[transacao, { ...transacao, id: "conciliada", conciliadaEm: "2026-09-12" }, { ...transacao, id: "fora", data: "2026-08-31" }, { ...transacao, id: "outra", contaBancariaId: "outra" }]} />);
  const grupo = within(screen.getByRole("group", { name: "Situação da conciliação" }));
  expect(grupo.getByRole("button", { name: "Todas (2)" })).toBeTruthy();
  expect(grupo.getByRole("button", { name: "Pendentes (1)" })).toBeTruthy();
  expect(grupo.getByRole("button", { name: "Conciliadas (1)" })).toBeTruthy();
});
