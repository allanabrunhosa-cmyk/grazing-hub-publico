// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { ConteudoMenuPedidos } from "@/components/layout/menu-pedidos";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { HOST_PEDIDOS, CAMINHO_PEDIDOS } from "@/lib/hosts";

const estado = vi.hoisted(() => ({ pathname: "/vendas" }));
vi.mock("next/navigation", () => ({ usePathname: () => estado.pathname }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={evento => evento.preventDefault()} /> }));
vi.mock("@/app/login/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
afterEach(() => { cleanup(); estado.pathname = "/vendas"; });
const acesso = { admin: true, permissoes: {}, excecoes: {} };

it("HUB oferece somente o atalho externo de pedidos", () => {
  render(<ProvedorAcesso acesso={acesso}><ConteudoMenuLateral /></ProvedorAcesso>);
  const atalho = screen.getByRole("link", { name: "Gestor de pedidos" });
  expect(atalho.getAttribute("href")).toBe(`https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}`);
  expect(atalho.getAttribute("target")).toBe("_blank");
  expect(atalho.getAttribute("rel")).toBe("noreferrer");
  expect(screen.queryByRole("link", { name: "Produção de pedidos" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Calendário de pedidos" })).toBeNull();
});

it("menu dedicado reutiliza marca e navegação sem oferecer módulos externos", () => {
  estado.pathname = CAMINHO_PEDIDOS;
  render(<ProvedorAcesso acesso={acesso}><ConteudoMenuPedidos /></ProvedorAcesso>);
  expect(screen.getByRole("img", { name: "Grazing Pedidos" })).toBeDefined();
  expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([CAMINHO_PEDIDOS]);
  expect(screen.getByRole("link", { name: "Gestor de pedidos" }).getAttribute("aria-current")).toBe("page");
});

it("menu dedicado respeita ausência de permissão de Pedidos", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: {}, excecoes: {} }}><ConteudoMenuPedidos /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: "Gestor de pedidos" })).toBeNull();
});

it("navegação móvel de pedidos fecha pela escolha e mantém só o gestor", async () => {
  estado.pathname = CAMINHO_PEDIDOS;
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={acesso}><NavegacaoMovel identidade="pedidos" /></ProvedorAcesso>);
  await usuario.click(screen.getByRole("button", { name: "Abrir navegação" }));
  expect(screen.getByRole("dialog", { name: "Navegação do sistema" }).className).toContain("menu-pedidos");
  expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([CAMINHO_PEDIDOS]);
  await usuario.click(screen.getByRole("link", { name: "Gestor de pedidos" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("conta no host Pedidos conserva aparência e saída sem destinos de outros módulos", async () => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={acesso}><CabecalhoConteudo identidade="pedidos" sessao={{ nome: "Pessoa fictícia", email: "teste@example.invalid", admin: true }} /></ProvedorAcesso>);
  expect(screen.getByText("Gestor de Pedidos")).toBeDefined();
  expect(screen.getByRole("link", { name: "Ir para o Gestor de Pedidos" }).getAttribute("href")).toBe(CAMINHO_PEDIDOS);
  expect(screen.getByRole("img", { name: "Grazing Pedidos" })).toBeDefined();
  expect(screen.getByText("by Grazing Table & Co")).toBeDefined();
  expect(screen.queryByText("Administrador")).toBeNull();
  expect(screen.queryByRole("button", { name: "Abrir navegação" })).toBeNull();
  expect(screen.getByRole("button", { name: "Alterar aparência" })).toBeDefined();
  screen.getByRole("button", { name: "Abrir menu da conta" }).focus();
  await usuario.keyboard("{ArrowDown}");
  expect(await screen.findByRole("menuitem", { name: "Sair do Sistema" })).toBeDefined();
  expect(screen.queryByRole("menuitem", { name: "Meu Perfil" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Configurações" })).toBeNull();
});

it.each(["hub", "etiquetas"] as const)("cabeçalho de %s conserva navegação móvel e identificação do perfil", identidade => {
  render(<ProvedorAcesso acesso={acesso}><CabecalhoConteudo identidade={identidade} sessao={{ nome: "Pessoa fictícia", admin: true, perfilNome: "Perfil fictício" }} /></ProvedorAcesso>);
  expect(screen.getByRole("button", { name: "Abrir navegação" })).toBeDefined();
  expect(screen.getByText("Perfil fictício")).toBeDefined();
  expect(screen.getByRole("button", { name: "Alterar aparência" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Abrir menu da conta" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Ir para o Gestor de Pedidos" })).toBeNull();
  if (identidade === "etiquetas") expect(screen.getByText("Grazing HUB · Validades")).toBeDefined();
});

it("marca dedicada volta ao gestor nos detalhes sem oferecer outros módulos", () => {
  estado.pathname = CAMINHO_PEDIDOS + "/pedido-ficticio";
  render(<ProvedorAcesso acesso={acesso}><CabecalhoConteudo identidade="pedidos" sessao={{ nome: "Pessoa fictícia" }} /></ProvedorAcesso>);
  const links = screen.getAllByRole("link");
  expect(links.map(link => link.getAttribute("href"))).toEqual([CAMINHO_PEDIDOS]);
  expect(links[0].getAttribute("aria-current")).toBeNull();
});

it("marca dedicada não oferece gestor sem permissão", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: {}, excecoes: {} }}><CabecalhoConteudo identidade="pedidos" sessao={{ nome: "Pessoa fictícia" }} /></ProvedorAcesso>);
  expect(screen.getByRole("img", { name: "Grazing Pedidos" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Ir para o Gestor de Pedidos" })).toBeNull();
});
