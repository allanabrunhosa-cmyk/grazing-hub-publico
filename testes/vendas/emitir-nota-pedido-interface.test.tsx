// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ emitir: vi.fn(), consultarPedido: vi.fn(), consultar: vi.fn(), documentos: vi.fn(), cancelar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/emissao-actions", () => ({ emitirNotaPedidoDiretaBrasilNfeAction: sim.emitir, consultarResultadoEmissaoPedidoBrasilNfeAction: sim.consultarPedido, consultarEmissaoPedidoBrasilNfeAction: sim.consultar, obterDocumentosEmissaoPedidoBrasilNfeAction: sim.documentos, cancelarNotaPedidoBrasilNfeAction: sim.cancelar }));
import { EmitirNotaPedido } from "@/app/(protegido)/vendas/pedidos/emitir-nota-pedido";
import { PedidoPopupContext } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
const documento = { id: "documento-sintetico", versaoPedido: 2, modeloDocumento: 65, ambiente: "PRODUCAO", status: "PREPARADO", provedor: "BRASIL_NFE", tentativas: 0, ultimoErro: null as string | null, referenciaProvedor: null, chaveFiscal: null as string | null, numero: null as string | null, serie: null as string | null, protocolo: null as string | null, hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), eventos: [], formatoImpressao: null as "PDF" | "HTML" | null };
const autorizada = { ...documento, status: "AUTORIZADO", tentativas: 1, chaveFiscal: "1".repeat(44), protocolo: "135260000000001", numero: "10", serie: "1", formatoImpressao: "PDF" as const };
const base = { pedidoId: "pedido-sintetico", numeroPedido: 101, versao: 2, confirmado: true, fiscal: { editar: true, documentos: [] } };
beforeEach(() => { vi.resetAllMocks(); sim.emitir.mockResolvedValue({ ok: true, documento: autorizada, conferirAntesDeRepetir: true }); sim.consultar.mockResolvedValue({ ok: true, documento: autorizada }); sim.documentos.mockResolvedValue({ ok: true, documento: autorizada }); sim.consultarPedido.mockResolvedValue({ ok: true, documento: null, conferirAntesDeRepetir: false }); });
afterEach(cleanup);
const clicarEmitir = () => userEvent.click(screen.getByRole("button", { name: /^Emitir NFC?-e$/ }));
it("emite NFC-e no único clique, sem abrir outra tela nem confirmação", async () => {
  render(<EmitirNotaPedido {...base} />);
  expect(screen.getByRole("combobox", { name: "Modelo da nota" }).textContent).toContain("NFC-e (65)");
  expect(sim.emitir).not.toHaveBeenCalled();
  await clicarEmitir();
  expect(sim.emitir).toHaveBeenCalledExactlyOnceWith({ pedidoId: base.pedidoId, versaoPedido: 2, modelo: 65 });
  expect(await screen.findByText("Nota fiscal emitida com sucesso.")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Emitir/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Abrir PDF" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Baixar XML" })).toBeTruthy();
});
it("troca para NF-e por teclado sem emitir e transmite o modelo escolhido no clique", async () => {
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [documento] }} />);
  const seletor = screen.getByRole("combobox", { name: "Modelo da nota" });
  await userEvent.click(seletor); await userEvent.click(await screen.findByRole("option", { name: "NF-e (55)" }));
  expect(sim.emitir).not.toHaveBeenCalled();
  await clicarEmitir();
  expect(sim.emitir).toHaveBeenCalledExactlyOnceWith({ pedidoId: base.pedidoId, versaoPedido: 2, modelo: 55 });
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("impede clique duplicado e bloqueia os controles durante a transmissão", async () => {
  let concluir!: (r: unknown) => void; sim.emitir.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  render(<EmitirNotaPedido {...base} />);
  const botao = screen.getByRole("button", { name: "Emitir NFC-e" });
  await userEvent.dblClick(botao);
  expect(sim.emitir).toHaveBeenCalledTimes(1);
  expect(botao.hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("combobox", { name: "Modelo da nota" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  concluir({ ok: true, documento: autorizada, conferirAntesDeRepetir: true });
  expect(await screen.findByText("Nota fiscal emitida com sucesso.")).toBeTruthy();
});
it.each(["INCERTO", "PENDENTE_CONFERENCIA", "PROCESSANDO", "DENEGADO", "CANCELADO"])("resultado produtivo %s permite consulta e não nova emissão", async status => {
  sim.consultar.mockResolvedValue({ ok: true, documento: { ...documento, status, tentativas: 1 } });
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, status, tentativas: 1 }] }} />);
  if (["DENEGADO", "CANCELADO"].includes(status)) expect(screen.queryByRole("button", { name: /^Emitir/ })).toBeNull();
  else { expect(screen.getByRole("button", { name: /^Emitir/ }).hasAttribute("disabled")).toBe(true); expect(screen.getByRole("combobox", { name: "Modelo da nota" })).toBeTruthy(); }
  await userEvent.click(screen.getByRole("button", { name: "Consultar resultado" }));
  expect(sim.consultar).toHaveBeenCalledExactlyOnceWith(documento.id);
  expect(sim.emitir).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
});
it.each([{ referenciaProvedor: "referencia" }, { chaveFiscal: "1".repeat(44) }, { protocolo: "135260000000001" }])("preserva identidade externa e não oferece nova transmissão (%j)", identidade => {
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, ...identidade }] }} />);
  expect(screen.getByRole("combobox", { name: "Modelo da nota" })).toBeTruthy(); expect(screen.getByRole("button", { name: /^Emitir/ }).hasAttribute("disabled")).toBe(true); expect(sim.emitir).not.toHaveBeenCalled();
});
it("autorização produtiva anterior prevalece sobre preparação de revisão nova", () => {
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, id: "nova" }, { ...autorizada, versaoPedido: 1 }] }} />);
  expect(screen.getByText("Nota fiscal emitida com sucesso.")).toBeTruthy(); expect(screen.queryByRole("button", { name: /^Emitir/ })).toBeNull();
});
it("documento homologado não troca o clique produtivo por nova homologação", async () => {
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...autorizada, ambiente: "HOMOLOGACAO" }] }} />);
  await clicarEmitir(); expect(sim.emitir).toHaveBeenCalledExactlyOnceWith({ pedidoId: base.pedidoId, versaoPedido: 2, modelo: 65 });
});
it("mostra campo e produto faltantes no pedido e permite corrigir sem diálogo", async () => {
  sim.emitir.mockResolvedValue({ erro: "Corrija as pendências abaixo.", conferirAntesDeRepetir: false, pendencias: [{ campo: "Produtos[0].NCM", mensagem: "Produto sintético: informe o NCM de oito dígitos.", href: null }] });
  render(<EmitirNotaPedido {...base} />); await clicarEmitir();
  expect((await screen.findByRole("alert")).textContent).toContain("Produto sintético: informe o NCM de oito dígitos.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Emitir NFC-e" }).hasAttribute("disabled")).toBe(false));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByText("Nota fiscal emitida com sucesso.")).toBeNull();
});
it("mantém rejeição SEFAZ clara e nunca a apresenta como sucesso", async () => {
  sim.emitir.mockResolvedValue({ ok: true, conferirAntesDeRepetir: false, documento: { ...documento, status: "REJEITADO", tentativas: 1, ultimoErro: "SEFAZ 204: Nota duplicada. Consulte a chave já existente." } });
  render(<EmitirNotaPedido {...base} />); await clicarEmitir();
  expect((await screen.findByRole("alert")).textContent).toContain("Nota duplicada");
  expect(screen.queryByText("Nota fiscal emitida com sucesso.")).toBeNull(); expect(screen.getByRole("button", { name: "Emitir NFC-e" })).toBeTruthy();
});
it("resposta perdida exige consultar o pedido antes de permitir tentar novamente", async () => {
  sim.emitir.mockRejectedValue(new Error("rede")); render(<EmitirNotaPedido {...base} />); await clicarEmitir();
  expect((await screen.findByRole("alert")).textContent).toContain("conexão foi interrompida");
  expect(screen.getByRole("button", { name: /^Emitir/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("combobox", { name: "Modelo da nota" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Consultar resultado fiscal" }));
  expect(sim.consultarPedido).toHaveBeenCalledExactlyOnceWith(base.pedidoId);
  expect(await screen.findByRole("button", { name: "Emitir NFC-e" })).toBeTruthy(); expect(sim.emitir).toHaveBeenCalledTimes(1);
});
it("consulta recupera autorização depois da resposta perdida sem reenviar", async () => {
  sim.emitir.mockResolvedValue({ erro: "Resultado não confirmado.", conferirAntesDeRepetir: true, documento: null });
  sim.consultarPedido.mockResolvedValue({ ok: true, documento: autorizada, conferirAntesDeRepetir: true });
  render(<EmitirNotaPedido {...base} />); await clicarEmitir();
  await userEvent.click(await screen.findByRole("button", { name: "Consultar resultado fiscal" }));
  expect(await screen.findByText("Nota fiscal emitida com sucesso.")).toBeTruthy(); expect(sim.emitir).toHaveBeenCalledTimes(1);
});
it("presença faltante é escolhida inline sem inferir um canal", async () => {
  sim.emitir.mockResolvedValueOnce({ erro: "Informe como a venda foi realizada.", exigeEscolhaPresenca: true, conferirAntesDeRepetir: false });
  render(<EmitirNotaPedido {...base} modeloSugerido={55} />); await clicarEmitir();
  const campo = await screen.findByRole("combobox", { name: "Como a venda foi realizada?" });
  expect(screen.getByRole("button", { name: "Emitir NF-e" }).hasAttribute("disabled")).toBe(true);
  await userEvent.click(campo); expect(screen.queryByRole("option", { name: "NFC-e com entrega a domicílio" })).toBeNull();
  await userEvent.click(await screen.findByRole("option", { name: "Não presencial, internet" })); await clicarEmitir();
  expect(sim.emitir).toHaveBeenLastCalledWith({ pedidoId: base.pedidoId, versaoPedido: 2, modelo: 55, indicadorPresenca: 2 }); expect(screen.queryByRole("dialog")).toBeNull();
});
it("não solicita quitação ou declaração extra de cartão na emissão", async () => {
  render(<EmitirNotaPedido {...base} />); await clicarEmitir();
  expect(sim.emitir).toHaveBeenCalledExactlyOnceWith({ pedidoId: base.pedidoId, versaoPedido: 2, modelo: 65 });
  expect(screen.queryByRole("combobox", { name: "Integração do pagamento com cartão" })).toBeNull();
  expect(await screen.findByText("Nota fiscal emitida com sucesso.")).toBeTruthy();
});

it("mantém seletor na incerteza e libera emissão após consultar rejeição com chave sem protocolo", async () => {
  sim.consultar.mockResolvedValue({ ok: true, documento: { ...documento, status: "REJEITADO", tentativas: 1, chaveFiscal: "1".repeat(44), ultimoErro: "Descrição fiscal inválida (xProd)." } });
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, status: "PENDENTE_CONFERENCIA", tentativas: 1 }] }} />);
  expect(screen.getByRole("button", { name: "Emitir NFC-e" }).hasAttribute("disabled")).toBe(true);
  await userEvent.click(screen.getByRole("combobox", { name: "Modelo da nota" }));
  await userEvent.click(await screen.findByRole("option", { name: "NF-e (55)" }));
  expect(sim.emitir).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Consultar resultado" }));
  expect((await screen.findByRole("alert")).textContent).toContain("xProd");
  await waitFor(() => expect(screen.getByRole("button", { name: "Emitir NF-e" }).hasAttribute("disabled")).toBe(false));
  await clicarEmitir(); expect(sim.emitir).toHaveBeenCalledExactlyOnceWith({ pedidoId: base.pedidoId, versaoPedido: 2, modelo: 55 });
});

it.each([{ confirmado: false }, { fiscal: { editar: false, documentos: [] } }])("não oferece emitir sem confirmação ou permissão (%j)", restricao => {
  render(<EmitirNotaPedido {...base} {...restricao} />); expect(screen.queryByRole("button", { name: /^Emitir/ })).toBeNull(); expect(sim.emitir).not.toHaveBeenCalled();
});
it("alteração comercial não salva bloqueia emissão antes da action", async () => {
  render(<PedidoPopupContext.Provider value={{ temAlteracoes: () => true } as never}><EmitirNotaPedido {...base} /></PedidoPopupContext.Provider>); await clicarEmitir();
  expect((await screen.findByRole("alert")).textContent).toContain("Salve ou descarte"); expect(sim.emitir).not.toHaveBeenCalled();
});
it("atalhos respeitam permissões e recusam destinos externos", async () => {
  sim.emitir.mockResolvedValue({ erro: "Pendências fiscais.", conferirAntesDeRepetir: false, pendencias: [{ campo: "token", mensagem: "Configure a integração.", href: "/configuracoes/integracoes/brasilnfe" }, { campo: "csc", mensagem: "Conferir CSC.", href: "https://externo.invalid" }] });
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: {}, excecoes: {} }}><EmitirNotaPedido {...base} /></ProvedorAcesso>); await clicarEmitir();
  expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByRole("link", { name: "Corrigir informação" })).toBeNull();
});
it("exige justificativa e confirmação para cancelar, preserva erro e impede clique duplicado", async () => {
  let concluir!: (r: { erro: string }) => void;
  sim.cancelar.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [autorizada] }} />);
  await userEvent.click(screen.getByRole("button", { name: "Cancelar NF" }));
  const painel = await screen.findByRole("dialog", { name: "Cancelar nota fiscal" });
  const botao = within(painel).getByRole("button", { name: "Confirmar cancelamento da NF" });
  expect(botao.hasAttribute("disabled")).toBe(true);
  await userEvent.type(within(painel).getByRole("textbox", { name: "Justificativa do cancelamento" }), "Pedido duplicado pelo cliente.");
  await userEvent.dblClick(botao);
  expect(sim.cancelar).toHaveBeenCalledExactlyOnceWith({ documentoId: autorizada.id, modelo: 65, ambiente: "PRODUCAO", chaveFiscal: autorizada.chaveFiscal, protocolo: autorizada.protocolo, justificativa: "Pedido duplicado pelo cliente.", confirmarCancelamento: true });
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "Cancelar nota fiscal" })).toBeTruthy();
  concluir({ erro: "Cancelamento rejeitado: prazo legal encerrado. Código 501." });
  expect(await within(painel).findByRole("alert")).toHaveProperty("textContent", "Cancelamento rejeitado: prazo legal encerrado. Código 501.");
  expect(within(painel).getByRole("textbox")).toHaveProperty("value", "Pedido duplicado pelo cliente.");
  expect(sim.emitir).not.toHaveBeenCalled();
});
it("exibe cancelamento confirmado e retira a ação de cancelar", async () => {
  sim.cancelar.mockResolvedValue({ ok: true, documento: { ...autorizada, status: "CANCELADO", protocoloCancelamento: "135260000000002" } });
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [autorizada] }} />);
  await userEvent.click(screen.getByRole("button", { name: "Cancelar NF" }));
  const painel = await screen.findByRole("dialog", { name: "Cancelar nota fiscal" });
  await userEvent.type(within(painel).getByRole("textbox"), "Pedido duplicado pelo cliente.");
  await userEvent.click(within(painel).getByRole("button", { name: "Confirmar cancelamento da NF" }));
  expect(await screen.findByText("Cancelamento da nota fiscal confirmado.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cancelar NF" })).toBeNull();
  expect(screen.getByRole("link", { name: "Baixar XML" })).toBeTruthy();
});
it.each([false, true])("preserva arquivos e exibe recusa ou pendência de cancelamento (%s) no resultado autorizado", async pendente => {
  const erro = pendente ? "Cancelamento não confirmado. Consulte o resultado." : "SEFAZ 501: Prazo de cancelamento superior ao permitido.";
  sim.cancelar.mockResolvedValue({ ok: true, documento: { ...autorizada, cancelamentoSolicitado: true, cancelamentoPendente: pendente, ultimoErro: erro } });
  render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [autorizada] }} />);
  await userEvent.click(screen.getByRole("button", { name: "Cancelar NF" }));
  const painel = await screen.findByRole("dialog", { name: "Cancelar nota fiscal" });
  await userEvent.type(within(painel).getByRole("textbox"), "Pedido duplicado pelo cliente.");
  await userEvent.click(within(painel).getByRole("button", { name: "Confirmar cancelamento da NF" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", erro);
  expect(screen.getByRole("link", { name: "Abrir PDF" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Baixar XML" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cancelar NF" })).toBeNull();
  expect(screen.queryByText("Cancelamento da nota fiscal confirmado.")).toBeNull();
});

it("rejeição com chave permite outra revisão; protocolo impede nova transmissão", async () => {
  const { rerender } = render(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, status: "REJEITADO", tentativas: 1, referenciaProvedor: "referencia-rejeitada" }] }} />);
  expect(screen.getByRole("button", { name: "Emitir NFC-e" })).toBeTruthy();
  rerender(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, status: "REJEITADO", tentativas: 1, chaveFiscal: "1".repeat(44) }] }} />);
  expect(screen.getByRole("button", { name: /^Emitir/ }).hasAttribute("disabled")).toBe(false);
  rerender(<EmitirNotaPedido {...base} fiscal={{ editar: true, documentos: [{ ...documento, status: "REJEITADO", tentativas: 1, chaveFiscal: "1".repeat(44), protocolo: "123456" }] }} />);
  expect(screen.getByRole("button", { name: /^Emitir/ }).hasAttribute("disabled")).toBe(true); expect(sim.emitir).not.toHaveBeenCalled();
});
