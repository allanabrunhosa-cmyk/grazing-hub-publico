// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ preparar: vi.fn(), acao: vi.fn(), previa: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/fiscal-actions", () => ({ prepararFiscalSaidaAction: sim.preparar, acaoFiscalSaidaAction: sim.acao, previaFiscalSaidaAction: sim.previa }));
import { FiscalPedido, type ResumoFiscalSaida } from "@/app/(protegido)/vendas/pedidos/fiscal-pedido";
const base = { pedidoId: "pedido", versao: 1, confirmado: true, editar: true, configurado: false, documentos: [] };
const documento: ResumoFiscalSaida = { id: "doc", versaoPedido: 1, status: "AUTORIZADO", ambiente: "HOMOLOGACAO", provedor: "Fictício", tentativas: 1, ultimoErro: null, referenciaProvedor: "referencia-ficticia", chaveFiscal: null, numero: "123", serie: "TESTE", protocolo: "protocolo-ficticio" };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function escolherContextoFiscal() {
  const u = userEvent.setup();
  for (const [campo, valor] of [["Finalidade fiscal do adquirente", "Uso final"], ["Indicador de IE fiscal", "Não contribuinte · 9"], ["Indicador de presença fiscal", "Presencial no estabelecimento · 1"]]) {
    await u.click(screen.getByRole("combobox", { name: campo })); await u.click(await screen.findByRole("option", { name: valor }));
  }
}
it("o consumidor legado conserva apenas prévia local e leitura; não cria um segundo emissor", () => {
  render(<FiscalPedido {...base} configurado documentos={[documento]} />);
  expect(screen.getByText(/transmissão individual ocorre somente no painel Emitir nota fiscal/)).toBeTruthy();
  for (const nome of ["Preparar solicitação fiscal", "Enviar ao emissor", "Solicitar cancelamento fiscal", "Obter documentos", "Consultar emissor"]) expect(screen.queryByRole("button", { name: nome })).toBeNull();
  expect(sim.preparar).not.toHaveBeenCalled(); expect(sim.acao).not.toHaveBeenCalled();
});
it("consulta sem edição mantém documento e arquivos, sem oferecer comandos", () => {
  render(<FiscalPedido {...base} editar={false} configurado documentos={[documento]} />);
  expect(screen.getByText(/Autorizado pelo emissor/)).toBeTruthy(); expect(screen.getByRole("link", { name: "Baixar XML" }).getAttribute("href")).toContain("/api/fiscal-saida/doc/arquivo?tipo=xml"); expect(screen.queryByRole("button", { name: "Consultar emissor" })).toBeNull();
});
it("conferência somente de prévia não afirma ausência nem duplica o histórico do painel principal", () => {
  const { rerender } = render(<FiscalPedido {...base} somentePrevia documentos={[]} />);
  expect(screen.queryByText("Nenhuma solicitação de saída preparada.")).toBeNull();
  rerender(<FiscalPedido {...base} somentePrevia documentos={[documento]} />);
  expect(screen.queryByText(/Autorizado pelo emissor/)).toBeNull();
  expect(screen.queryByRole("link", { name: "Baixar XML" })).toBeNull();
  expect(screen.getByRole("button", { name: "Calcular prévia fiscal" })).toBeTruthy();
  expect(sim.preparar).not.toHaveBeenCalled(); expect(sim.acao).not.toHaveBeenCalled();
});
it("prévia aponta pendência específica sem preparar ou transmitir o pedido", async () => {
  sim.previa.mockResolvedValue({ ok: true, previa: { apto: false, pendencias: ["Tábua sintética: formulação incompleta"], contexto: { modelo: "65", data: "2026-10-11", ufDestino: "SP" }, regime: "SIMPLES_NACIONAL", perfilId: null, linhas: [], totalMercadorias: "120.00", justificativas: [] } });
  render(<FiscalPedido {...base} />);
  await escolherContextoFiscal();
  const gatilho = screen.getByRole("button", { name: "Calcular prévia fiscal" });
  await userEvent.click(gatilho);
  expect(await screen.findByText("Tábua sintética: formulação incompleta")).toBeTruthy();
  expect(sim.previa).toHaveBeenCalledWith("pedido", 1, { modelo: "65", consumidorFinal: true, indicadorIe: 9, indicadorPresenca: 1 });
  expect(sim.preparar).not.toHaveBeenCalled(); expect(sim.acao).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(gatilho));
});
it("exige dados fiscais da operação e não presume finalidade por identidade do comprador", async () => {
  render(<FiscalPedido {...base} />);
  await userEvent.click(screen.getByRole("button", { name: "Calcular prévia fiscal" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Informe finalidade fiscal");
  expect(sim.previa).not.toHaveBeenCalled(); expect(sim.preparar).not.toHaveBeenCalled();
});
it("modelo 55 não oferece presença exclusiva de NFC-e e revisão nova exige novo contexto", async () => {
  const u = userEvent.setup(); const tela = render(<FiscalPedido {...base} />);
  await escolherContextoFiscal();
  await u.click(screen.getByRole("combobox", { name: "Modelo da prévia fiscal" })); await u.click(await screen.findByRole("option", { name: /^NF-e · modelo 55$/ }));
  await u.click(screen.getByRole("combobox", { name: "Indicador de presença fiscal" }));
  expect(screen.queryByRole("option", { name: "NFC-e com entrega a domicílio · 4" })).toBeNull(); await u.keyboard("{Escape}");
  tela.rerender(<FiscalPedido {...base} versao={2} />);
  await u.click(screen.getByRole("button", { name: "Calcular prévia fiscal" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Informe finalidade fiscal"); expect(sim.previa).not.toHaveBeenCalled();
});
it("impressão HTML da NFC-e e XML do cancelamento têm links e protocolos próprios", () => {
  render(<FiscalPedido {...base} editar={false} configurado documentos={[{ ...documento, status: "CANCELADO", formatoImpressao: "HTML", xmlCancelamentoDisponivel: true, protocoloCancelamento: "90071992547409939999" }]} />);
  expect(screen.getByRole("link", { name: "Baixar impressão NFC-e (HTML)" }).getAttribute("href")).toContain("tipo=html");
  expect(screen.queryByRole("link", { name: "Baixar PDF" })).toBeNull();
  expect(screen.getByRole("link", { name: "Baixar XML do cancelamento" }).getAttribute("href")).toContain("tipo=cancelamento");
  expect(screen.getByText(/Protocolo de cancelamento: 90071992547409939999/)).toBeTruthy();
  expect(sim.acao).not.toHaveBeenCalled();
});
