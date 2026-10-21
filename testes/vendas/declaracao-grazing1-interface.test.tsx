// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorVersaoFiscal } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import type { ClassificacaoFiscal, PainelFiscal, RegraFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { PRODUTO_DECLARACAO_FCI_GRAZING1, REFERENCIA_INSTRUCAO_GRAZING1 } from "@/lib/tributacao/declaracao-fci-contrato";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
const sim = vi.hoisted(() => ({ registrar: vi.fn(), salvar: vi.fn(), refresh: vi.fn(), fechar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("@/app/(protegido)/vendas/fiscal/estrutura-actions", () => ({ registrarDeclaracaoGrazing1Action: sim.registrar, salvarVersaoFiscalAction: sim.salvar }));
const dados: ClassificacaoFiscal = { produtoId: PRODUTO_DECLARACAO_FCI_GRAZING1, grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "21069090", origem: null, cest: null, gtin: "SEM GTIN", unidade: "UN", estado: "PENDENTE", evidencias: ["Massa exclusivamente sintética"], pendencias: ["Demais parâmetros aguardam aprovação"], fotografiaTecnica: { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "e".repeat(64), materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [] } } };
const base: VersaoFiscalDto = { id: "classificacao-base-ficticia", tipo: "CLASSIFICACAO", chave: PRODUTO_DECLARACAO_FCI_GRAZING1, versao: 3, status: "RASCUNHO", vigenciaInicio: "2026-10-15", dados, justificativa: "Base exclusivamente sintética para testar o consumidor", fontes: ["REFERENCIA-SINTETICA"], criadoPorNome: "Autor fictício", createdAt: "2026-10-15T12:00:00.000Z", hash: "a".repeat(64) };
const painel: PainelFiscal = { administrador: true, produtos: [], grupos: [], opcoes: [], entradas: [], resumo: { ativos: 0, aptos: 0, pendentes: 0, configuracoes: 0 }, versoes: [base] };
beforeEach(() => { vi.resetAllMocks(); mockarCatalogoFiscal(); sim.registrar.mockResolvedValue({ ok: true, id: "nova-classificacao-ficticia" }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function abrir(p = painel, v = base) { render(<EditorVersaoFiscal tipo="CLASSIFICACAO" versao={v} painel={p} fechar={sim.fechar} />); }
it("regra de referência interna exibe a mercadoria do kit e preserva seu alvo ao editar", async () => {
  const tributo = { cst: "00", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Regra exclusivamente sintética" };
  const regra: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF05", produtoId: "INSUMO:insumo-sintetico", natureza: "FRACIONADO", ncm: "16010000", cfop: "5102", csosn: "102", icms: tributo, pis: { ...tributo, cst: "99" }, cofins: { ...tributo, cst: "99" }, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "TESTE", reforma: null, seletivo: "NAO_APLICAVEL" };
  const p = { ...painel, insumos: [{ id: "insumo-sintetico", nome: "Mercadoria fracionada sintética", tipo: "INSUMO", unidade: "KG" }] };
  render(<EditorVersaoFiscal tipo="REGRA" versao={{ ...base, tipo: "REGRA", chave: "regra-interna-sintetica", dados: regra }} painel={p} fechar={sim.fechar} />);
  expect(screen.getByRole("combobox", { name: "Produto específico" }).textContent).toContain("Referência do kit · Mercadoria fracionada sintética");
  sim.salvar.mockResolvedValue({ ok: true, id: "regra-nova-sintetica" });
  fireEvent.change(screen.getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Revisão exclusivamente sintética que conserva a referência do kit" } });
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
  expect(sim.salvar.mock.lastCall![0].dados.produtoId).toBe("INSUMO:insumo-sintetico");
});
it("registra a instrução já informada apenas no clique explícito e sem ativar ou salvar o formulário", async () => {
  abrir(); const registrar = screen.getByRole("button", { name: "Registrar declaração do responsável" });
  expect(sim.registrar).not.toHaveBeenCalled(); expect(screen.getByText(/cria um novo rascunho/)).toBeTruthy();
  await userEvent.click(registrar);
  await waitFor(() => expect(sim.registrar).toHaveBeenCalledExactlyOnceWith({ baseId: base.id, baseHash: base.hash, referenciaInstrucao: REFERENCIA_INSTRUCAO_GRAZING1 }));
  expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.fechar).toHaveBeenCalledOnce(); expect(sim.refresh).toHaveBeenCalledOnce();
  expect(dados.origem).toBeNull(); expect(dados.estado).toBe("PENDENTE");
});
it("não descarta uma edição em andamento ao registrar a declaração sobre a base arquivada", async () => {
  abrir(); fireEvent.change(screen.getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Edição exclusivamente sintética ainda não salva" } });
  const registrar = screen.getByRole("button", { name: "Registrar declaração do responsável" });
  expect(registrar.hasAttribute("disabled")).toBe(true); await userEvent.click(registrar);
  expect(screen.getByText(/Há edições neste formulário/)).toBeTruthy(); expect(sim.registrar).not.toHaveBeenCalled();
});
it.each(["leitor", "outro-produto", "sem-materiais", "base-antiga", "nacional-confirmada", "origem-definida"])("não oferece o registro específico no contexto %s", contexto => {
  const v = structuredClone(base), p = structuredClone(painel);
  if (contexto === "leitor") p.administrador = false;
  if (contexto === "outro-produto") { v.chave = "produto-outro"; (v.dados as ClassificacaoFiscal).produtoId = v.chave; p.versoes = [v]; }
  if (contexto === "sem-materiais") { delete (v.dados as ClassificacaoFiscal).fotografiaTecnica; p.versoes = [v]; }
  if (contexto === "nacional-confirmada" || contexto === "origem-definida") { const d = v.dados as ClassificacaoFiscal; d.origem = contexto === "nacional-confirmada" ? "0" : "5"; d.estado = "CONFIRMADO"; d.pendencias = []; p.versoes = [v]; }
  if (contexto === "base-antiga") p.versoes = [v, { ...v, id: "mais-nova", versao: 4 }];
  abrir(p, v); expect(screen.queryByRole("button", { name: "Registrar declaração do responsável" })).toBeNull(); expect(sim.registrar).not.toHaveBeenCalled();
});
it("erro local mantém a versão e não converte ausência de registro em sucesso", async () => {
  sim.registrar.mockResolvedValue({ erro: "A proposta mudou. Reabra a versão atual." }); abrir();
  await userEvent.click(screen.getByRole("button", { name: "Registrar declaração do responsável" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "A proposta mudou. Reabra a versão atual.");
  expect(sim.fechar).not.toHaveBeenCalled(); expect(sim.refresh).not.toHaveBeenCalled(); expect(sim.salvar).not.toHaveBeenCalled();
});
