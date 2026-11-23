// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevisaoNcmPendentePainel, type RevisaoNcmPainel } from "@/app/(protegido)/financeiro/fiscal/revisao-ncm-pendente";
import { EmitirNotaPedido } from "@/app/(protegido)/vendas/pedidos/emitir-nota-pedido";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} /> }));
vi.mock("@/components/layout/acesso-contexto", () => ({ useAcesso: () => ({ podeRota: () => true }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/emissao-actions", () => ({ emitirNotaPedidoDiretaBrasilNfeAction: vi.fn(), consultarResultadoEmissaoPedidoBrasilNfeAction: vi.fn(), consultarEmissaoPedidoBrasilNfeAction: vi.fn(), obterDocumentosEmissaoPedidoBrasilNfeAction: vi.fn(), cancelarNotaPedidoBrasilNfeAction: vi.fn() }));
afterEach(() => { cleanup(); refresh.mockClear(); });

// Produtos e códigos exclusivamente fictícios.
const revisoes: RevisaoNcmPainel[] = [
  { versaoId: "versao-a", produtoId: "produto-a", nome: "Tábua fictícia para dez", ncms: ["16010000"], mudancas: ["Ingrediente incluído: Insumo fictício A", "Ingrediente retirado: Insumo fictício B"], assinatura: "a".repeat(64) },
  { versaoId: "versao-b", produtoId: "produto b/1", nome: "Torta fictícia", ncms: ["19059090", "16023230"], mudancas: ["Opção Sabor fictício — Receita da preparação alterada: Recheio fictício"], assinatura: "b".repeat(64) },
];

describe("Revisão de NCM pendente no painel fiscal", () => {
  it("lista produtos, NCM atual e mudanças; Alterar NCM abre a ficha do produto", () => {
    render(<RevisaoNcmPendentePainel revisoes={revisoes} podeDecidir manter={vi.fn()} />);
    const secao = screen.getByRole("region", { name: "Revisão de NCM pendente" });
    expect(within(secao).getByText("Revisão de NCM pendente · 2 produtos")).toBeTruthy();
    expect(within(secao).getByText(/ele só muda com a sua decisão/)).toBeTruthy();
    expect(within(secao).getByText("19059090, 16023230")).toBeTruthy();
    expect(within(secao).getByText("Ingrediente retirado: Insumo fictício B")).toBeTruthy();
    const links = within(secao).getAllByRole("link", { name: /Alterar NCM/ });
    expect(links.map(l => l.getAttribute("href"))).toEqual(["/financeiro/fiscal/vinculos?produto=produto-a", "/financeiro/fiscal/vinculos?produto=produto%20b%2F1"]);
  });
  it("Manter NCM exige confirmação e só então registra a decisão, uma única vez", async () => {
    const manter = vi.fn(async () => ({ ok: true as const })), usuario = userEvent.setup();
    render(<RevisaoNcmPendentePainel revisoes={revisoes} podeDecidir manter={manter} />);
    await usuario.click(within(screen.getByRole("group", { name: "Decisão de NCM de Tábua fictícia para dez" })).getByRole("button", { name: "Manter NCM" }));
    expect(manter).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/continua com o NCM 16010000 para a composição atual/)).toBeTruthy();
    await usuario.dblClick(within(dialogo).getByRole("button", { name: "Manter NCM" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(manter).toHaveBeenCalledTimes(1);
    expect(manter).toHaveBeenCalledWith({ versaoId: "versao-a", assinatura: "a".repeat(64), chaveOperacao: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("cancelar não registra nada; erro do servidor fica visível e mantém o diálogo", async () => {
    const manter = vi.fn(async () => ({ erro: "A composição mudou de novo depois deste aviso." })), usuario = userEvent.setup();
    render(<RevisaoNcmPendentePainel revisoes={revisoes} podeDecidir manter={manter} />);
    await usuario.click(screen.getAllByRole("button", { name: "Manter NCM" })[1]);
    await usuario.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(manter).not.toHaveBeenCalled();
    await usuario.click(screen.getAllByRole("button", { name: "Manter NCM" })[1]);
    await usuario.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Manter NCM" }));
    expect((await screen.findByRole("alert")).textContent).toContain("mudou de novo");
    expect(screen.getByRole("dialog")).toBeTruthy(); expect(refresh).not.toHaveBeenCalled();
  });
  it("sem permissão de administrador a decisão fica desabilitada; sem pendências nada é exibido", () => {
    const { rerender } = render(<RevisaoNcmPendentePainel revisoes={revisoes} podeDecidir={false} manter={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Manter NCM" }).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText(/a decisão sobre o NCM é do administrador/)).toBeTruthy();
    rerender(<RevisaoNcmPendentePainel revisoes={[]} podeDecidir manter={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "Revisão de NCM pendente" })).toBeNull();
  });
});

describe("Revisão de NCM pendente no pedido", () => {
  const fiscal = { editar: true, cancelar: false, documentos: [] };
  it("avisa sem impedir a emissão e aponta para a revisão no painel", () => {
    render(<EmitirNotaPedido pedidoId="pedido-ficticio" numeroPedido={1} versao={1} confirmado fiscal={{ ...fiscal, revisoesNcm: [{ produtoId: "produto-a", nome: "Tábua fictícia para dez" }] }} />);
    const aviso = screen.getByText(/Revisão de NCM pendente: Tábua fictícia para dez\./);
    expect(aviso.textContent).toContain("a nota sai com o NCM atual até a sua decisão");
    expect(screen.getByRole("link", { name: "Revisar NCM" }).getAttribute("href")).toBe("/financeiro/fiscal#revisao-ncm");
    expect((screen.getByRole("button", { name: "Emitir NFC-e" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("sem revisão pendente o bloco fiscal não muda", () => {
    render(<EmitirNotaPedido pedidoId="pedido-ficticio" numeroPedido={1} versao={1} confirmado fiscal={fiscal} />);
    expect(screen.queryByText(/Revisão de NCM pendente/)).toBeNull();
  });
});
