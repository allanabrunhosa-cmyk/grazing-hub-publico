// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { fornecedorStatus, insumoStatus } from "./dados";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/producao/etiquetas/actions", () => ({ salvarConfiguracaoProdutoEtiquetaAction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/(protegido)/status-cadastros-actions", () => ({
  alterarStatusInsumoAction: vi.fn(), alterarStatusFornecedorAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/insumos/actions", () => ({
  deleteInsumoAction: vi.fn(), saveInsumoAction: vi.fn(),
  createCategoriaAction: vi.fn(), createCentroCustoAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({
  saveFornecedorAction: vi.fn(), deleteFornecedorAction: vi.fn(),
  salvarBeneficiarioAction: vi.fn(), excluirBeneficiarioAction: vi.fn(),
  createCanalPedidoAction: vi.fn(), createFormaPagamentoAction: vi.fn(),
}));
vi.mock("@/lib/insumos/consulta-porcoes-cliente", () => ({
  consultarPorcoesNoCliente: vi.fn(async () => ({ porcoes: [], podeCadastrar: false })),
  salvarPorcaoAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const Administrador = ({ children }: { children: ReactNode }) => (
  <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{children}</ProvedorAcesso>
);
beforeEach(() => vi.stubGlobal("ResizeObserver", class {
  observe() {} unobserve() {} disconnect() {}
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["INSUMO", "PRODUTO_INTERMEDIARIO"] as const)(
  "edita %s diretamente pela linha, antes de excluir, sem duplicar ao expandir",
  async tipo => {
    const usuario = userEvent.setup();
    render(<InsumosTable insumos={[{ ...insumoStatus, tipo }]} categorias={[]} centrosCusto={[]}
      fornecedores={[]} todosInsumos={[]} />, { wrapper: Administrador });
    const acoes = within(screen.getByRole("group", { name: `Ações de ${insumoStatus.nome}` }));
    expect(acoes.getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual(["Editar", "Excluir item"]);
    const expansao = screen.getByRole("button", { name: `Abrir detalhes de ${insumoStatus.nome}` });
    await usuario.click(acoes.getByRole("button", { name: "Editar" }));
    const dialogo = within(await screen.findByRole("dialog", { name: tipo === "INSUMO" ? "Editar Insumo" : "Editar Preparação" }));
    expect(dialogo.getByRole("textbox", { name: "Nome Oficial *" }).getAttribute("value")).toBe(insumoStatus.nome);
    expect(expansao.getAttribute("aria-expanded")).toBe("false");
    await usuario.click(dialogo.getByRole("button", { name: "Cancelar" }));
    await usuario.click(expansao);
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(expansao.getAttribute("aria-expanded")).toBe("true");
    await usuario.click(screen.getByRole("button", { name: "Editar" }));
    expect(await screen.findByRole("dialog", { name: /Editar (Insumo|Preparação)/ })).toBeTruthy();
  },
);

it.each(["FORNECEDOR", "BENEFICIARIO"] as const)(
  "mantém somente a edição da linha principal de %s, à esquerda de excluir",
  async tipoCadastro => {
    const usuario = userEvent.setup();
    const rotulo = tipoCadastro === "FORNECEDOR" ? "fornecedor" : "beneficiário";
    render(<FornecedoresTable fornecedores={[{ ...fornecedorStatus, tipoCadastro }]}
      canaisPedidoOptions={[]} formasPagamentoOptions={[]} />, { wrapper: Administrador });
    if (tipoCadastro === "BENEFICIARIO") await usuario.click(screen.getByRole("tab", { name: /Beneficiários/ }));
    const acoes = within(screen.getByRole("group", { name: `Ações de ${fornecedorStatus.nome}` }));
    expect(acoes.getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual([`Editar ${rotulo}`, `Excluir ${rotulo}`]);
    const expansao = screen.getByRole("button", { name: `Abrir detalhes de ${fornecedorStatus.nome}` });
    await usuario.click(acoes.getByRole("button", { name: `Editar ${rotulo}` }));
    const dialogo = within(await screen.findByRole("dialog", { name: `Editar ${rotulo}` }));
    expect(expansao.getAttribute("aria-expanded")).toBe("false");
    await usuario.click(dialogo.getByRole("button", { name: "Cancelar" }));
    await usuario.click(expansao);
    expect(screen.getAllByRole("button", { name: `Editar ${rotulo}` })).toHaveLength(1);
    const detalhes = within(screen.getByRole("region", { name: `Detalhes de ${fornecedorStatus.nome}` }));
    expect(detalhes.queryByRole("button", { name: /Editar/ })).toBeNull();
  },
);

it("não oferece edição sem permissão, nem na lista nem nos detalhes", async () => {
  const usuario = userEvent.setup();
  render(<>
    <InsumosTable insumos={[insumoStatus]} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} />
    <FornecedoresTable fornecedores={[fornecedorStatus]} canaisPedidoOptions={[]} formasPagamentoOptions={[]} />
  </>);
  expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: `Abrir detalhes de ${insumoStatus.nome}` }));
  await usuario.click(screen.getByRole("button", { name: `Abrir detalhes de ${fornecedorStatus.nome}` }));
  expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
});

it("Produção abre Validades dentro do insumo sem ganhar edição do cadastro",async()=>{
 const usuario=userEvent.setup();render(<ProvedorAcesso acesso={{admin:false,permissoes:{insumos:["visualizar"],"producao.validades":["visualizar","editar"]},excecoes:{}}}><InsumosTable insumos={[{...insumoStatus,etiquetaHabilitada:true,validadeRefrigeradoDias:3}]} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]}/></ProvedorAcesso>);
 expect(screen.queryByRole("button",{name:"Editar"})).toBeNull();await usuario.click(screen.getByText(insumoStatus.nome));await usuario.click(screen.getByRole("tab",{name:"Validades"}));expect(screen.getByRole("button",{name:"Salvar validades"})).toBeTruthy();expect(screen.getByLabelText(/Refrigerado/)).toHaveProperty("disabled",false);
});
