// @vitest-environment jsdom
import React, { useContext } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { replace, refresh, executar, segmento } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), executar: vi.fn(), segmento: { valor: null as string | null, caminho: "/vendas/pedidos/pedido-ficticio" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }), useSearchParams: () => new URLSearchParams(), useSelectedLayoutSegment: () => segmento.valor, usePathname: () => segmento.caminho }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ executarOperacaoPedidoAction: executar }));
import { ModalPedido, PedidoPopupContext, navegarComPedidoAberto } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { FiltrosGestaoPedidos } from "@/app/(protegido)/vendas/pedidos/gestao/filtros";
import { OcorrenciasPedido } from "@/app/(protegido)/vendas/pedidos/ocorrencias-pedido";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PopupDiretoPedido, ShellPopupsPedidos } from "@/app/(protegido)/vendas/pedidos/popup-direto";

const retorno = "/vendas/pedidos?busca=ficticio&canalId=site&pagina=3&modo=calendario&data=2026-10-01";
const pedido = { id: "pedido-ficticio", versao: 2, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", previsaoData: "2026-10-01", previsaoJanela: null, historico: [] };
function Controles() {
  const contexto = useContext(PedidoPopupContext)!;
  return <><label>Observação fictícia<input onChange={() => contexto.marcarAlterado()} /></label><button onClick={() => contexto.marcarSalvo()}>Salvar edição fictícia</button><button onClick={() => { contexto.marcarSalvo(); contexto.navegar("/vendas/pedidos/pedido-ficticio"); }}>Abrir detalhe fictício</button><Select defaultValue="a"><SelectTrigger aria-label="Opção fictícia"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">Primeira</SelectItem><SelectItem value="b">Segunda</SelectItem></SelectContent></Select></>;
}
function abrir(children: React.ReactNode = <Controles />) { return render(<ModalPedido titulo="Pedido fictício" descricao="Prévia para teste, sem dados reais." retorno={retorno} protegerAlteracoes>{children}</ModalPedido>); }
beforeEach(() => { vi.clearAllMocks(); segmento.valor = null; segmento.caminho = "/vendas/pedidos/pedido-ficticio"; executar.mockResolvedValue({ erro: "Recusa fictícia do servidor." }); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["Escape", "Fechar", "Fora"])("fecha %s para a mesma visualização, filtros e paginação, sem histórico intermediário", async forma => {
  abrir();
  if (forma === "Escape") fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  else if (forma === "Fechar") fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  else await userEvent.setup().click(document.body);
  await waitFor(() => expect(replace).toHaveBeenCalledWith(retorno, { scroll: false }));
  expect(refresh).not.toHaveBeenCalled();
});
it("clique fora após editar exige escolha no único popup e conserva o retorno", async () => {
  const usuario = userEvent.setup(); abrir();
  await usuario.type(screen.getByLabelText("Observação fictícia"), "Edição pendente");
  await usuario.click(document.body);
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy(); expect(replace).not.toHaveBeenCalled();
  await usuario.click(document.body); await usuario.keyboard("{Escape}");
  expect(screen.queryByText("Sair sem salvar?")).toBeNull(); expect(replace).not.toHaveBeenCalled();
  await usuario.click(document.body);
  await usuario.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Observação fictícia") as HTMLInputElement).value).toBe("Edição pendente");
  await usuario.click(document.body);
  await usuario.click(screen.getByRole("button", { name: "Sair sem salvar" }));
  expect(replace).toHaveBeenCalledExactlyOnceWith(retorno, { scroll: false });
});
it("pede descarte no mesmo diálogo; continuar conserva edição e descarte retorna", async () => {
  abrir(); fireEvent.change(screen.getByLabelText("Observação fictícia"), { target: { value: "Não salva" } });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await screen.findByText("Sair sem salvar?");
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy(); expect(replace).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continuar editando" })));
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Observação fictícia") as HTMLInputElement).value).toBe("Não salva");
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
  expect(replace).toHaveBeenCalledWith(retorno, { scroll: false });
});
it("salvar a edição limpa sua proteção e Novo → detalhe leva o retorno completo", () => {
  abrir(); fireEvent.change(screen.getByLabelText("Observação fictícia"), { target: { value: "Salva" } });
  fireEvent.click(screen.getByRole("button", { name: "Abrir detalhe fictício" }));
  const url = new URL(replace.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
  expect(url.pathname).toBe("/vendas/pedidos/pedido-ficticio"); expect(url.searchParams.get("retorno")).toBe(retorno);
  expect(replace.mock.calls[0][1]).toEqual({ scroll: false });
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.queryByText("Sair sem salvar?")).toBeNull();
});
it("Escape da opção aninhada fecha somente o seletor, mantendo popup e retorno", async () => {
  const usuario = userEvent.setup(); abrir();
  await usuario.click(screen.getByRole("combobox", { name: "Opção fictícia" }));
  await screen.findByRole("option", { name: "Segunda" });
  await usuario.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeTruthy(); expect(replace).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("option", { name: "Segunda" })).toBeNull());
});
it("filtrar gestão mantém popup e retorno sem manter página antiga ou campos vazios", () => {
  render(<FiltrosGestaoPedidos retorno={retorno}><input aria-label="Cliente fictício" name="clienteId" defaultValue="cliente-ficticio" /><input name="busca" defaultValue="" /><button>Aplicar</button></FiltrosGestaoPedidos>);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  const url = new URL(replace.mock.calls[0][0], "https://pedidos.grazinghub.com.br");
  expect(url.pathname).toBe("/vendas/pedidos/gestao"); expect(url.searchParams.get("clienteId")).toBe("cliente-ficticio");
  expect(url.searchParams.has("pagina")).toBe(false); expect(url.searchParams.has("busca")).toBe(false); expect(url.searchParams.get("retorno")).toBe(retorno);
});
it("ocorrências em leitura não oferecem mutações nem controles de preparação", () => {
  render(<OcorrenciasPedido pedido={pedido} editar={false} />);
  expect(screen.getByRole("heading", { name: "Entrega e devoluções" })).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByLabelText(/Quantidade/)).toBeNull(); expect(executar).not.toHaveBeenCalled();
});
it("recusa de ocorrência conserva motivo, erro e chave de repetição, sem refresh", async () => {
  abrir(<OcorrenciasPedido pedido={pedido} editar />);
  fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência fictícia" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
  await screen.findByText("Recusa fictícia do servidor.");
  expect((screen.getByLabelText("Motivo / descrição") as HTMLInputElement).value).toBe("Ocorrência fictícia");
  await waitFor(() => expect((screen.getByRole("button", { name: "Registrar ocorrência" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
  await waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
  expect(executar.mock.calls[0]).toEqual([pedido.id, 2, { tipo: "OCORRENCIA", motivo: "Ocorrência fictícia" }, expect.any(String)]);
  expect(executar.mock.calls[0][3]).toBe(executar.mock.calls[1][3]); expect(refresh).not.toHaveBeenCalled();
});
it("edição comercial pendente impede ocorrência que atualizaria o detalhe", () => {
  abrir(<><Controles /><OcorrenciasPedido pedido={pedido} editar /></>);
  fireEvent.change(screen.getByLabelText("Observação fictícia"), { target: { value: "Comercial pendente" } });
  fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência fictícia" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
  expect(screen.getByRole("alert").textContent).toContain("alterações comerciais"); expect(executar).not.toHaveBeenCalled();
});
it("salvar um registro não descarta alterações do outro formulário", () => {
  abrir(<><Controles /><OcorrenciasPedido pedido={pedido} editar /></>);
  fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência pendente" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar edição fictícia" }));
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.getByText("Sair sem salvar?")).toBeTruthy(); expect(replace).not.toHaveBeenCalled();
});
it("atualização comercial ou financeira conserva rascunho de ocorrência com chave da nova versão", async () => {
  const { rerender } = abrir(<OcorrenciasPedido pedido={pedido} editar />);
  fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência não salva" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
  await screen.findByText("Recusa fictícia do servidor.");
  const chaveAnterior = executar.mock.calls[0][3];
  rerender(<ModalPedido titulo="Pedido fictício" descricao="Prévia para teste, sem dados reais." retorno={retorno} protegerAlteracoes><OcorrenciasPedido pedido={{ ...pedido, versao: 3, previsaoData: "2026-10-03" }} editar /></ModalPedido>);
  expect((screen.getByLabelText("Motivo / descrição") as HTMLInputElement).value).toBe("Ocorrência não salva");
  expect(screen.queryByLabelText("Nova data")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
  await waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
  expect(executar.mock.calls[1][1]).toBe(3);
  expect(executar.mock.calls[1][3]).not.toBe(chaveAnterior);
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
});
it("trava clique duplicado até a ocorrência retornar e sucesso limpa seu formulário", async () => {
  let concluir!: (r: { ok: true }) => void;
  executar.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
  abrir(<OcorrenciasPedido pedido={pedido} editar />);
  fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência fictícia" } });
  const botao = screen.getByRole("button", { name: "Registrar ocorrência" });
  fireEvent.click(botao); fireEvent.click(botao); expect(executar).toHaveBeenCalledTimes(1);
  concluir({ ok: true }); await screen.findByText("Registro salvo.");
  expect(refresh).toHaveBeenCalledTimes(1); expect((screen.getByLabelText("Motivo / descrição") as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Fechar" })); expect(screen.queryByText("Sair sem salvar?")).toBeNull();
});
it("slot interceptado oculta só o popup direto e mantém Gestor ao fundo", () => {
  const elementos = (modal: React.ReactNode) => <ShellPopupsPedidos modal={modal}><p>Gestor ao fundo</p><PopupDiretoPedido><ModalPedido titulo="Popup direto" descricao="Fictício" retorno={retorno}><p>Conteúdo direto</p></ModalPedido></PopupDiretoPedido></ShellPopupsPedidos>;
  const { rerender } = render(elementos(null)); expect(screen.getByRole("dialog", { name: "Popup direto" })).toBeTruthy();
  segmento.valor = "pedido-ficticio";
  rerender(elementos(<ModalPedido titulo="Popup interceptado" descricao="Fictício" retorno={retorno}><p>Conteúdo interceptado</p></ModalPedido>));
  expect(screen.getAllByRole("dialog")).toHaveLength(1); expect(screen.queryByText("Conteúdo direto")).toBeNull();
  expect(screen.getByText("Gestor ao fundo")).toBeTruthy();
});
it("registrar ocorrência não marca como salvo outro formulário que ainda não foi enviado", async () => {
  executar.mockResolvedValue({ ok: true }); abrir(<><Controles /><OcorrenciasPedido pedido={pedido} editar /></>);
  fireEvent.change(screen.getByLabelText("Observação fictícia"), { target: { value: "Alteração pendente" } });
  fireEvent.change(screen.getByLabelText("Motivo / descrição"), { target: { value: "Ocorrência fictícia" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
  expect(screen.getByRole("alert").textContent).toContain("alterações comerciais");
  expect(executar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Fechar" })); expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
});

it("retorno à lista remove popup retido no slot e reabertura volta ao detalhe", () => {
  segmento.valor = "pedido-ficticio";
  const tree = () => <ShellPopupsPedidos modal={<p>Modal retido</p>}><p>Lista preservada</p><PopupDiretoPedido><p>Popup direto retido</p></PopupDiretoPedido></ShellPopupsPedidos>;
  const { rerender } = render(tree()); expect(screen.getByText("Modal retido")).toBeTruthy();
  segmento.caminho = "/vendas/pedidos"; rerender(tree());
  expect(screen.queryByText("Modal retido")).toBeNull(); expect(screen.queryByText("Popup direto retido")).toBeNull(); expect(screen.getByText("Lista preservada")).toBeTruthy();
  segmento.caminho = "/vendas/pedidos/pedido-ficticio"; rerender(tree()); expect(screen.getByText("Modal retido")).toBeTruthy();
});
it("painel desktop mantém fundo interativo e protege troca de pedido com descarte oficial", async () => {
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: media === "(min-width: 1280px)", onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  const destino = "/vendas/pedidos/outro-ficticio?retorno=%2Fvendas%2Fpedidos";
  const usuario = userEvent.setup();
  const tela = render(<><button onClick={() => navegarComPedidoAberto(destino)}>Abrir outro pedido</button><ModalPedido detalhe titulo="Painel fictício" descricao="Dados sintéticos." retorno={retorno} protegerAlteracoes><Controles /></ModalPedido></>);
  const painel = screen.getByRole("dialog", { name: "Painel fictício" });
  expect(painel.getAttribute("data-pedido-painel")).toBe("detalhe");
  expect(painel.getAttribute("aria-modal")).not.toBe("true");
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
  fireEvent.change(screen.getByLabelText("Observação fictícia"), { target: { value: "Pendente" } });
  await usuario.click(screen.getByRole("button", { name: "Abrir outro pedido" }));
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Observação fictícia") as HTMLInputElement).value).toBe("Pendente");
  await usuario.click(screen.getByRole("button", { name: "Abrir outro pedido" }));
  await usuario.click(screen.getByRole("button", { name: "Sair sem salvar" }));
  expect(replace).toHaveBeenCalledExactlyOnceWith(destino, { scroll: false });
  tela.unmount();
  expect(navegarComPedidoAberto(destino)).toBe(false);
});
it("painel móvel usa modalidade e mantém proteção explícita de fechamento", () => {
  render(<ModalPedido detalhe titulo="Painel móvel fictício" descricao="Dados sintéticos." retorno={retorno} protegerAlteracoes><Controles /></ModalPedido>);
  const painel = screen.getByRole("dialog", { name: "Painel móvel fictício" });
  expect(painel.getAttribute("data-dialog-variant")).toBe("painel-direito");
  expect(painel.getAttribute("aria-modal")).toBe("true");
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Observação fictícia"), { target: { value: "Pendente" } });
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});
