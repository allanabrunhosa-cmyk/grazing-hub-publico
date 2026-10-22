// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiscalProdutoUnificado } from "@/app/(protegido)/financeiro/fiscal/ficha-produto";
import { GruposFiscais } from "@/app/(protegido)/vendas/fiscal/grupos-fiscais-client";
import { fichaKitUnificada, fichaUnificada } from "../visual/fiscal-unificado-dados";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
const sim = vi.hoisted(() => ({ salvar: vi.fn(), grupo: vi.fn(), consultar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/app/(protegido)/vendas/actions", () => ({ alterarSituacaoGrupoFiscalVendaAction: vi.fn(), excluirCadastroVendaAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/fiscal/simples-actions", () => ({ salvarFiscalSimplesAction: sim.salvar, salvarGrupoFiscalSimplesAction: sim.grupo }));
vi.mock("@/app/(protegido)/financeiro/fiscal/manutencao-actions", () => ({ consultarFichaFiscalAction: sim.consultar }));
beforeEach(() => { mockarCatalogoFiscal(); sim.consultar.mockResolvedValue({ ok: true, dados: structuredClone(fichaUnificada) }); sim.salvar.mockResolvedValue({ ok: true }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("mantém os campos oficiais na grade e somente um botão Salvar", () => {
  render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  for (const nome of ["NCM", "Origem ICMS", "CFOP", "CSOSN", "CST PIS", "CST COFINS"]) expect(screen.getByRole("combobox", { name: nome })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Salvar" })).toHaveLength(1);
  expect(screen.queryByText("Salvar rascunho")).toBeNull(); expect(screen.queryByText("Revisar impacto")).toBeNull();
  expect(screen.queryByText("Como aparece na nota")).toBeNull();
});
it("salva diretamente no motor e conserva o contexto escolhido", async () => {
  const u = userEvent.setup(); render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  await u.click(screen.getByRole("combobox", { name: "Operação fiscal" })); await u.click(await screen.findByRole("option", { name: "NF-e · consumidor final" }));
  await u.click(screen.getByRole("combobox", { name: "NCM" })); await u.clear(screen.getByRole("combobox", { name: "NCM" })); await u.paste("19053100"); await u.click(await screen.findByRole("option", { name: /^19053100 ·/ }));
  await u.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.calls[0][0]).toMatchObject({ contexto: { modelo: "55" }, fiscal: { ncm: "19053100", origem: "0", ean: "SEM GTIN" } });
  expect(await screen.findByText("Dados fiscais salvos.")).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Operação fiscal" }).textContent).toContain("NF-e");
});
it("erro mantém a edição e permite nova tentativa", async () => {
  sim.salvar.mockResolvedValue({ erro: "Preencha a origem do produto." }); const u = userEvent.setup();
  render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  await u.click(screen.getByRole("checkbox", { name: "Usar impostos do grupo" })); await u.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Preencha a origem do produto.");
  expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", false);
});
it("consulta sem administração não oferece salvamento", () => {
  const dados = structuredClone(fichaUnificada); dados.painel.administrador = false;
  render(<FiscalProdutoUnificado produtoId={dados.produto.id} inicial={dados} />);
  expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull(); expect(screen.getByRole("combobox", { name: "NCM" }).closest("fieldset")).toHaveProperty("disabled", true);
});
it("kit e complemento integrado não recebem NCM ou impostos fictícios no pai", () => {
  render(<FiscalProdutoUnificado produtoId={fichaKitUnificada.produto.id} inicial={structuredClone(fichaKitUnificada)} />);
  expect(screen.queryByRole("combobox", { name: "NCM" })).toBeNull(); expect(screen.getByText(/O kit utiliza os dados fiscais/)).toBeTruthy();
});
it("a opção visível Kit exige componentes explícitos e não importa a receita", async () => {
  const u = userEvent.setup(); render(<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={structuredClone(fichaUnificada)} />);
  await u.click(screen.getByRole("combobox", { name: "Representação na nota" }));
  await u.click(await screen.findByRole("option", { name: "Kit · discriminar componentes" }));
  expect(screen.getByText("Componentes do kit (0)")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "NCM" })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Adicionar produto ao kit" }));
  expect(screen.getByText("Componentes do kit (1)").closest("details")).toHaveProperty("open", true);
  const quantidade = screen.getByRole("textbox", { name: "Quantidade do kit 1" });
  await u.clear(quantidade); await u.type(quantidade, "2abc"); expect(quantidade).toHaveProperty("value", "2");
  expect(screen.getByRole("combobox", { name: "Produto do kit 1" })).toHaveProperty("value", "");
  await u.click(screen.getByRole("button", { name: "Remover componente 1" }));
  expect(screen.queryByRole("combobox", { name: "Produto do kit 1" })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.calls[0][0]).toMatchObject({ representacao: "KIT", componentesKit: [] });
});
it("corrigir kit para preparação reabre os campos do produto e salva a escolha explícita", async () => {
  const dados = structuredClone(fichaKitUnificada);
  dados.produto.fiscal = { ncm: "21069090", origem: "0", cfop: "5101", csosn: "102", pis: "49", cofins: "49", ean: "SEM GTIN", unidadeTributavel: "UN" };
  const antes = structuredClone(dados.painel.versoes);
  const u = userEvent.setup(); render(<FiscalProdutoUnificado produtoId={dados.produto.id} inicial={dados} />);
  await u.click(screen.getByRole("combobox", { name: "Representação na nota" }));
  await u.click(await screen.findByRole("option", { name: "Preparação · somente o produto" }));
  expect(screen.getByRole("combobox", { name: "NCM" })).toHaveProperty("value", expect.stringContaining("21069090"));
  expect(screen.queryByText(/Componentes do kit/)).toBeNull();
  await u.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.calls[0][0]).toMatchObject({ representacao: "PRODUTO_PREPARADO", fiscal: { ncm: "21069090", origem: "0", csosn: "102" } });
  expect(dados.painel.versoes).toEqual(antes);
});
it("grupo usa o editor anterior com impostos, sem NCM nem GTIN", async () => {
  const u = userEvent.setup(); render(<GruposFiscais editar crt={1} painel={fichaUnificada.painel} grupos={[{ id: "grupo-demonstracao", nome: "Preparações", versao: 1, fiscal: {}, ativo: true, produtos: [] }]} />);
  await u.click(screen.getByRole("button", { name: "Editar Preparações" }));
  expect(screen.getByRole("dialog")).toBeTruthy(); expect(screen.queryByRole("combobox", { name: "NCM" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "GTIN da unidade final" })).toBeNull();
  for (const nome of ["Origem ICMS", "CFOP", "CSOSN", "CST PIS", "CST COFINS"]) expect(screen.getByRole("combobox", { name: nome })).toBeTruthy();
});

it("herdar a origem mostra e salva a origem efetiva do grupo", async () => {
  const dados = structuredClone(fichaUnificada);
  const classe = dados.painel.versoes.find(v => v.tipo === "CLASSIFICACAO")!.dados as import("@/lib/tributacao/tipos").ClassificacaoFiscal;
  classe.origem = "1"; classe.herdarOrigemGrupo = false;
  (dados.painel.versoes.find(v => v.tipo === "REGRA")!.dados as import("@/lib/tributacao/tipos").RegraFiscal).origem = "0";
  const u = userEvent.setup(); render(<FiscalProdutoUnificado produtoId={dados.produto.id} inicial={dados} />);
  await u.click(screen.getByRole("checkbox", { name: "Usar origem ICMS do grupo" }));
  expect(screen.getByRole("combobox", { name: "Origem ICMS" })).toHaveProperty("value", expect.stringContaining("0"));
  await u.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.calls[0][0]).toMatchObject({ herdarOrigemGrupo: true, fiscal: { origem: "0" } });
});

it("serviços conservam o cadastro sem exigir NCM, GTIN ou ICMS de mercadoria", () => {
 const dados = structuredClone(fichaUnificada); (dados.painel.versoes.find(v => v.tipo === "CLASSIFICACAO")!.dados as import("@/lib/tributacao/tipos").ClassificacaoFiscal).natureza = "SERVICO";
 render(<FiscalProdutoUnificado produtoId={dados.produto.id} inicial={dados} />);
 expect(screen.queryByRole("combobox", { name: "NCM" })).toBeNull();
 expect(screen.getByText("Serviços não usam os campos de NF-e/NFC-e.")).toBeTruthy();
});
