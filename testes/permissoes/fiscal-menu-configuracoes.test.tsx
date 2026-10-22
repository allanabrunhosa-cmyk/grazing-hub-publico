// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ProvedorAcesso, useAcesso } from "@/components/layout/acesso-contexto";
import { RECURSOS_CONFIGURACAO_FISCAL } from "@/lib/permissoes/fiscal";
afterEach(cleanup);
function Consulta() { const { podeRota, entradaModulo } = useAcesso(); return <><span>{podeRota("/financeiro/fiscal/configuracoes") ? "Visível" : "Sem acesso"}</span>{entradaModulo("financeiro") && <a href={entradaModulo("financeiro")}>Entrar no Financeiro</a>}</>; }
it.each(RECURSOS_CONFIGURACAO_FISCAL)("menu mostra a central com a permissão histórica %s", recurso => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { [recurso]: ["visualizar"] }, excecoes: {} }}><Consulta /></ProvedorAcesso>);
  expect(screen.getByText("Visível")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Entrar no Financeiro" })).toBeTruthy();
});
it("não amplia acesso sem concessão fiscal ou de configurações", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: {}, excecoes: {} }}><Consulta /></ProvedorAcesso>);
  expect(screen.getByText("Sem acesso")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Entrar no Financeiro" })).toBeNull();
});
