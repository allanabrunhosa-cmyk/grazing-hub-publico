// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ salvar: vi.fn(), receber: vi.fn(), status: vi.fn() }));
vi.mock("@/app/(protegido)/compras/actions", () => ({ salvarPedidoAction: sim.salvar, confirmarRecebimentoAction: sim.receber }));
vi.mock("@/app/(protegido)/compras/reagendar-pedido", () => ({ reagendarPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/status-cadastros-actions", () => ({ alterarStatusFornecedorAction: sim.status, alterarStatusInsumoAction: sim.status }));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({ saveFornecedorAction: sim.salvar, deleteFornecedorAction: vi.fn(), salvarBeneficiarioAction: sim.salvar,
  excluirBeneficiarioAction: vi.fn(), createCanalPedidoAction: vi.fn(), createFormaPagamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ deleteInsumoAction: vi.fn(), saveInsumoAction: sim.salvar }));
vi.mock("@/lib/insumos/consulta-porcoes-cliente", () => ({ consultarPorcoesNoCliente: vi.fn(async () => ({ porcoes: [], podeCadastrar: false })), salvarPorcaoAction: vi.fn() }));
import { PedidosView } from "@/app/(protegido)/compras/pedidos-view";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import type { PedidoRow } from "@/app/(protegido)/compras/types";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { fornecedorStatus, insumoStatus } from "../cadastros/dados";

const pedido: PedidoRow = { id: "compra-ficticia", numero: 1, fornecedorId: null, fornecedorAvulso: "Loja fictícia", fornecedorNome: "Loja fictícia", usoConsumo: true,
  dataPedido: "2026-10-01T12:00:00Z", previsaoEntrega: null, status: "CONFIRMADO", observacoes: null, temDivergencia: false, recebimentos: [], itens: [] };
const compra = (entidadeInicialId?: string, excluido = false) => <PedidosView pedidos={[{ ...pedido, excluidoEm: excluido ? "2026-10-02T12:00:00Z" : null }]}
  fornecedores={[]} insumos={[]} cotacoes={[]} entidadeInicialId={entidadeInicialId} />;
const fornecedores = (entidadeInicialId?: string) => <FornecedoresTable fornecedores={[fornecedorStatus, { ...fornecedorStatus, id: "beneficiario-ficticio", tipoCadastro: "BENEFICIARIO", nome: "Pessoa fictícia", ativo: false }]}
  canaisPedidoOptions={[]} formasPagamentoOptions={[]} entidadeInicialId={entidadeInicialId} />;
const insumos = (entidadeInicialId?: string) => <InsumosTable insumos={Array.from({ length: 30 }, (_, n) => ({ ...insumoStatus, id: `insumo-${n}`, nome: `Insumo fictício ${n}`, ativo: n !== 29 }))}
  categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} entidadeInicialId={entidadeInicialId} />;
const leitor = ({ children }: { children: React.ReactNode }) => <ProvedorAcesso acesso={{ admin: false, permissoes: { compras: ["visualizar"], fornecedores: ["visualizar"], insumos: ["visualizar"] }, excecoes: {} }}>{children}</ProvedorAcesso>;
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("links de entidades existentes abrem consulta", () => {
  it("compra abre detalhe sem editar/receber/excluir e preserva rascunho armazenado", () => {
    sessionStorage.setItem("grazing-hub:compras:novo-pedido:v1", "rascunho-ficticio-preservado");
    render(compra(pedido.id), { wrapper: leitor });
    const detalhe = within(screen.getByRole("dialog"));
    expect(detalhe.getByRole("heading", { name: "#0001 — Loja fictícia" })).toBeTruthy();
    expect(detalhe.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(detalhe.queryByRole("button", { name: "Confirmar recebimento" })).toBeNull();
    expect(detalhe.queryByRole("button", { name: "Excluir pedido" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Novo pedido de compra" })).toBeNull();
    expect(sessionStorage.getItem("grazing-hub:compras:novo-pedido:v1")).toBe("rascunho-ficticio-preservado");
    expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.receber).not.toHaveBeenCalled();
  });
  it("compra excluída conserva consulta histórica sem ações de alteração", () => {
    render(compra(pedido.id, true), { wrapper: leitor });
    expect(screen.getByText(/Disponível somente para consulta/)).toBeTruthy();
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Excluir pedido" })).toBeNull();
  });
  it("compra inexistente ou visita normal não abre diálogo automaticamente", () => {
    const { unmount } = render(compra("id-ausente"), { wrapper: leitor });
    expect(screen.queryByRole("dialog")).toBeNull(); unmount();
    render(compra(), { wrapper: leitor }); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("beneficiário inativo seleciona sua aba e expande leitura sem abrir editor", () => {
    render(fornecedores("beneficiario-ficticio"), { wrapper: leitor });
    const detalhe = screen.getByRole("region", { name: "Detalhes de Pessoa fictícia" });
    expect(detalhe).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Beneficiários/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar beneficiário" })).toBeNull();
    expect(document.activeElement?.id).toBe("expansao-fornecedor-beneficiario-ficticio");
    expect(sim.status).not.toHaveBeenCalled();
  });
  it("fornecedor ausente ou visita normal conserva lista sem expansão", () => {
    const { unmount } = render(fornecedores("ausente"), { wrapper: leitor });
    expect(screen.queryByRole("region", { name: /Detalhes de/ })).toBeNull(); unmount();
    render(fornecedores(), { wrapper: leitor });
    expect(screen.queryByRole("region", { name: /Detalhes de/ })).toBeNull();
  });
  it("insumo inativo na página 2 fica visível e expandido; alterar busca conserva filtro normal", async () => {
    const usuario = userEvent.setup(); render(insumos("insumo-29"), { wrapper: leitor });
    expect(screen.getByRole("button", { name: "Fechar detalhes de Insumo fictício 29" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Pag. 2")).toBeTruthy();
    expect(document.activeElement?.id).toBe("expansao-insumo-insumo-29");
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    await usuario.type(screen.getByRole("textbox", { name: "Buscar insumo, marca, categoria ou fornecedor" }), "Insumo fictício 0");
    expect(screen.getByText("Pag. 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fechar detalhes de Insumo fictício 29" })).toBeNull();
    expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.status).not.toHaveBeenCalled();
  });
  it("insumo ausente ou visita normal preserva padrão ativos e página 1", () => {
    const { unmount } = render(insumos("ausente"), { wrapper: leitor });
    expect(screen.queryByText("Insumo fictício 29")).toBeNull();
    expect(screen.getByText("Pag. 1")).toBeTruthy(); unmount();
    render(insumos(), { wrapper: leitor });
    expect(screen.queryByText("Insumo fictício 29")).toBeNull();
    expect(screen.queryByRole("button", { name: /Fechar detalhes/ })).toBeNull();
  });
  it("detalhe inicial de insumo continua consulta para administrador", async () => {
    const usuario = userEvent.setup();
    render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{insumos("insumo-29")}</ProvedorAcesso>);
    const controles = screen.getAllByRole("switch", { name: "Status de Insumo fictício 29" });
    expect((controles.at(-1) as HTMLButtonElement).disabled).toBe(true);
    expect((controles[0] as HTMLButtonElement).disabled).toBe(false);
    await usuario.click(controles.at(-1)!);
    expect(sim.status).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
