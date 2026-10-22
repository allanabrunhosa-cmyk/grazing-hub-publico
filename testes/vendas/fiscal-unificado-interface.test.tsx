// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiscalProdutoUnificado } from "@/app/(protegido)/financeiro/fiscal/ficha-produto";
import { fichaKitUnificada, fichaUnificada } from "../visual/fiscal-unificado-dados";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
import type { ClassificacaoFiscal, RegraFiscal } from "@/lib/tributacao/tipos";
const sim = vi.hoisted(() => ({ salvar: vi.fn(), revisar: vi.fn(), aplicar: vi.fn(), consultar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/app/(protegido)/vendas/fiscal/estrutura-actions", () => ({ registrarDeclaracaoGrazing1Action: vi.fn(), salvarVersaoFiscalAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/fiscal/manutencao-actions", () => ({ salvarManutencaoFiscalAction: sim.salvar, revisarManutencaoFiscalAction: sim.revisar, aplicarManutencaoFiscalAction: sim.aplicar, consultarFichaFiscalAction: sim.consultar }));
beforeEach(() => { mockarCatalogoFiscal(); sim.consultar.mockResolvedValue({ ok: true, dados: structuredClone(fichaUnificada) }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it("mostra o valor efetivo herdado e a representação da nota sem gravar outro cadastro", () => {
  render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  expect(screen.getByText("Herdado do grupo")).toBeTruthy(); expect(screen.queryByText(/^CST\s*ICMS$/)).toBeNull(); expect(screen.getByText("Como aparece na nota")).toBeTruthy();
  expect(screen.getByText(/CFOP 5101 · CSOSN 102/)).toBeTruthy();
  expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.aplicar).not.toHaveBeenCalled();
});
it("salva, revisa e aplica na própria ficha com o hash do servidor", async () => {
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ ok: true, ids: ["nova-versao-ficticia"] });
  sim.revisar.mockResolvedValue({ ok: true, hash: "impacto-servidor-ficticio", impactos: [{ id: "nova-versao-ficticia", resumo: ["Documentos anteriores preservados."] }] }); sim.aplicar.mockResolvedValue({ ok: true });
  render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  await u.click(screen.getByRole("combobox", { name: "Modelo da ficha fiscal" }));
  await u.click(await screen.findByRole("option", { name: "NF-e · 55" }));
  await u.click(screen.getByRole("button", { name: "Editar classificação e grupo" }));
  const fundamento = screen.getByText("Fundamento e referências"); await u.click(fundamento);
  await u.click(screen.getByRole("textbox", { name: "Motivo da alteração" })); await u.paste("Classificação conferida exclusivamente para este teste.");
  await u.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.calls[0][0][0]).toMatchObject({ tipo: "CLASSIFICACAO", chave: fichaUnificada.produto.id, dados: { grupoFiscalId: "grupo-demonstracao", ncm: "19059090", origem: "0", gtin: "SEM GTIN" } });
  expect(sim.aplicar).not.toHaveBeenCalled();
  await u.click(await screen.findByRole("button", { name: "Revisar impacto" }));
  await u.click(await screen.findByRole("button", { name: "Aplicar configuração" }));
  await waitFor(() => expect(sim.aplicar).toHaveBeenCalledWith(["nova-versao-ficticia"], "impacto-servidor-ficticio"));
  expect(screen.getByRole("combobox", { name: "Modelo da ficha fiscal" }).textContent).toContain("NF-e · 55");
});
it("erro ao salvar preserva o formulário e não aplica a configuração", async () => {
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ erro: "Origem fiscal incompatível com a evidência." });
  render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  await u.click(screen.getByRole("button", { name: "Editar classificação e grupo" })); await u.click(screen.getByText("Fundamento e referências"));
  await u.click(screen.getByRole("textbox", { name: "Motivo da alteração" })); await u.paste("Motivo exclusivamente sintético para a revisão.");
  await u.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Origem fiscal incompatível com a evidência.");
  expect(screen.getByRole("textbox", { name: "Motivo da alteração" })).toHaveProperty("value", "Motivo exclusivamente sintético para a revisão."); expect(sim.aplicar).not.toHaveBeenCalled();
});
it("consulta sem administração não oferece edição nem aplicação", () => {
  const dados = structuredClone(fichaUnificada); dados.painel.administrador = false;
  render(<FiscalProdutoUnificado produtoId={dados.produto.id} inicial={dados} />);
  expect(screen.queryByRole("button", { name: "Editar classificação e grupo" })).toBeNull(); expect(screen.queryByRole("button", { name: "Personalizar esta operação" })).toBeNull();
});

it("editar uma exceção existente conserva seu alcance nos dois modelos", async () => {
  const dados = structuredClone(fichaUnificada), versao = dados.painel.versoes.find(v => v.tipo === "REGRA")!;
  versao.chave = "regra-produto-ficticia";
  (versao.dados as RegraFiscal).produtoId = dados.produto.id;
  sim.salvar.mockResolvedValue({ ok: true, ids: ["rascunho-ficticio"] });
  const u = userEvent.setup();
  render(<FiscalProdutoUnificado produtoId={dados.produto.id} inicial={dados} />);
  await u.click(screen.getByRole("button", { name: "Editar regra do produto" }));
  expect(screen.getByText(/Operação: SP · Consumo final · NF-e e NFC-e/)).toBeTruthy();
  await u.click(screen.getByText("Fundamento e referências"));
  await u.click(screen.getByRole("textbox", { name: "Motivo da alteração" })); await u.paste("Manutenção exclusivamente sintética do alcance existente.");
  await u.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  const entrada = sim.salvar.mock.calls[0][0][0];
  expect(entrada.chave).toBe(versao.chave);
  expect(entrada.dados.modelo).toBeUndefined();
  expect(entrada.dados.ufDestino).toBe("SP");
});

it("personaliza a operação de um componente interno sem criar produto comercial", async () => {
  const dados = structuredClone(fichaUnificada), id = "INSUMO:insumo-ficticio";
  dados.produto.id = id;
  const cv = dados.painel.versoes.find(v => v.tipo === "CLASSIFICACAO")!;
  cv.chave = id;
  const c = cv.dados as ClassificacaoFiscal; c.produtoId = null; c.referenciaInternaInsumoId = "insumo-ficticio";
  dados.painel.produtos = [];
  dados.painel.insumos = [{ id: "insumo-ficticio", nome: "Mercadoria interna fictícia", tipo: "MATERIA_PRIMA", unidade: "UN" }];
  sim.salvar.mockResolvedValue({ ok: true, ids: ["rascunho-interno-ficticio"] });
  const u = userEvent.setup();
  render(<FiscalProdutoUnificado produtoId={id} inicial={dados} />);
  await u.click(screen.getByRole("button", { name: "Personalizar esta operação" }));
  await u.click(screen.getByText("Fundamento e referências"));
  await u.click(screen.getByRole("textbox", { name: "Motivo da alteração" })); await u.paste("Exceção sintética do componente discriminado no kit.");
  await u.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.calls[0][0][0]).toMatchObject({ chave: "produto-insumo-insumo-ficticio-SP-F-65", dados: { produtoId: id, modelo: "65" } });
});

it("kit mostra os tributos dos componentes e dispensa campos da linha fiscal do pai", async () => {
  const u = userEvent.setup();
  render(<FiscalProdutoUnificado produtoId={fichaKitUnificada.produto.id} inicial={structuredClone(fichaKitUnificada)} />);
  expect(screen.queryByRole("button", { name: "Personalizar esta operação" })).toBeNull();
  expect(screen.getByText(/NCM 19059090.*CFOP 5101/)).toBeTruthy();
  expect(screen.getByText(/NCM 08061000.*CFOP 5102/)).toBeTruthy();
  await u.click(screen.getByRole("button", { name: "Editar classificação e grupo" }));
  expect(screen.queryByRole("combobox", { name: "NCM individual" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Origem fiscal" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Confirmação do GTIN" })).toBeNull();
});
