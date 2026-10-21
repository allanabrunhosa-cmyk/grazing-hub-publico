// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegrasBrasilNfeClient, HistoricoRegraDialog } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/regras-client";
import { FormularioRegraBrasilNfe } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/formulario";
import { camposIniciaisRegraBrasilNfe, montarRascunhoFormularioBrasilNfe, resumoConteudoRegraBrasilNfe } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/formulario-dominio";
import type { CatalogosRegrasBrasilNfe, HistoricoRegraBrasilNfe, RegraListaBrasilNfe } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/tipos";
import { fundamentoInterfaceFicticio } from "./brasilnfe-fundamentacao-interface-fixtures";
import { normalizarTextoFormularioFiscal } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/textarea-fiscal";
import { mockarCatalogoFiscal } from "./catalogo-fiscal-fixture";

const acoes = vi.hoisted(() => ({ salvar: vi.fn(), aprovar: vi.fn(), inativar: vi.fn(), revisar: vi.fn(), bloquear: vi.fn(), historico: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: acoes.refresh }) }));
vi.mock("@/app/(protegido)/vendas/fiscal/regras-brasilnfe/actions", () => ({ salvarRascunhoRegraBrasilNfeAction: acoes.salvar, aprovarRegraBrasilNfeAction: acoes.aprovar, inativarRegraBrasilNfeAction: acoes.inativar, revisarRegraBrasilNfeAction: acoes.revisar, bloquearRegraBrasilNfeAction: acoes.bloquear, historicoRegraBrasilNfeAction: acoes.historico }));
const catalogos: CatalogosRegrasBrasilNfe = { produtos: [{ id: "produto-ficticio", nome: "Produto fictício", versao: 1, revisado: false, fiscal: {} }], grupos: [{ id: "grupo-ficticio", nome: "Grupo fictício", versao: 1, fiscal: {} }], formas: [{ id: "forma-ficticia", nome: "Forma fictícia" }] };
const versao = { id: "versao-ficticia", revisao: 1, estado: "PROPOSTA", referenciaConfirp: null, fundamentacaoFiscal: fundamentoInterfaceFicticio, fundamentacaoHash: "c".repeat(64), autorNome: "Responsável fictício", aprovacaoInterna: null, aprovacaoHash: null, legado: false, vigenteDesde: "2026-10-11", vigenteAte: null, responsavelId: "usuario-ficticio", emitenteHash: "a".repeat(64), versaoCadastro: null, fiscalCadastroHash: null, conteudoHash: "b".repeat(64), criadoEm: "2026-10-11T15:00:00.000Z" };
const historico: HistoricoRegraBrasilNfe = { id: "regra-ficticia", revisao: 1, modelo: 55, operacao: "NF_E_VENDA", alvo: "EMPRESA", produtoId: null, grupoId: null, versoes: [{ ...versao, conteudo: { tipo: "EMPRESA", emitente: { crt: 1, ie: "123456789", codMunicipio: "3550308", codPais: 1058, pais: "BRASIL" } } }] };
const regra: RegraListaBrasilNfe = { id: historico.id, revisao: 1, modelo: 55, operacao: "NF_E_VENDA", alvo: "EMPRESA", produtoId: null, grupoId: null, produtoNome: null, grupoNome: null, atual: versao };
beforeEach(() => { vi.stubGlobal("React", React); mockarCatalogoFiscal(); acoes.salvar.mockResolvedValue({ ok: true }); acoes.aprovar.mockResolvedValue({ ok: true }); acoes.inativar.mockResolvedValue({ ok: true }); acoes.revisar.mockResolvedValue({ ok: true }); acoes.bloquear.mockResolvedValue({ ok: true }); acoes.historico.mockResolvedValue({ ok: true, historico, responsaveis: { "usuario-ficticio": "Responsável fictício" } }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
function preparar(editar = true, regras = [regra]) { return render(<RegrasBrasilNfeClient regras={regras} editar={editar} catalogos={catalogos} responsaveis={{ "usuario-ficticio": "Responsável fictício" }} />); }

it("mostra preparação e bloqueios sem controles de transmissão", () => {
  preparar();
  expect(screen.getByText("Produção bloqueada")).toBeTruthy();
  expect(screen.getByText("Transmissão não autorizada")).toBeTruthy();
  expect(screen.getByText("Responsável fictício")).toBeTruthy();
  expect(screen.getByText(/11\/10\/2026 · sem término/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Emitir|Transmitir|ConsultarServicos|Validar conexão/ })).toBeNull();
});
it("leitor consulta histórico e não recebe ações de edição ou aprovação", async () => {
  preparar(false);
  expect(screen.queryByRole("button", { name: "Nova decisão" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Aprovar internamente" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Bloquear decisão" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Inativar" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
  await screen.findByRole("dialog", { name: "Histórico da decisão tributária" });
  expect(acoes.historico).toHaveBeenCalledWith("regra-ficticia");
  expect(acoes.salvar).not.toHaveBeenCalled();
});
it("abre cadastro sem modelo, códigos, taxas ou escolhas fiscais fictícias", async () => {
  preparar(true, []); fireEvent.click(screen.getByRole("button", { name: "Nova decisão" }));
  await screen.findByRole("dialog", { name: "Nova decisão tributária" });
  const entrada = camposIniciaisRegraBrasilNfe();
  expect(Object.values(entrada.campos).every(v => v === "")).toBe(true);
  expect(entrada.pagamentos).toEqual([]);
  expect(screen.queryByLabelText("Referência da Confirp")).toBeNull();
  expect((screen.getByLabelText("Justificativa da decisão") as HTMLInputElement).value).toBe("");
  expect(entrada.fundamentacao.fontes).toEqual([]);
  expect(entrada.fundamentacao.confianca).toEqual([]);
  expect(entrada.fundamentacao.contexto.regimeConfirmado).toBe(false);
  expect((screen.getByRole("button", { name: "Salvar proposta" }) as HTMLButtonElement).disabled).toBe(true);
  expect(acoes.salvar).not.toHaveBeenCalled();
});
it("alteração de rascunho não salva ao perder foco e usa confirmação explícita", async () => {
  const fechar = vi.fn(); render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={fechar} />);
  fireEvent.change(screen.getByLabelText("Justificativa da decisão"), { target: { value: "Revisão fictícia de teste para aplicação da fonte ao emitente" } });
  fireEvent.blur(screen.getByLabelText("Justificativa da decisão"));
  expect(acoes.salvar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Salvar proposta" }));
  await waitFor(() => expect(acoes.salvar).toHaveBeenCalledTimes(1));
  expect(acoes.salvar.mock.calls[0][0]).toMatchObject({ regraId: "regra-ficticia", revisao: 1, modelo: 55, alvo: "EMPRESA", fundamentacaoFiscal: { justificativa: "Revisão fictícia de teste para aplicação da fonte ao emitente" } });
  expect(acoes.salvar.mock.calls[0][0]).not.toHaveProperty("referenciaConfirp");
  expect(acoes.aprovar).not.toHaveBeenCalled();
  expect(fechar).toHaveBeenCalledTimes(1);
});
it("erro de serviço mantém o preenchimento e não aprova o rascunho", async () => {
  acoes.salvar.mockResolvedValue({ erro: "O cadastro mudou. Atualize a decisão tributária." });
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Inscrição estadual"), { target: { value: "987654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar proposta" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Inscrição estadual") as HTMLInputElement).value).toBe("987654321");
  expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("protege cancelar com alterações pelo diálogo oficial de descarte", async () => {
  const fechar = vi.fn(); render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={fechar} />);
  fireEvent.change(screen.getByLabelText("País"), { target: { value: "Brasil revisado" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await screen.findByRole("alertdialog");
  expect(fechar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect((screen.getByLabelText("País") as HTMLInputElement).value).toBe("Brasil revisado");
});
it("campos numéricos rejeitam letras na digitação e na colagem", async () => {
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={vi.fn()} />);
  const usuario = userEvent.setup(), ie = screen.getByLabelText("Inscrição estadual") as HTMLInputElement;
  await usuario.clear(ie); await usuario.type(ie, "AB12"); expect(ie.value).toBe("12");
  await usuario.clear(ie); await usuario.paste("valor inválido 123"); expect(ie.value).toBe("");
  expect(acoes.salvar).not.toHaveBeenCalled();
});
it("salvamento pendente bloqueia saída e segundo envio do rascunho", async () => {
  let concluir!: (v: { ok: true }) => void;
  acoes.salvar.mockImplementationOnce(() => new Promise<{ ok: true }>(r => { concluir = r; }));
  const fechar = vi.fn(); render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={fechar} />);
  fireEvent.change(screen.getByLabelText("País"), { target: { value: "Brasil" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar proposta" }));
  await waitFor(() => expect(acoes.salvar).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(fechar).not.toHaveBeenCalled(); expect(screen.queryByRole("alertdialog")).toBeNull();
  expect((screen.getByRole("button", { name: "Salvando…" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => concluir({ ok: true }));
  expect(fechar).toHaveBeenCalledTimes(1); expect(acoes.salvar).toHaveBeenCalledTimes(1);
});
it("aprovação interna exige conferência da fonte, conteúdo e confirmação não preselecionada", async () => {
  preparar(); fireEvent.click(screen.getByRole("button", { name: "Aprovar internamente" }));
  const dialogo = await screen.findByRole("dialog", { name: "Aprovar internamente a decisão" });
  const confirmar = within(dialogo).getByRole("button", { name: "Confirmar aprovação interna" }) as HTMLButtonElement;
  expect(within(dialogo).getByText("Norma exclusivamente fictícia de teste · Referência sintética de interface")).toBeTruthy();
  expect(within(dialogo).getByText("123456789")).toBeTruthy();
  expect(confirmar.disabled).toBe(true);
  expect(within(dialogo).getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
  fireEvent.click(within(dialogo).getByRole("checkbox")); fireEvent.click(confirmar);
  await waitFor(() => expect(acoes.aprovar).toHaveBeenCalledTimes(1));
  expect(acoes.aprovar).toHaveBeenCalledWith({ regraId: "regra-ficticia", revisao: 1, fundamentacaoHash: "c".repeat(64), conteudoHash: "b".repeat(64), aplicacaoConferida: true });
});
it("inativação é comando explícito de nova situação, sem exclusão", async () => {
  preparar(); fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
  await screen.findByRole("dialog", { name: "Inativar decisão tributária" });
  expect(acoes.inativar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));
  await waitFor(() => expect(acoes.inativar).toHaveBeenCalledWith({ regraId: "regra-ficticia", revisao: 1 }));
  expect(acoes.salvar).not.toHaveBeenCalled();
});
it("histórico renderiza conteúdo fiscal como texto escapado", () => {
  const dado = { ...historico, versoes: historico.versoes.map(v => ({ ...v, legado: true, fundamentacaoFiscal: null, referenciaConfirp: "<img src=x onerror=alert(1)>", conteudo: { tipo: "EMPRESA" as const, emitente: { crt: 1 as const, ie: "123456789", codMunicipio: "3550308", codPais: 1058, pais: "<script>não executar</script>" } } })) };
  const resultado = render(<HistoricoRegraDialog historico={dado} responsaveis={{}} fechar={vi.fn()} />);
  expect(screen.getByText("1058 · <script>não executar</script>")).toBeTruthy();
  expect(resultado.baseElement.querySelector("script,img")).toBeNull();
  expect(screen.queryByText(/conteudoHash|emitenteHash|fiscalCadastroHash/)).toBeNull();
});
it("preenchimento sem escolha booleana não é convertido em Não", () => {
  const campos = { modelo: "65", alvo: "OPERACAO", NaturezaOperacao: "Venda fictícia", Finalidade: "1", IndicadorPresenca: "1", ModalidadeFrete: "9", vigenteDesde: "2026-10-11" };
  expect(() => montarRascunhoFormularioBrasilNfe(campos, [{ formaId: "forma-ficticia", codigo: "17", indicador: "0", descricao: "" }])).toThrow(/Escolha Sim ou Não/);
});
it.each(["55", "65"])("monta operação do modelo %s com escolhas e forma fiscal explícitas", modelo => {
  const campos = { modelo, alvo: "OPERACAO", NaturezaOperacao: "Venda exclusivamente fictícia", Finalidade: "1", IndicadorPresenca: "1", ModalidadeFrete: "9", ConsumidorFinal: "SIM", CalcularIBPT: "NAO", intermediadorAplicavel: "NAO", identificar: "NAO", fonte: "TOTAL", incluirCobranca: "NAO", troco: "0", vigenteDesde: "2026-10-11" };
  const dados = montarRascunhoFormularioBrasilNfe(campos, [{ formaId: "forma-ficticia", codigo: "17", indicador: "0", descricao: "" }]);
  expect(dados).toMatchObject({ modelo: Number(modelo), operacao: modelo === "55" ? "NF_E_VENDA" : "NFC_E_VENDA", fundamentacaoFiscal: { contexto: { regime: "PENDENTE", regimeConfirmado: false, operacao: modelo === "55" ? "NF_E_VENDA" : "NFC_E_VENDA" } }, conteudo: { operacao: { ConsumidorFinal: true, CalcularIBPT: false, intermediadorAplicavel: false }, pagamentos: { mapeamentos: [{ formaId: "forma-ficticia", FormaPagamento: "17", IndicadorPagamento: 0 }] }, destinatario: { identificar: false } } });
  expect(acoes.salvar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("campos de alíquota mantêm precisão e normalizam só separador explícito", () => {
  const perfil = { classificacoes: { ncm: "", cest: "", origem: "", cfop: "", csosn: "", cstIcms: "", pis: "", cofins: "", ipi: "", fcp: "", ean: "", unidadeTributavel: "" }, cestAplicavel: false, fatorTributavel: "1.000001", icms: { tratamento: "TRIBUTADO" as const, AliquotaICMS: "1.2345", modalidadeBcIcms: 3 as const }, pis: { tratamento: "SEM_DESTAQUE" as const }, cofins: { tratamento: "SEM_DESTAQUE" as const }, ipiAplicavel: false, stAplicavel: false, fcpAplicavel: false, difalAplicavel: false, ibsCbsAplicavel: false, beneficioFiscalAplicavel: false };
  const dados = { ...historico, alvo: "PRODUTO", produtoId: "produto-ficticio", versoes: [{ ...historico.versoes[0], conteudo: { tipo: "ITEM" as const, perfil } }] };
  const inicial = camposIniciaisRegraBrasilNfe(dados);
  inicial.campos.icmsAliquota = "1,2345";
  expect(montarRascunhoFormularioBrasilNfe(inicial.campos, [], dados)).toMatchObject({ conteudo: { perfil: { fatorTributavel: "1.000001", icms: { AliquotaICMS: "1.2345" } } } });
});
it("referência legada permanece histórica sem fundamento ou aprovação interna fictícios", async () => {
  const legado = { ...regra, atual: { ...versao, estado: "APROVADA", legado: true, fundamentacaoFiscal: null, fundamentacaoHash: null, referenciaConfirp: "Parecer legado exclusivamente fictício" } };
  preparar(true, [legado]);
  expect(screen.getByText("Aprovada no contrato legado")).toBeTruthy();
  expect(screen.getByText("Parecer legado exclusivamente fictício")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Aprovar internamente" })).toBeNull();
  const antigo = { ...historico, versoes: [{ ...historico.versoes[0], ...legado.atual }] };
  const inicial = camposIniciaisRegraBrasilNfe(antigo);
  expect(inicial.fundamentacao.fontes).toEqual([]);
  expect(inicial.fundamentacao.justificativa).toBe("");
  expect(inicial.campos).not.toHaveProperty("referenciaConfirp");
  expect(acoes.aprovar).not.toHaveBeenCalled(); expect(acoes.salvar).not.toHaveBeenCalled();
});
it("histórico alterado impede confirmar aprovação de uma revisão obsoleta", async () => {
  acoes.historico.mockResolvedValue({ ok: true, historico: { ...historico, revisao: 2 }, responsaveis: {} });
  preparar(); fireEvent.click(screen.getByRole("button", { name: "Aprovar internamente" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("dialog", { name: "Aprovar internamente a decisão" })).toBeNull();
  expect(acoes.aprovar).not.toHaveBeenCalled();
});
it.each([{ botao: "Enviar para revisão", titulo: "Enviar decisão para revisão", confirmar: "Confirmar revisão", acao: acoes.revisar }, { botao: "Bloquear decisão", titulo: "Bloquear decisão tributária", confirmar: "Confirmar bloqueio", acao: acoes.bloquear }])("$botao é comando explícito sem alteração comercial ou aprovação", async ({ botao, titulo, confirmar, acao }) => {
  preparar(); fireEvent.click(screen.getByRole("button", { name: botao }));
  await screen.findByRole("dialog", { name: titulo });
  expect(acao).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: confirmar }));
  await waitFor(() => expect(acao).toHaveBeenCalledWith({ regraId: "regra-ficticia", revisao: 1 }));
  expect(acoes.aprovar).not.toHaveBeenCalled(); expect(acoes.salvar).not.toHaveBeenCalled();
});
it("adicionar ou remover fonte modifica somente proposta e usa remoção oficial", async () => {
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar fonte" }));
  expect((screen.getByLabelText("Título da fonte 2") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("URL da fonte 2") as HTMLInputElement).maxLength).toBe(500);
  fireEvent.change(screen.getByLabelText("Título da fonte 2"), { target: { value: "Fonte fictícia complementar" } });
  fireEvent.blur(screen.getByLabelText("Título da fonte 2"));
  expect(acoes.salvar).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Remover fonte 2" }).querySelector("svg")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remover fonte 2" }));
  expect(screen.queryByLabelText("Título da fonte 2")).toBeNull();
  expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("fontes e endereços externos são apenas texto escapado no histórico", () => {
  const fundamento = { ...fundamentoInterfaceFicticio, fontes: fundamentoInterfaceFicticio.fontes.map(f => ({ ...f, titulo: "<img src=x onerror=alert(1)>", uri: "javascript:alert(1)" })) };
  const dados = { ...historico, versoes: [{ ...historico.versoes[0], fundamentacaoFiscal: fundamento }] };
  const resultado = render(<HistoricoRegraDialog historico={dados} responsaveis={{}} fechar={vi.fn()} />);
  expect(screen.getByText("javascript:alert(1)")).toBeTruthy();
  expect(resultado.baseElement.querySelector("a[href^='javascript:'],script,img")).toBeNull();
  expect(acoes.salvar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("decisão aprovada pode ser bloqueada e decisão bloqueada retorna somente à revisão explícita", async () => {
  const aprovada = { ...regra, atual: { ...versao, estado: "APROVADA" } };
  const primeiro = preparar(true, [aprovada]);
  expect(screen.queryByRole("button", { name: "Aprovar internamente" })).toBeNull();
  expect(screen.getByRole("button", { name: "Bloquear decisão" })).toBeTruthy();
  primeiro.unmount();
  const bloqueada = { ...regra, atual: { ...versao, estado: "BLOQUEADA" } };
  preparar(true, [bloqueada]);
  expect(screen.getByText("Bloqueada")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Aprovar internamente" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Bloquear decisão" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Enviar para revisão" }));
  await screen.findByRole("dialog", { name: "Enviar decisão para revisão" });
  expect(acoes.revisar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("parágrafos legítimos e colagem preservam LF, removem controles e não salvam automaticamente", async () => {
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={vi.fn()} />);
  const usuario = userEvent.setup(), campo = screen.getByLabelText("Justificativa da decisão") as HTMLTextAreaElement;
  await usuario.clear(campo); await usuario.click(campo);
  await usuario.paste("Primeiro parágrafo.\r\nSegundo\t parágrafo.\u0000\u001b\u007f");
  expect(campo.value).toBe("Primeiro parágrafo.\nSegundo parágrafo.");
  fireEvent.blur(campo); expect(acoes.salvar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Salvar proposta" }));
  await waitFor(() => expect(acoes.salvar).toHaveBeenCalledTimes(1));
  expect(acoes.salvar.mock.calls[0][0]).toMatchObject({ fundamentacaoFiscal: { justificativa: "Primeiro parágrafo.\nSegundo parágrafo." } });
  expect(normalizarTextoFormularioFiscal("A\rB\nC\t\u0001", 5)).toBe("A\nB\nC");
});
it("colagem respeita limite e preserva texto após a seleção sem apagá-lo", async () => {
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historico} fechar={vi.fn()} />);
  const usuario = userEvent.setup(), campo = screen.getByLabelText("Justificativa da decisão") as HTMLTextAreaElement;
  fireEvent.change(campo, { target: { value: "A".repeat(1990) + "FIM" } });
  await usuario.click(campo); campo.setSelectionRange(1990, 1990);
  await usuario.paste("B".repeat(30));
  expect(campo.value).toBe("A".repeat(1990) + "B".repeat(7) + "FIM");
  expect(campo.value.length).toBe(2000);
  expect(acoes.salvar).not.toHaveBeenCalled();
});
function historicoItemDasFicticio(): HistoricoRegraBrasilNfe {
  return { ...historico, alvo: "PRODUTO", produtoId: "produto-ficticio", versoes: [{ ...historico.versoes[0], conteudo: { tipo: "ITEM", perfil: { classificacoes: { ncm: "", cest: "", origem: "", cfop: "", csosn: "", cstIcms: "", pis: "", cofins: "", ipi: "", fcp: "", ean: "", unidadeTributavel: "" }, cestAplicavel: false, fatorTributavel: "1", icms: { tratamento: "SEM_DESTAQUE" }, pis: { tratamento: "SEM_DESTAQUE" }, cofins: { tratamento: "SEM_DESTAQUE" }, ipiAplicavel: false, stAplicavel: false, fcpAplicavel: false, difalAplicavel: false, ibsCbsAplicavel: false, beneficioFiscalAplicavel: false } } }] };
}
it("GTIN exige escolha da unidade final e limita código sem salvar automaticamente", async () => {
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historicoItemDasFicticio()} fechar={vi.fn()} />);
  const usuario = userEvent.setup();
  expect(screen.queryByLabelText("EAN / GTIN")).toBeNull();
  await usuario.click(screen.getByRole("combobox", { name: "GTIN da unidade final" }));
  await usuario.click(await screen.findByRole("option", { name: "Possui GTIN próprio" }));
  const campo = screen.getByLabelText("EAN / GTIN") as HTMLInputElement;
  expect(campo.value).toBe(""); expect(campo.maxLength).toBe(14);
  expect(screen.getByText(/Confirme o código da unidade vendida/)).toBeTruthy();
  await usuario.type(campo, "letras"); expect(campo.value).toBe("");
  await usuario.click(campo); await usuario.paste("0123456789012"); expect(campo.value).toBe("0123456789012");
  fireEvent.blur(campo); expect(acoes.salvar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("combobox", { name: "GTIN da unidade final" }));
  await usuario.click(await screen.findByRole("option", { name: "Não possui · SEM GTIN confirmado" }));
  expect(screen.queryByLabelText("EAN / GTIN")).toBeNull();
  expect(acoes.salvar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
});
it.each(["PIS", "COFINS"])("DAS em %s exige seleção explícita sem preencher CST/alíquota ou salvar", async tributo => {
  const dado = historicoItemDasFicticio(), usuario = userEvent.setup();
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={dado} fechar={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: "Tratamento de PIS" }).textContent).toContain("Sem destaque");
  expect(screen.getByRole("combobox", { name: "Tratamento de COFINS" }).textContent).toContain("Sem destaque");
  expect((screen.getByLabelText("CST PIS") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("CST COFINS") as HTMLInputElement).value).toBe("");
  await usuario.click(screen.getByRole("combobox", { name: `Tratamento de ${tributo}` }));
  await usuario.click(await screen.findByRole("option", { name: "Recolhido no DAS · CST 49/99" }));
  expect(screen.getByRole("combobox", { name: `Tratamento de ${tributo}` }).textContent).toContain("Recolhido no DAS");
  expect(screen.queryByLabelText(`Alíquota de ${tributo} (%)`)).toBeNull();
  expect((screen.getByLabelText("CST PIS") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("CST COFINS") as HTMLInputElement).value).toBe("");
  expect(acoes.salvar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("ICMS conserva somente os tratamentos anteriores, sem opção de DAS", async () => {
  const usuario = userEvent.setup();
  render(<FormularioRegraBrasilNfe catalogos={catalogos} historico={historicoItemDasFicticio()} fechar={vi.fn()} />);
  await usuario.click(screen.getByRole("combobox", { name: "Tratamento de ICMS" }));
  expect(await screen.findByRole("option", { name: "Tributado" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Recolhido no DAS · CST 49/99" })).toBeNull();
  await usuario.click(screen.getByRole("option", { name: "Sem destaque" }));
  expect(screen.queryByLabelText("Alíquota de ICMS (%)")).toBeNull();
  expect((screen.getByLabelText("CST PIS") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("CST COFINS") as HTMLInputElement).value).toBe("");
  expect(acoes.salvar).not.toHaveBeenCalled(); expect(acoes.aprovar).not.toHaveBeenCalled();
});
it("montagem e histórico DAS conservam escolha e descartam bases/alíquotas ocultas do rascunho", () => {
  const dado = historicoItemDasFicticio(), inicial = camposIniciaisRegraBrasilNfe(dado);
  inicial.campos.pisTratamento = "RECOLHIDO_DAS"; inicial.campos.cofinsTratamento = "RECOLHIDO_DAS";
  inicial.campos.pisAliquota = "3.1234"; inicial.campos.cofinsAliquota = "5.0001";
  const entrada = montarRascunhoFormularioBrasilNfe(inicial.campos, [], dado) as { conteudo: { tipo: "ITEM"; perfil: { pis: object; cofins: object } } };
  expect(entrada.conteudo.perfil.pis).toEqual({ tratamento: "RECOLHIDO_DAS" });
  expect(entrada.conteudo.perfil.cofins).toEqual({ tratamento: "RECOLHIDO_DAS" });
  const versaoDas = { ...dado, versoes: dado.versoes.map(v => { if (v.conteudo.tipo !== "ITEM") throw new Error("Fixture incorreta"); return { ...v, conteudo: { ...v.conteudo, perfil: { ...v.conteudo.perfil, pis: { tratamento: "RECOLHIDO_DAS" as const }, cofins: { tratamento: "RECOLHIDO_DAS" as const } } } }; }) };
  const restaurada = camposIniciaisRegraBrasilNfe(versaoDas);
  expect(restaurada.campos.pisTratamento).toBe("RECOLHIDO_DAS"); expect(restaurada.campos.cofinsTratamento).toBe("RECOLHIDO_DAS");
  expect(restaurada.campos.pisAliquota).toBeUndefined(); expect(restaurada.campos.cofinsAliquota).toBeUndefined();
  render(<HistoricoRegraDialog historico={versaoDas} responsaveis={{}} fechar={vi.fn()} />);
  expect(screen.getAllByText("Recolhido no DAS · CST 49/99 · sem destaque de base ou alíquota")).toHaveLength(2);
  expect(acoes.salvar).not.toHaveBeenCalled();
});
it("tratamentos anteriores e precisão continuam preservados sem escolha de DAS", () => {
  const dado = historicoItemDasFicticio();
  const antigo = { ...dado, versoes: dado.versoes.map(v => { if (v.conteudo.tipo !== "ITEM") throw new Error("Fixture incorreta"); return { ...v, conteudo: { ...v.conteudo, perfil: { ...v.conteudo.perfil, pis: { tratamento: "TRIBUTADO" as const, Aliquota: "1.2345" }, cofins: { tratamento: "TRIBUTADO" as const, Aliquota: "7.0001" } } } }; }) };
  const inicial = camposIniciaisRegraBrasilNfe(antigo);
  expect(montarRascunhoFormularioBrasilNfe(inicial.campos, [], antigo)).toMatchObject({ conteudo: { perfil: { icms: { tratamento: "SEM_DESTAQUE" }, pis: { tratamento: "TRIBUTADO", Aliquota: "1.2345" }, cofins: { tratamento: "TRIBUTADO", Aliquota: "7.0001" } } } });
  expect(resumoConteudoRegraBrasilNfe(antigo.versoes[0].conteudo)).toContainEqual(["PIS", "Tributado · 1.2345%"]);
  expect(resumoConteudoRegraBrasilNfe(dado.versoes[0].conteudo)).toContainEqual(["PIS", "Sem destaque"]);
  inicial.campos.icmsTratamento = "RECOLHIDO_DAS";
  expect(() => montarRascunhoFormularioBrasilNfe(inicial.campos, [], antigo)).toThrow("Confira o tratamento de ICMS.");
});
