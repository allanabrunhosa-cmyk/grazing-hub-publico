// @vitest-environment jsdom
import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";

vi.mock("next/navigation", () => ({ usePathname: () => "/producao" }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));

it("mostra a seta de saída e abre Validades em nova aba", () => {
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  const link = screen.getByRole("link", { name: "Controle de validades" });
  expect(link.getAttribute("href")).toBe("https://validades.grazinghub.com.br/producao/etiquetas");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");
  expect(link.querySelector("svg.ml-auto")).not.toBeNull();
});
