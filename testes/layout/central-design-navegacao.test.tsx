// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";

vi.mock("next/navigation", () => ({ usePathname: () => "/configuracoes/design/componentes" }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));

afterEach(cleanup);

it("expõe os grupos da Central de Design para administradores e permite recolhê-los", () => {
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  const expansor = screen.getByRole("button", { name: "Recolher Central de Design" });
  expect(expansor.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("link", { name: "Componentes" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(expansor);
  expect(screen.getByRole("button", { name: "Expandir Central de Design" }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Fundamentos" })).toBeNull();
});

it("não expõe a Central de Design para perfis não administrativos", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"] }, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: "Central de Design" })).toBeNull();
});
