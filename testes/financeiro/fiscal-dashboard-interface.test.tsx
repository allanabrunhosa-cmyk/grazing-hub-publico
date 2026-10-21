// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { criarDashboardFiscalFicticio } from "../visual/fiscal-dashboard-dados";
import { PainelFiscal } from "@/app/(protegido)/financeiro/fiscal/painel-fiscal";
import { formatarMoedaFiscal, formatarDataFiscal } from "@/app/(protegido)/financeiro/fiscal/formatacao";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} /> }));
vi.mock("@/app/(protegido)/financeiro/fiscal/documento-actions", () => ({ consultarDocumentoDashboardAction: vi.fn(async () => ({ campos: [{ nome: "Emitente", valor: "Fornecedor sintético" }], itens: [], aviso: null })) }));
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); push.mockClear(); });
describe("dashboard fiscal: apresentação e interação", () => {
  it("mostra habilitação manual NF-e sem declarar NFC-e liberada ou dispensar autorização por nota", () => {
    const dados = criarDashboardFiscalFicticio(); dados.integracao.emissaoHabilitada = true; dados.integracao.emissaoManual = { nfe: true, nfce: false, atualizadaEm: "2026-10-15T12:00:00.000Z" };
    render(<PainelFiscal dados={dados} />);
    expect(screen.getByText(/Produção · NF-e manual habilitada/)).toBeTruthy();
    expect(screen.queryByText(/emissão não habilitada/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Serviços contratados" })).toBeNull();
  });
  it("distingue zero real, valor ausente e dinheiro acima do inteiro seguro", () => {
    expect(formatarMoedaFiscal("0.00")).toBe("R$\u00a00,00");
    expect(formatarMoedaFiscal(null)).toBe("—");
    expect(formatarMoedaFiscal("9007199254740993.27")).toBe("R$\u00a09.007.199.254.740.993,27");
    expect(formatarMoedaFiscal("inválido")).toBe("—");
  });
  it("conserva o dia oficial projetado sem regressão para a véspera por UTC", () => {
    expect(formatarDataFiscal("2026-10-01")).toBe("01/10/2026");
    expect(formatarDataFiscal("2026-10-01T00:10:00-03:00")).toBe("01/10/2026");
  });
  it("usa apenas a projeção fiscal, exibe as quatro métricas e oferece dados acessíveis dos gráficos", () => {
    const dados = criarDashboardFiscalFicticio();
    render(<PainelFiscal dados={dados} />);
    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeTruthy();
    for (const titulo of ["Faturamento", "Despesas", "Canceladas", "Ticket médio"]) expect(screen.getByRole("heading", { name: titulo })).toBeTruthy();
    expect(screen.getByText(formatarMoedaFiscal(dados.metricas.faturamento.valor).replace(/\u00a0/g, " "))).toBeTruthy();
    expect(screen.getByText("Vence em 07/11/2026 (26d)")).toBeTruthy();
    expect(screen.getByText("Certificado SEFAZ · administração nas configurações fiscais")).toBeTruthy();
    expect(screen.getAllByText("Conexão não verificada")).toHaveLength(1);
    const grafico = screen.getByRole("group", { name: /Movimento diário/ });
    fireEvent.keyDown(grafico, { key: "End" });
    expect(screen.getByText(/Dia 31 · Saídas/)).toBeTruthy();
    fireEvent.keyDown(grafico, { key: "Escape" });
    expect(screen.getByText(/Passe pelo gráfico/)).toBeTruthy();
    expect(screen.getByText("Ver valores diários")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Últimos documentos fiscais" })).toBeTruthy();
  });
  it("mostra indisponibilidade em vez de transformar fonte ausente em zero", () => {
    const dados = criarDashboardFiscalFicticio("2026-10", "PRODUCAO", true);
    render(<PainelFiscal dados={dados} />);
    expect(screen.getAllByText("Dados fiscais oficiais indisponíveis")).toHaveLength(4);
    expect(screen.queryByText("R$\u00a00,00")).toBeNull();
    expect(screen.getByText(/Movimento indisponível/)).toBeTruthy();
    expect(screen.getByText("Dados incompletos")).toBeTruthy();
  });
  it.each([
    [{ situacao: "NAO_VERIFICADO", validoAte: null, diasParaVencer: null }, "Validade não verificada"],
    [{ situacao: "VENCIDO", validoAte: "2026-10-11T12:00:00.000Z", diasParaVencer: -1 }, "Vencido em 11/10/2026"],
    [{ situacao: "VIGENTE", validoAte: "2026-12-07T12:00:00.000Z", diasParaVencer: 56 }, "Válido até 07/12/2026"],
  ] as const)("apresenta o estado %s do certificado sem comprovar conexão", (certificado, texto) => {
    const dados = criarDashboardFiscalFicticio();
    dados.integracao.certificado = certificado;
    render(<PainelFiscal dados={dados} />);
    expect(screen.getByText(texto)).toBeTruthy();
    expect(screen.getAllByText("Conexão não verificada")).toHaveLength(1);
  });
  it("mostra a data do certificado no fuso de Dados da empresa e preserva o prazo do servidor", () => {
    const dados = criarDashboardFiscalFicticio();
    dados.integracao.certificado = { situacao: "A_VENCER", validoAte: "2026-11-07T01:00:00.000Z", diasParaVencer: 25 };
    render(<PainelFiscal dados={dados} />);
    expect(screen.getByText("Vence em 06/11/2026 (25d)")).toBeTruthy();
  });
  it("homologação fica explícita e a seleção nunca oferece mistura de ambientes", async () => {
    render(<PainelFiscal dados={criarDashboardFiscalFicticio("2026-10", "HOMOLOGACAO")} />);
    expect(screen.getByText(/Ambiente de testes/)).toBeTruthy();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("combobox", { name: "Ambiente" }));
    const lista = await screen.findByRole("listbox");
    expect(within(lista).getAllByRole("option")).toHaveLength(2);
    expect(within(lista).queryByText("Todos")).toBeNull();
    await usuario.click(within(lista).getByRole("option", { name: "Produção" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/financeiro/fiscal?ambiente=PRODUCAO&mes=2026-10", { scroll: false }));
  });
  it("aplica o período do DRE ao confirmar o campo e conserva o ambiente", async () => {
    render(<PainelFiscal dados={criarDashboardFiscalFicticio()} />);
    const de = screen.getByLabelText("De");
    fireEvent.change(de, { target: { value: "2026-09-01" } });
    expect(push).not.toHaveBeenCalled();
    fireEvent.blur(de);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/financeiro/fiscal?ambiente=PRODUCAO&de=2026-09-01&ate=2026-10-31", { scroll: false }));
  });
  it("filtra os documentos pelos cartões e pelas quatro abas", async () => {
    render(<PainelFiscal dados={criarDashboardFiscalFicticio()} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Despesas" }));
    let tabela = within(screen.getByRole("table", { name: "Últimos documentos fiscais" }));
    expect(tabela.queryByText("NF saída")).toBeNull();
    expect(tabela.getByText("NFS entrada")).toBeTruthy();
    await usuario.click(screen.getByRole("tab", { name: /NFS entrada/ }));
    tabela = within(screen.getByRole("table", { name: "Últimos documentos fiscais" }));
    expect(tabela.getAllByRole("row")).toHaveLength(2);
    expect(tabela.getByText("NFS-e · 908")).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: "Canceladas" }));
    expect(screen.getByText("NF-e · 1001")).toBeTruthy();
    expect(screen.queryByText("NFS-e · 908")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Data de emissão" })).toBeTruthy();
    expect(screen.queryByText("Pendências fiscais")).toBeNull();
    expect(screen.getByRole("button", { name: /Abrir configurações/ }).getAttribute("href")).toBe("/financeiro/fiscal/configuracoes");
  });
  it("omite links administrativos quando a autorização do servidor não os fornece", () => {
    const dados = criarDashboardFiscalFicticio();
    dados.links = { grupos: null, vinculos: null, notasRecebidas: null, configuracao: null };
    dados.pendencias = [];
    render(<PainelFiscal dados={dados} />);
    expect(screen.queryByText("Ver integração")).toBeNull();
    expect(screen.queryByText("Grupos fiscais")).toBeNull();
    expect(screen.queryByText("Vínculos fiscais")).toBeNull();
    expect(screen.queryByText("Notas recebidas")).toBeNull();
  });
});

describe("detalhes locais das notas no Dashboard", () => {
  it("abre os detalhes pelo olho e fecha sem mudar os filtros", async () => {
    render(<PainelFiscal dados={criarDashboardFiscalFicticio()} />);
    const olho = screen.getAllByRole("button", { name: /Ver detalhes da nota/ })[0];
    await userEvent.click(olho);
    const painel = await screen.findByRole("dialog", { name: "Detalhes da nota" });
    expect(await within(painel).findByText("Fornecedor sintético")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Detalhes da nota" })).toBeNull());
    expect(push).not.toHaveBeenCalled();
  });
  it("desabilita os olhos sem permissão da origem", () => {
    const dados = criarDashboardFiscalFicticio(); dados.ultimosDocumentos.forEach(doc => { doc.detalhesDisponiveis = false; });
    render(<PainelFiscal dados={dados} />);
    expect(screen.getAllByRole("button", { name: /Ver detalhes da nota/ }).every(b => b.hasAttribute("disabled"))).toBe(true);
  });
});
