// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HabilitacaoEmissaoBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/habilitacao-emissao-card";
import type { ControleEmissaoBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/operacional";

afterEach(cleanup);
function controleFicticio(): ControleEmissaoBrasilNfeDto {
  return { homologacao: null, producao: { id: "habilitacao55-exclusivamente-sintetica", ambiente: "PRODUCAO", habilitada: true, revisao: 4,
    versaoConfiguracao: 9, emitenteHash: "a".repeat(64), modelos: [55], criadaEm: "2026-10-20T23:00:00.000Z" },
    correspondentes: { homologacao: false, producao: true }, automatica: false, callback: false, habilitacaoManualDisponivel: true,
    liberacaoTransmissao: { liberada: false, motivo: "Cada nota exige autorização específica." },
    documentosHomologados: [{ id: "homologacao55-exclusivamente-sintetica", modelo: 55, numero: "1", serie: "6" }],
    requisitos: [
      { ambiente: "HOMOLOGACAO", modelo: 55, pendencias: [] },
      { ambiente: "HOMOLOGACAO", modelo: 65, pendencias: ["Conferir CSC de homologação."] },
      { ambiente: "PRODUCAO", modelo: 55, pendencias: [] },
      { ambiente: "PRODUCAO", modelo: 65, pendencias: [], homologacaoNaoComprovada: true, permiteAceiteAdministrativo: true },
    ] };
}
function preparar(dados = controleFicticio(), editar = true) {
  const salvar = vi.fn(async () => ({ ok: true as const, dados }));
  render(<HabilitacaoEmissaoBrasilNfeCard inicial={dados} editar={editar} salvar={salvar} />);
  return { salvar, usuario: userEvent.setup() };
}
const producao = () => within(screen.getByText("Produção — ambiente 1").closest("section")!);
const botaoProducao = () => producao().getByRole("button", { name: "Habilitar emissão manual" });
const confirmacao = () => screen.getByRole("checkbox", { name: /Confirmo a alteração local da habilitação manual/ });
const aceite = () => screen.getByRole("checkbox", { name: /Autorizo a habilitação manual da NFC-e em produção sem prova local de homologação/ });
async function selecionar(usuario: ReturnType<typeof userEvent.setup>, nome: string, opcao: string) {
  await usuario.click(screen.getByRole("combobox", { name: nome }));
  await usuario.click(await screen.findByRole("option", { name: nomeOpcao => nomeOpcao === opcao }));
}

it("abrir e selecionar65 não salva nem herda a habilitação55", async () => {
  const { usuario, salvar } = preparar();
  expect(producao().getByText("Manual habilitada")).toBeTruthy();
  expect(salvar).not.toHaveBeenCalled();
  await selecionar(usuario, "Modelos para habilitar", "NFC-e — modelo 65");
  expect(producao().getByText("Habilitada para outros modelos")).toBeTruthy();
  expect(producao().queryByText("Manual habilitada")).toBeNull();
  expect(salvar).not.toHaveBeenCalled();
});

it("65/produção exige aceite específico e confirmação geral, sem alterar homologação", async () => {
  const { usuario, salvar } = preparar();
  await selecionar(usuario, "Modelos para habilitar", "NFC-e — modelo 65");
  fireEvent.click(confirmacao());
  expect(botaoProducao().hasAttribute("disabled")).toBe(true);
  fireEvent.click(botaoProducao()); expect(salvar).not.toHaveBeenCalled();
  fireEvent.click(aceite());
  expect(confirmacao().getAttribute("aria-checked")).toBe("false");
  expect(botaoProducao().hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Conferir CSC de homologação.")).toBeTruthy();
  expect(salvar).not.toHaveBeenCalled();
});

it("ambos preserva55 no comando e envia decisão65 assistida com conteúdo estrito", async () => {
  const { usuario, salvar } = preparar();
  await selecionar(usuario, "Modelos para habilitar", "NF-e e NFC-e");
  fireEvent.click(aceite());
  await selecionar(usuario, "Forma de registro da decisão", "Codex executa instrução expressa do responsável");
  fireEvent.click(confirmacao());
  expect(botaoProducao().hasAttribute("disabled")).toBe(false);
  fireEvent.click(botaoProducao());
  await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith({ ambiente: "PRODUCAO", revisao: 4, habilitada: true,
    modelos: [55, 65], documentosHomologados: ["homologacao55-exclusivamente-sintetica"], confirmarAtivacao: true,
    decisaoProducao65: { versao: 1, tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL", motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL",
      confirmarResponsabilidade: true, modoRegistro: "AUTOMACAO_ASSISTIDA" } }));
  await waitFor(() => expect(confirmacao().getAttribute("aria-checked")).toBe("false"));
  expect(aceite().getAttribute("aria-checked")).toBe("false");
});

it("CSC de produção pendente continua bloqueando mesmo com os dois aceites", async () => {
  const dados = controleFicticio();
  dados.requisitos.find(r => r.ambiente === "PRODUCAO" && r.modelo === 65)!.pendencias = ["Conferir CSC e identificador de produção."];
  const { usuario, salvar } = preparar(dados);
  await selecionar(usuario, "Modelos para habilitar", "NFC-e — modelo 65");
  fireEvent.click(aceite()); fireEvent.click(confirmacao());
  expect(producao().getByText("Conferir CSC e identificador de produção.")).toBeTruthy();
  expect(botaoProducao().hasAttribute("disabled")).toBe(true);
  fireEvent.click(botaoProducao()); expect(salvar).not.toHaveBeenCalled();
});

it("modelo55 continua sem decisão65 e usa apenas sua prova própria", async () => {
  const dados = controleFicticio(); dados.producao = null; dados.correspondentes.producao = false;
  const { salvar } = preparar(dados);
  expect(screen.queryByRole("checkbox", { name: /Autorizo a habilitação manual da NFC-e/ })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Forma de registro da decisão" })).toBeNull();
  fireEvent.click(confirmacao()); fireEvent.click(botaoProducao());
  await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith({ ambiente: "PRODUCAO", revisao: 0, habilitada: true,
    modelos: [55], documentosHomologados: ["homologacao55-exclusivamente-sintetica"], confirmarAtivacao: true }));
});

it("trocar o modelo elimina o aceite65 e exige nova confirmação", async () => {
  const { usuario, salvar } = preparar();
  await selecionar(usuario, "Modelos para habilitar", "NFC-e — modelo 65");
  fireEvent.click(aceite()); fireEvent.click(confirmacao());
  await selecionar(usuario, "Modelos para habilitar", "NF-e — modelo 55");
  await selecionar(usuario, "Modelos para habilitar", "NFC-e — modelo 65");
  expect(aceite().getAttribute("aria-checked")).toBe("false");
  expect(confirmacao().getAttribute("aria-checked")).toBe("false");
  expect(botaoProducao().hasAttribute("disabled")).toBe(true); expect(salvar).not.toHaveBeenCalled();
});

it("acesso somente leitura não oferece decisão, habilitação ou bloqueio", () => {
  const { salvar } = preparar(controleFicticio(), false);
  expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull(); expect(salvar).not.toHaveBeenCalled();
});
