// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { CentralDesign } from "@/components/design-system/central-design";
import { DemonstracaoPadrao } from "@/components/design-system/demonstracao-padrao";
import { buscarPadroes } from "@/lib/design-system/grupos";
import { configuracaoPreviaValida } from "@/lib/design-system/previa";
import { VALORES_FABRICA } from "@/lib/design-system/registro";
import type { DadosCentralDesign } from "@/lib/design-system/tipos";

const acoes = vi.hoisted(() => ({ salvar: vi.fn(), publicar: vi.fn(), restaurar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/configuracoes/design/actions", () => ({ salvarRascunhoDesignAction: acoes.salvar, publicarRascunhoDesignAction: acoes.publicar, restaurarVersaoDesignAction: acoes.restaurar }));
const dados = { revisaoPublicada: 0, publicada: null, rascunho: null, versoes: [], eventos: [] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("mantém histórico e auditoria idênticos no servidor UTC e no navegador da loja", () => {
  const instante = "2026-10-03T01:30:00.000Z";
  const historico: DadosCentralDesign = {
    ...dados,
    versoes: [{ id: "versao-sintetica", numero: 1, tipo: "PUBLICACAO", motivo: "Exemplo sintético", autor: "Administrador sintético", valores: VALORES_FABRICA, versaoOrigemNumero: null, criadaEm: instante }],
    eventos: [{ id: "evento-sintetico", acao: "PUBLICADO", autor: "Administrador sintético", criadoEm: instante }],
  };
  // Simula os fusos dos ambientes sem depender do fuso do executor dos testes.
  const formatar = Date.prototype.toLocaleString;
  let fusoAmbiente = "UTC";
  const formato = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (this: Date, locales, options) {
    return formatar.call(this, locales, { timeZone: fusoAmbiente, ...options });
  });
  try {
    const servidor = renderToString(<CentralDesign dados={historico} />);
    fusoAmbiente = "America/Sao_Paulo";
    const navegador = renderToString(<CentralDesign dados={historico} />);
    expect(servidor === navegador).toBe(true);
    expect(servidor.match(/02\/10\/2026, 22:30:00/g)).toHaveLength(2);
  } finally { formato.mockRestore(); }
});

it("inicia em status, pesquisa por intenção e não chama ações pela prévia", async () => {
  render(<CentralDesign dados={dados} />);
  expect(screen.getByRole("heading", { name: "Ativar e inativar" })).toBeTruthy();
  const usuario = userEvent.setup(); await usuario.type(screen.getByRole("textbox", { name: "Buscar padrão de design" }), "lápis");
  expect(screen.getByRole("heading", { name: "Botões" })).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Aplicado na tela" }));
  await usuario.click(screen.getByRole("button", { name: "Reiniciar exemplo" }));
  for (const acao of Object.values(acoes)) expect(acao).not.toHaveBeenCalled();
});
it("envia apenas contrato fechado ao iframe e preserva tema do editor", async () => {
  render(<CentralDesign dados={dados} />);
  const quadro = screen.getByTitle("Experimento isolado") as HTMLIFrameElement;
  const enviar = vi.spyOn(quadro.contentWindow!, "postMessage");
  fireEvent.load(quadro);
  expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ padrao: "status-ativo", identidade: "hub" }), window.location.origin);
  await userEvent.click(screen.getByRole("combobox", { name: "Identidade" }));
  await userEvent.click(await screen.findByRole("option", { name: "Validades" }));
  expect(enviar).toHaveBeenLastCalledWith(expect.objectContaining({ identidade: "etiquetas" }), window.location.origin);
  expect(document.body.dataset.identidade).not.toBe("etiquetas");
  await userEvent.click(screen.getByRole("combobox", { name: "Identidade" }));
  await userEvent.click(await screen.findByRole("option", { name: "Pedidos" }));
  expect(enviar).toHaveBeenLastCalledWith(expect.objectContaining({ identidade: "pedidos" }), window.location.origin);
  expect(document.body.dataset.identidade).not.toBe("pedidos");
});
it("mantém versão, pendências e comparação no cabeçalho", async () => {
  const { container } = render(<CentralDesign dados={{ ...dados, rascunho: { valores: { "acao.tamanho": "2.5rem" }, revisao: 1, versaoBase: 0, autor: "Administrador sintético", atualizadoEm: "2026-09-23T00:00:00.000Z" } }} />);
  const cabecalho = container.querySelector("header")!;
  expect(cabecalho.textContent).toContain("Valores de fábrica");
  expect(cabecalho.textContent).toContain("ajustes pendentes");
  const botao = screen.getByRole("button", { name: "Comparar com publicado" });
  expect(cabecalho.contains(botao)).toBe(true);
  await userEvent.click(botao);
  expect(screen.getByTitle("Padrão publicado")).toBeTruthy();
  expect(acoes.publicar).not.toHaveBeenCalled();
});
it("rejeita mensagem fora do catálogo, estado ou tokens", () => {
  const valido = { canal: "grazing-design-lab", tipo: "configurar", padrao: "status-ativo", identidade: "hub", modo: "claro", estado: "normal", aplicado: false, reinicio: 0, valores: VALORES_FABRICA };
  expect(configuracaoPreviaValida(valido)).toBe(true);
  for (const invalido of [{ padrao: "livre" }, { estado: "executar" }, { reinicio: -1 }, { valores: { css: "script" } }]) expect(configuracaoPreviaValida({ ...valido, ...invalido })).toBe(false);
});

it("localiza o padrão de contagens em revisão e o envia à prévia isolada", async () => {
  expect(buscarPadroes("contagem")).toContainEqual(expect.objectContaining({ id: "filtros-contados", componente: "filtros-contados", situacao: "Em revisão", consumidores: ["Clientes", "Insumos", "Posição de estoque", "Gestor de pedidos"] }));
  render(<CentralDesign dados={dados} />);
  const quadro = screen.getByTitle("Experimento isolado") as HTMLIFrameElement;
  const enviar = vi.spyOn(quadro.contentWindow!, "postMessage");
  await userEvent.type(screen.getByRole("textbox", { name: "Buscar padrão de design" }), "contagem");
  expect(screen.getByRole("heading", { name: "Filtros com contagem" })).toBeTruthy();
  expect(enviar).toHaveBeenLastCalledWith(expect.objectContaining({ padrao: "filtros-contados" }), window.location.origin);
  expect(configuracaoPreviaValida(enviar.mock.lastCall?.[0])).toBe(true);
  for (const acao of Object.values(acoes)) expect(acao).not.toHaveBeenCalled();
});

it("demonstra contagens de PF/PJ estáveis ao selecionar tipo e atualizadas pela busca", async () => {
  const { rerender } = render(<DemonstracaoPadrao componente="filtros-contados" estado="normal" aplicado={false} />);
  const usuario = userEvent.setup();
  expect(screen.getByRole("button", { name: "Todos (3)", pressed: true })).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Pessoa jurídica (1)" }));
  expect(screen.getByRole("button", { name: "Pessoa física (2)" })).toBeTruthy();
  expect(screen.queryByText("Pessoa fictícia", { exact: true })).toBeNull();
  expect(screen.getByText("Empresa fictícia", { exact: true })).toBeTruthy();
  await usuario.type(screen.getByRole("textbox", { name: "Buscar cliente do exemplo" }), "Pessoa");
  expect(screen.getByRole("button", { name: "Todos (2)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pessoa jurídica (0)", pressed: true })).toHaveProperty("disabled", false);
  expect(screen.getByRole("status").textContent).toBe("Nenhum cliente encontrado no exemplo.");
  await usuario.click(screen.getByRole("button", { name: "Pessoa física (2)" }));
  expect(screen.getByText("Pessoa fictícia", { exact: true })).toBeTruthy();
  rerender(<DemonstracaoPadrao componente="filtros-contados" estado="vazio" aplicado={false} />);
  expect(screen.getByRole("button", { name: "Todos (0)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pessoa física (0)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pessoa jurídica (0)" })).toBeTruthy();
});
