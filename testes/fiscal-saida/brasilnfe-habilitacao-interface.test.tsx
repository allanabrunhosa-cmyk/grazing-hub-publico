// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HabilitacaoEmissaoBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/habilitacao-emissao-card";
import { controleEmissaoFicticio } from "./brasilnfe-habilitacao-dados";
afterEach(cleanup);
function preparar(editar = true, dados = controleEmissaoFicticio()) {
  const salvar = vi.fn(async () => ({ ok: true as const, dados: { ...dados, homologacao: { id: "evento-ficticio", revisao: 1, ambiente: "HOMOLOGACAO" as const, habilitada: true, modelos: [55 as const], versaoConfiguracao: 1, emitenteHash: "a".repeat(64), criadaEm: "2026-10-14T12:00:00.000Z" }, correspondentes: { homologacao: true, producao: false } } }));
  render(<HabilitacaoEmissaoBrasilNfeCard inicial={dados} editar={editar} salvar={salvar} />); return { salvar };
}
it("controle local mostra ambiente e bloqueios; não transmite nem habilita ao abrir", () => {
  const { salvar } = preparar(); expect(screen.getByText("Homologação — ambiente 2")).toBeTruthy(); expect(screen.getByText("Produção — ambiente 1")).toBeTruthy();
  expect(screen.getAllByText("Bloqueada")).toHaveLength(2); expect(salvar).not.toHaveBeenCalled();
  expect(screen.getByText("Conferir CSC de homologação.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Emitir nota|Transmitir|Validar conexão/ })).toBeNull();
});
it("exige confirmação explícita e salva só modelo e ambiente selecionados, sem segredo", async () => {
  const dados = controleEmissaoFicticio(); dados.liberacaoTransmissao = { liberada: true, motivo: null };
  const { salvar } = preparar(true, dados), botoes = screen.getAllByRole("button", { name: "Habilitar emissão manual" });
  expect((botoes[0] as HTMLButtonElement).disabled).toBe(true); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(botoes[0]);
  await waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
  expect(salvar).toHaveBeenCalledWith({ ambiente: "HOMOLOGACAO", revisao: 0, habilitada: true, modelos: [55], documentosHomologados: [], confirmarAtivacao: true });
  await waitFor(() => expect(screen.getByText("Manual habilitada")).toBeTruthy()); expect((screen.getByRole("checkbox") as HTMLInputElement).getAttribute("aria-checked")).not.toBe("true");
});
it("produção continua bloqueada por prova faltante mesmo com confirmação marcada", () => {
  const dados = controleEmissaoFicticio(); dados.liberacaoTransmissao = { liberada: true, motivo: null };
  const { salvar } = preparar(true, dados); fireEvent.click(screen.getByRole("checkbox"));
  const producao = screen.getByText("Produção — ambiente 1").closest("section")!;
  expect((within(producao).getByRole("button", { name: "Habilitar emissão manual" }) as HTMLButtonElement).disabled).toBe(true); expect(salvar).not.toHaveBeenCalled();
});
it("capacidade administrativa permite habilitar o fluxo manual sem fingir liberação de uma nota", async () => {
  const dados = controleEmissaoFicticio(); dados.habilitacaoManualDisponivel = true;
  const { salvar } = preparar(true, dados);
  expect(screen.getByText(/Cada nota exige revisão e autorização específica no pedido/)).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo a alteração local da habilitação manual/ }));
  const homologacao = screen.getByText("Homologação — ambiente 2").closest("section")!;
  fireEvent.click(within(homologacao).getByRole("button", { name: "Habilitar emissão manual" }));
  await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith({ ambiente: "HOMOLOGACAO", revisao: 0, habilitada: true, modelos: [55], documentosHomologados: [], confirmarAtivacao: true }));
  expect(dados.liberacaoTransmissao.liberada).toBe(false);
});
it("capacidade administrativa não contorna a prova de homologação produtiva nem acesso somente leitura", () => {
  const dados = controleEmissaoFicticio(); dados.habilitacaoManualDisponivel = true;
  const { salvar } = preparar(true, dados); fireEvent.click(screen.getByRole("checkbox"));
  const producao = screen.getByText("Produção — ambiente 1").closest("section")!;
  expect(within(producao).getByRole("button", { name: "Habilitar emissão manual" }).hasAttribute("disabled")).toBe(true);
  expect(salvar).not.toHaveBeenCalled(); cleanup();
  preparar(false, dados); expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull();
});
it("gate bloqueado não oferece habilitação ou autorização mesmo com pré-requisitos completos", () => {
  const dados = controleEmissaoFicticio(); dados.requisitos = dados.requisitos.map(r => ({ ...r, pendencias: [] }));
  const { salvar } = preparar(true, dados);
  expect(screen.queryByRole("button", { name: "Habilitar emissão manual" })).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  const botoes = screen.getAllByRole("button", { name: "Emissão ainda não liberada" });
  expect(botoes).toHaveLength(2); expect(botoes.every(b => b.hasAttribute("disabled"))).toBe(true);
  fireEvent.click(botoes[0]); expect(salvar).not.toHaveBeenCalled();
});
it.each([false, undefined])("habilitação histórica com gate %s permanece bloqueada e permite somente o bloqueio administrativo local", async liberada => {
  const dados = controleEmissaoFicticio();
  if (liberada === undefined) Reflect.deleteProperty(dados, "liberacaoTransmissao");
  dados.homologacao = { id: "evento-ficticio", ambiente: "HOMOLOGACAO", habilitada: true, revisao: 2, versaoConfiguracao: 1, emitenteHash: "a".repeat(64), modelos: [55], criadaEm: "2026-10-14T12:00:00.000Z" };
  dados.correspondentes.homologacao = true;
  const { salvar } = preparar(true, dados);
  expect(screen.queryByText("Manual habilitada")).toBeNull(); expect(screen.getAllByText("Bloqueada")).toHaveLength(2);
  expect(screen.getByText(/Revisão 2/)).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo o bloqueio local/ }));
  const ambiente = screen.getByText("Homologação — ambiente 2").closest("section")!;
  fireEvent.click(within(ambiente).getByRole("button", { name: "Bloquear ambiente" }));
  await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith({ ambiente: "HOMOLOGACAO", revisao: 2, habilitada: false, modelos: [55], documentosHomologados: [], confirmarAtivacao: true }));
  expect(screen.queryByRole("button", { name: "Habilitar emissão manual" })).toBeNull();
});
it("acesso de leitura conserva estados e não oferece habilitar ou confirmar", () => {
  preparar(false); expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull();
});
it("suspensão administrativa da configuração atual permanece explícita e não libera nota", () => {
  const dados = controleEmissaoFicticio();
  dados.producao = { id: "suspensao-ficticia", ambiente: "PRODUCAO", habilitada: false, revisao: 3, versaoConfiguracao: 1, emitenteHash: "a".repeat(64), modelos: [55], criadaEm: "2026-10-15T12:00:00.000Z" };
  dados.correspondentes.producao = true;
  const { salvar } = preparar(false, dados);
  const producao = screen.getByText("Produção — ambiente 1").closest("section")!;
  expect(within(producao).getByText("Suspensa por administração")).toBeTruthy();
  expect(within(producao).queryByText("Manual habilitada")).toBeNull();
  expect(salvar).not.toHaveBeenCalled();
});
it("mudança de configuração invalida estado anterior e mostra a necessidade de conferir", () => {
  const dados = controleEmissaoFicticio(); dados.homologacao = { id: "evento-ficticio", ambiente: "HOMOLOGACAO", habilitada: true, revisao: 2, versaoConfiguracao: 1, emitenteHash: "a".repeat(64), modelos: [55], criadaEm: "2026-10-14T12:00:00.000Z" };
  preparar(true, dados); expect(screen.queryByText("Manual habilitada")).toBeNull(); expect(screen.getByText(/A configuração ou o emitente mudou/)).toBeTruthy();
});
