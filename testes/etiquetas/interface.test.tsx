// @vitest-environment jsdom
import React, { type ComponentProps, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponsavelEtiqueta } from "@/app/(protegido)/producao/etiquetas/responsavel-etiqueta";
import { EtiquetasClient } from "@/app/(protegido)/producao/etiquetas/etiquetas-client";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { ConteudoMenuEtiquetas } from "@/components/layout/menu-etiquetas";
import { NavLink } from "@/components/layout/nav-link";
import { LogoEtiquetas } from "@/components/logo-etiquetas";
import { PainelValidades } from "@/app/(protegido)/producao/etiquetas/gestao-validades";
import { salvarConfiguracaoImpressoraAction } from "@/app/(protegido)/producao/etiquetas/actions";
import { PainelPontosImpressao } from "@/app/(protegido)/producao/etiquetas/pontos-impressao";

const navegacao = vi.hoisted(() => ({ busca: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(navegacao.busca), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/app/login/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/app/(protegido)/producao/etiquetas/actions", () => ({
  prepararEtiquetaAction: vi.fn(), confirmarImpressaoEtiquetaAction: vi.fn(), finalizarTentativaEtiquetaAction: vi.fn(),
  iniciarEnvioEtiquetaAction: vi.fn(), registrarExportacaoEtiquetaAction: vi.fn(), salvarConfiguracaoImpressoraAction: vi.fn(), salvarConfiguracaoProdutoEtiquetaAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/producao/etiquetas/pontos-actions", () => ({
  criarPontoImpressaoAction: vi.fn(), atualizarPontoImpressaoAction: vi.fn(), emitirCodigoPontoAction: vi.fn(),
  imprimirTestePontoAction: vi.fn(), revogarPontoAction: vi.fn(), selecionarImpressoraPontoAction: vi.fn(),
  enfileirarPontoAction: vi.fn(), solicitarMudancaWifiPontoAction: vi.fn(),
  confirmarSaidaFisicaPontoAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/producao/etiquetas/operacao-actions", () => ({ excluirPontoImpressaoAction: vi.fn(), restaurarPontoImpressaoAction: vi.fn(), baixarEtiquetaAction: vi.fn(), configurarUsuarioResponsavelAction: vi.fn(), salvarResponsavelEtiquetaAction: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
afterEach(() => { cleanup(); navegacao.busca = ""; });

it("mostra comunicação e impressora separadamente, sem senha Wi-Fi na consulta", async () => {
  const usuario = userEvent.setup();
  render(<PainelPontosImpressao pontos={[{
    id: "ponto-ficticio", nome: "Cozinha", icone: "cozinha", ativo: true, padrao: true,
    situacao: "RECENTE", vistoEm: "2026-09-24T12:00:00.000Z", impressoraDetectada: false,
    impressoraSelecionadaId: null, impressoras: [], wifiSsid: "Rede fictícia", wifiFrequenciaMhz: 2412,
    wifiEndereco: "192.0.2.2", ethernetEndereco: null, wifiRedes: [{ ssid: "Rede fictícia", frequenciaMhz: 2412 }],
    wifiMudancaEstado: null, hostname: "raspberry-ficticia", modelo: "Pi 3 B", pendentes: 1, incertos: 0,
  }]} />);
  expect(screen.getByText(/Comunicação recente/)).toBeDefined();
  expect(screen.getByText(/não detectada ou não selecionada/)).toBeDefined();
  await usuario.click(screen.getByText("Cozinha · padrão"));
  await usuario.click(screen.getByText("Mudar Wi-Fi futuramente"));
  expect(screen.getByLabelText("Senha da nova rede").getAttribute("type")).toBe("password");
  expect(screen.getByText(/Se o equipamento não estiver comunicando/)).toBeDefined();
});

function ResponsavelTeste() {
  const [valor, setValor] = useState({ id: "", nome: "" });
  return <><ResponsavelEtiqueta opcoes={[{ id: "ana", nome: "Ana Cláudia" }, { id: "joao", nome: "João Silva" }]} usuarioId={valor.id} nome={valor.nome} onChange={(id, nome) => setValor({ id, nome })} /><output>{JSON.stringify(valor)}</output></>;
}

it("abas compartilhadas alternam por teclado e identificam o painel", async () => {
  const usuario = userEvent.setup();
  render(<EtiquetasClient produtos={[]} historico={[]} admin={false} responsaveis={[]} caminhoBase="/" loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null} paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} abaInicial="imprimir" />);
  screen.getByRole("tab", { name: "Imprimir" }).focus();
  await usuario.keyboard("{ArrowRight}{Enter}");
  expect(screen.getByRole("tab", { name: "Histórico" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel", { name: "Histórico" }).textContent).toContain("Nenhum trabalho");
});

it("filtros de validade têm rótulos, expansão e período personalizado", async () => {
  const usuario = userEvent.setup();
  render(<PainelValidades caminhoBase="/" dados={{ agora: "2026-09-22T12:00:00Z", filtro: "todas", pagina: 1, porPagina: 25, total: 0, vencidas: 0, proximas: 0, vigentes: 0, itens: [] }} />);
  await usuario.click(screen.getByRole("button", { name: "Filtros" }));
  expect(screen.getByRole("button", { name: "Filtros" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("combobox", { name: "Período" }).textContent).toContain("Todos");
  await usuario.click(screen.getByRole("combobox", { name: "Período" }));
  await usuario.click(await screen.findByRole("option", { name: "Personalizado (0)" }));
  expect(screen.getByLabelText("De")).toBeDefined();
  expect(screen.getByLabelText("Até")).toBeDefined();
  expect(screen.getByRole("combobox", { name: "Conservação" }).getAttribute("data-slot")).toBe("select-trigger");
  expect(screen.getByLabelText("Status da impressão")).toBeDefined();
});

it("pesquisa nomes sem acento, seleciona o cadastro e oferece exceção explícita", async () => {
  const usuario = userEvent.setup();
  render(<ResponsavelTeste />);
  await usuario.type(screen.getByRole("combobox", { name: "Responsável pela manipulação" }), "claudia");
  await usuario.click(await screen.findByRole("option", { name: "Ana Cláudia" }));
  expect(screen.getByRole("status").textContent).toBe('{"id":"ana","nome":"Ana Cláudia"}');
  await usuario.click(screen.getByRole("checkbox", { name: /Informar outro nome/ }));
  await usuario.type(screen.getByRole("textbox", { name: "Responsável pela manipulação" }), "Pessoa sem conta");
  expect(screen.getByRole("status").textContent).toBe('{"id":"","nome":"Pessoa sem conta"}');
});

it("cabeçalho dedicado oferece navegação móvel própria, sem configurações gerais", async () => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><CabecalhoConteudo dedicado sessao={{ nome: "Operador" }} /></ProvedorAcesso>);
  expect(screen.getByText("Grazing HUB · Validades")).toBeDefined();
  expect(screen.getByRole("button", { name: "Abrir navegação" })).toBeDefined();
  screen.getByRole("button", { name: "Abrir menu da conta" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await waitFor(() => expect(screen.getByRole("menuitem", { name: /Sair/ })).toBeDefined());
  expect(screen.queryByRole("menuitem", { name: "Configurações" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Meu Perfil" })).toBeNull();
});

it("leitor consulta sem controles de emissão habilitados e sem aba de configuração", async () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { producao: ["visualizar"] }, excecoes: {} }}><EtiquetasClient
    produtos={[]} historico={[]} admin={false} responsaveis={[]} caminhoBase="/"
    loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null}
    paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} abaInicial="imprimir" />
  </ProvedorAcesso>);
  expect(screen.queryByRole("tab", { name: "Configurar" })).toBeNull();
  expect(screen.getByRole("group", { name: "Emissão de etiquetas" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("Seu acesso permite consulta");
});

it("paginação permanece na raiz da experiência dedicada", () => {
  render(<EtiquetasClient produtos={[]} historico={[]} admin={false} responsaveis={[]} caminhoBase="/"
    loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null}
    paginaHistorico={{ pagina: 2, porPagina: 25, total: 60 }} abaInicial="historico" />);
  expect(screen.getByRole("link", { name: "Anterior" }).getAttribute("href")).toBe("/?pagina=1");
  expect(screen.getByRole("link", { name: "Próxima" }).getAttribute("href")).toBe("/?pagina=3");
});

it("guia o operador por responsável, grupo, produto, conservação e revisão", async () => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { producao: ["visualizar", "adicionar"] }, excecoes: {} }}><EtiquetasClient
    produtos={[{
      id: "tomate", nome: "Tomate seco", especificacao: "Caixa de compra fictícia 12,5 kg", marcasFornecedor: ["Aurora"], tipo: "INSUMO", unidade: "kg", categoria: "Antepastos", ativo: true,
      etiquetaHabilitada: true, validadeSecoDias: null, validadeRefrigeradoDias: 5,
      validadeCongeladoDias: 30, validadeAposAbertoDias: 3, conservacaoEtiquetaPadrao: "REFRIGERADO",
      versaoConfiguracaoEtiqueta: 1,
    }]}
    historico={[]} admin={false} responsaveis={[{ id: "ana", nome: "Ana" }]} caminhoBase="/"
    loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null}
    paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} abaInicial="imprimir" />
  </ProvedorAcesso>);
  expect(screen.getByRole("region", { name: "Etapas da emissão" }).textContent).toContain("Responsável");
  await usuario.click(screen.getByRole("button", { name: /Ana/ }));
  await usuario.click(screen.getByRole("button", { name: /Antepastos/ }));
  expect(screen.queryByText("Caixa de compra fictícia 12,5 kg")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: /Tomate seco/ }));
  expect(screen.queryByRole("button", { name: /Estoque seco/ })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: /Refrigerado/ }));
  expect(screen.getByText("Tomate seco")).toBeDefined();
  expect(screen.queryByText("Caixa de compra fictícia 12,5 kg")).toBeNull();
  expect(screen.getByText(/Ana · Refrigerado/)).toBeDefined();
  expect(screen.getByRole("button", { name: "Imprimir" })).toBeDefined();
  expect(screen.queryByRole("button", { name: /Preparar etiqueta/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Baixar ZPL/ })).toBeNull();
  expect(screen.getByLabelText("Medida")).toBeDefined();
  expect(screen.getByLabelText("Validade original")).toBeDefined();
  expect(screen.getByLabelText("Marca/fornecedor").getAttribute("value")).toBe("Aurora");
  const marca = screen.getByRole("combobox", { name: "Marca/fornecedor" });
  await usuario.click(marca);
  await usuario.click(await screen.findByRole("option", { name: "Aurora" }));
  await usuario.clear(marca);
  await usuario.type(marca, "Marca livre");
  expect(marca).toHaveProperty("value", "Marca livre");
  await usuario.keyboard("{Escape}");
  expect(marca).toHaveProperty("value", "Marca livre");
  expect(marca.getAttribute("maxlength")).toBe("60");
  await usuario.tab();
  expect(marca).toHaveProperty("value", "Marca livre");
  expect(screen.getByLabelText("SIF")).toBeDefined();
  expect(screen.getByLabelText("Lote")).toBeDefined();
  expect(screen.getByRole("img", { name: "Prévia de etiqueta 60 por 60 milímetros" })).toBeDefined();
  expect(screen.queryByText("Dados da manipulação")).toBeNull();
});

it("menu dedicado oferece as três áreas ao administrador e oculta configurações do leitor", () => {
  const { rerender } = render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><ConteudoMenuEtiquetas /></ProvedorAcesso>);
  expect(screen.getAllByRole("link").map((item) => item.textContent)).toEqual(["Imprimir etiquetas", "Gestão de validades", "Configurações"]);
  expect(screen.getByRole("img", { name: "Grazing Validades" })).toBeDefined();
  expect(screen.getByText("Grazing Validades")).toBeDefined();
  expect(screen.getByText("by Grazing Table & Co")).toBeDefined();
  rerender(<ProvedorAcesso acesso={{ admin: false, permissoes: { producao: ["visualizar"] }, excecoes: {} }}><ConteudoMenuEtiquetas /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: "Configurações" })).toBeNull();
  expect(screen.getByRole("link", { name: "Gestão de validades" })).toBeDefined();
});

it.each([["", "Imprimir etiquetas"], ["secao=validades", "Gestão de validades"], ["secao=configuracoes", "Configurações"]])("usa o link do HUB e destaca somente a seção %s", (busca, nome) => {
  navegacao.busca = busca;
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><ConteudoMenuEtiquetas /></ProvedorAcesso>);
  const links = screen.getAllByRole("link");
  expect(links.filter(link => link.getAttribute("aria-current") === "page").map(link => link.textContent)).toEqual([nome]);
  const { container } = render(<NavLink href="/" ativo>Referência HUB</NavLink>);
  expect(screen.getByRole("link", { name: nome }).className).toBe(container.querySelector("a")?.className);
});

it("usa a composição horizontal da identidade do portal", () => {
  const { container } = render(<LogoEtiquetas />);
  expect(screen.getByRole("img", { name: "Grazing Validades" })).toBeDefined();
  expect(container.querySelector("text")?.textContent).toBe("GV");
  expect(screen.getByText("Grazing Validades")).toBeDefined();
  expect(screen.getByText("by Grazing Table & Co")).toBeDefined();
  expect(container.querySelector(".logo-etiquetas-negativo")).toBeNull();
});

it("configura validade pelo nome sem exibir ou pesquisar a especificação de compra", async () => {
  const usuario = userEvent.setup();
  render(<EtiquetasClient dedicado secao="validades" mostrarPrazos abaInicial="imprimir" produtos={[{
    id: "damasco", nome: "Damasco turco seco", especificacao: "Caixa fictícia de 12,5 kg", tipo: "INSUMO", unidade: "kg", categoria: "Frutas", ativo: true,
    etiquetaHabilitada: true, validadeSecoDias: null, validadeRefrigeradoDias: 5, validadeCongeladoDias: 30, validadeAposAbertoDias: 3,
    conservacaoEtiquetaPadrao: "REFRIGERADO", versaoConfiguracaoEtiqueta: 1,
  }]} historico={[]} admin responsaveis={[]} caminhoBase="/" loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null} paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} />);
  expect(screen.getByText("Damasco turco seco")).toBeDefined();
  expect(screen.queryByText("Caixa fictícia de 12,5 kg")).toBeNull();
  const busca = screen.getByPlaceholderText("Buscar insumo ou preparação");
  await usuario.type(busca, "Caixa fictícia");
  expect(screen.queryByText("Damasco turco seco")).toBeNull();
  await usuario.clear(busca);
  await usuario.type(busca, "Damasco");
  expect(screen.getByText("Damasco turco seco")).toBeDefined();
});

it("prepara os campos Raspberry no perfil sem declarar conexão ou imprimir", async () => {
  const usuario = userEvent.setup();
  vi.mocked(salvarConfiguracaoImpressoraAction).mockResolvedValue({ ok: true, perfilId: "p" });
  render(<EtiquetasClient dedicado secao="configuracoes" produtos={[]} historico={[]} admin responsaveis={[]} caminhoBase="/" loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null} paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} abaInicial="imprimir" />);
  await usuario.click(screen.getByRole("tab", { name: "Perfil da impressora" }));
  await usuario.click(screen.getByRole("checkbox", { name: "Manter anotações de estação Raspberry no perfil" }));
  await usuario.type(screen.getByLabelText("Nome da estação"), "Cozinha");
  await usuario.type(screen.getByLabelText("Identificação da fila"), "zebra_cozinha");
  await usuario.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(salvarConfiguracaoImpressoraAction).toHaveBeenCalledWith(expect.objectContaining({ planejamentoRaspberry: { estacao: "Cozinha", fila: "zebra_cozinha", conexao: "USB" } }));
  expect(screen.getByText("Gerenciar por ponto")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Enviar ao dispositivo" })).toBeNull();
});

it("acesso direto à seção de configuração não oferece formulário ao leitor", () => {
  render(<EtiquetasClient dedicado secao="configuracoes" produtos={[]} historico={[]} admin={false} responsaveis={[]} caminhoBase="/" loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10 }} perfil={null} paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} abaInicial="imprimir" />);
  expect(screen.getByRole("status").textContent).toContain("administrador ativo");
  expect(screen.queryByRole("button", { name: "Salvar perfil" })).toBeNull();
});
