import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), preparar: vi.fn(), emitir: vi.fn(), emitirDireta: vi.fn(), consultarPedido: vi.fn(), recuperar: vi.fn(), consultar: vi.fn(), arquivos: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: sim.revalidar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("@/lib/fiscal-saida/brasilnfe/operacional", () => ({ prepararEmissaoPedidoBrasilNfe: sim.preparar, emitirNotaPedidoBrasilNfe: sim.emitir, consultarEmissaoPedidoBrasilNfe: sim.consultar, obterDocumentosEmissaoPedidoBrasilNfe: sim.arquivos, ErroEmissaoPedidoBrasilNfe: class extends Error {} }));
vi.mock("@/lib/fiscal-saida/brasilnfe/emissao-direta", () => ({ emitirNotaPedidoDiretaBrasilNfe: sim.emitirDireta, consultarResultadoEmissaoPedidoBrasilNfe: sim.consultarPedido, obterResultadoLocalEmissaoPedidoBrasilNfe: sim.recuperar }));
import { prepararEmissaoPedidoBrasilNfeAction, emitirNotaPedidoBrasilNfeAction, consultarEmissaoPedidoBrasilNfeAction, obterDocumentosEmissaoPedidoBrasilNfeAction, emitirNotaPedidoDiretaBrasilNfeAction, consultarResultadoEmissaoPedidoBrasilNfeAction } from "@/app/(protegido)/vendas/pedidos/emissao-actions";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
import { ErroConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dominio";
import { ErroTransmissaoFiscalBloqueadaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";
import { ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { ErroConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { ErroValidacaoSnapshotBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
const sessao = { userId: "operador-sintetico", nome: "Operador de teste" };
beforeEach(() => { vi.resetAllMocks(); sim.guarda.mockResolvedValue(sessao); });
const operacoes = [
  ["preparação", () => prepararEmissaoPedidoBrasilNfeAction("pedido-sintetico", 2, 55, "HOMOLOGACAO"), sim.preparar],
  ["transmissão individual", () => emitirNotaPedidoBrasilNfeAction({ documentoId: "documento-sintetico" }), sim.emitir],
  ["consulta do próprio documento", () => consultarEmissaoPedidoBrasilNfeAction("documento-sintetico"), sim.consultar],
  ["documentos", () => obterDocumentosEmissaoPedidoBrasilNfeAction("documento-sintetico"), sim.arquivos],
] as const;
const entradaDireta = { pedidoId: "pedido-sintetico", versaoPedido: 2, modelo: 65 as const };
it.each([
  ["emissão direta", () => emitirNotaPedidoDiretaBrasilNfeAction(entradaDireta), sim.emitirDireta],
  ["recuperação do resultado", () => consultarResultadoEmissaoPedidoBrasilNfeAction(entradaDireta.pedidoId), sim.consultarPedido],
] as const)("%s confere permissão central e retorna o contrato seguro do serviço", async (_nome, agir, servico) => {
  const resultado = { ok: true, documento: { id: "documento-sintetico", status: "AUTORIZADO" }, conferirAntesDeRepetir: true }; servico.mockResolvedValue(resultado);
  expect(await agir()).toEqual(resultado); expect(sim.guarda).toHaveBeenCalledExactlyOnceWith("vendas.fiscal", "editar"); expect(servico.mock.calls[0].at(-1)).toBe(sessao);
  expect(sim.revalidar).toHaveBeenCalledWith("/vendas/pedidos", "layout"); expect(sim.revalidar).toHaveBeenCalledWith("/financeiro/fiscal");
});
it.each([
  ["emissão direta", () => emitirNotaPedidoDiretaBrasilNfeAction(entradaDireta), sim.emitirDireta],
  ["recuperação do resultado", () => consultarResultadoEmissaoPedidoBrasilNfeAction(entradaDireta.pedidoId), sim.consultarPedido],
] as const)("%s sem permissão não prepara, transmite nem recupera dados", async (_nome, agir, servico) => {
  sim.guarda.mockRejectedValue(new Error("Permissão recusada")); await expect(agir()).rejects.toThrow("Permissão recusada");
  expect(servico).not.toHaveBeenCalled(); expect(sim.recuperar).not.toHaveBeenCalled(); expect(sim.revalidar).not.toHaveBeenCalled();
});
it("falha de transporte conserva documento local e bloqueia repetição direta", async () => {
  const documento = { id: "documento-sintetico", status: "PENDENTE_CONFERENCIA" }; sim.emitirDireta.mockRejectedValue(new ErroHttpBrasilNfe("TIMEOUT")); sim.recuperar.mockResolvedValue({ documento });
  expect(await emitirNotaPedidoDiretaBrasilNfeAction(entradaDireta)).toEqual({ erro: expect.stringContaining("não respondeu no prazo"), documento, conferirAntesDeRepetir: true });
  expect(sim.recuperar).toHaveBeenCalledExactlyOnceWith(entradaDireta.pedidoId, sessao); expect(sim.emitirDireta).toHaveBeenCalledTimes(1); expect(sim.consultarPedido).not.toHaveBeenCalled();
});
it("falha na própria recuperação não mascara a incerteza nem expõe segredos", async () => {
  sim.emitirDireta.mockRejectedValue(new Error("Token=SEGREDO_SINTETICO")); sim.recuperar.mockRejectedValue(new Error("Banco SEGREDO_SINTETICO"));
  expect(await emitirNotaPedidoDiretaBrasilNfeAction(entradaDireta)).toEqual({ erro: "A ação não foi confirmada. Consulte o documento antes de qualquer novo envio.", documento: null, conferirAntesDeRepetir: true });
});
it("recuperação sem resposta preserva documento para nova consulta, nunca reemite", async () => {
  const documento = { id: "documento-sintetico", status: "INCERTO" }; sim.consultarPedido.mockRejectedValue(new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA")); sim.recuperar.mockResolvedValue({ documento });
  expect(await consultarResultadoEmissaoPedidoBrasilNfeAction(entradaDireta.pedidoId)).toMatchObject({ documento, conferirAntesDeRepetir: true, erro: expect.any(String) }); expect(sim.emitirDireta).not.toHaveBeenCalled(); expect(sim.emitir).not.toHaveBeenCalled();
});
it.each(operacoes)("%s confere permissão central antes do serviço", async (_nome, agir, servico) => {
  servico.mockResolvedValue({ status: "PREPARADO" });
  expect(await agir()).toHaveProperty("ok", true);
  expect(sim.guarda).toHaveBeenCalledExactlyOnceWith("vendas.fiscal", "editar");
  expect(servico).toHaveBeenCalledTimes(1);
  expect(servico.mock.calls[0].at(-1)).toBe(sessao);
  expect(sim.revalidar).toHaveBeenCalledWith("/vendas/pedidos", "layout");
  expect(sim.revalidar).toHaveBeenCalledWith("/financeiro/fiscal");
});
it.each(operacoes)("%s sem permissão não chama serviços nem revalida", async (_nome, agir, servico) => {
  sim.guarda.mockRejectedValue(new Error("Permissão recusada"));
  await expect(agir()).rejects.toThrow("Permissão recusada");
  expect(servico).not.toHaveBeenCalled(); expect(sim.revalidar).not.toHaveBeenCalled();
});
it("preparar e consultar não transmitem, mesmo com credenciais configuradas no servidor", async () => {
  sim.preparar.mockResolvedValue({ documento: { id: "documento-sintetico" } });
  await prepararEmissaoPedidoBrasilNfeAction("pedido-sintetico", 2, 55, "HOMOLOGACAO");
  await consultarEmissaoPedidoBrasilNfeAction("documento-sintetico");
  expect(sim.emitir).not.toHaveBeenCalled();
});
it("encaminha a presença selecionada sem aprovar regras ou transmitir na preparação", async () => {
  sim.preparar.mockResolvedValue({ documento: null });
  const contexto = { indicadorPresenca: 2 as const };
  await prepararEmissaoPedidoBrasilNfeAction("pedido-sintetico", 2, 55, "PRODUCAO", contexto);
  expect(sim.preparar).toHaveBeenCalledExactlyOnceWith("pedido-sintetico", 2, 55, "PRODUCAO", sessao, contexto);
  expect(sim.emitir).not.toHaveBeenCalled();
  expect(sim.preparar.mock.calls[0][5]).not.toHaveProperty("revisaoConsolidada");
});
it("erro desconhecido não expõe causa, mensagens externas ou credenciais", async () => {
  sim.emitir.mockRejectedValue(new Error("Token=credencial-ficticia UserToken=segredo-ficticio", { cause: { respostaCompleta: "Nunca retornar" } }));
  const resultado = await emitirNotaPedidoBrasilNfeAction({ documentoId: "documento-sintetico" });
  expect(resultado).toEqual({ erro: "A ação não foi confirmada. Consulte o documento antes de qualquer novo envio." });
  expect(JSON.stringify(resultado)).not.toMatch(/Token|segredo-ficticio|respostaCompleta|cause/);
  expect(sim.emitir).toHaveBeenCalledTimes(1); expect(sim.consultar).not.toHaveBeenCalled();
});
it.each([
  new ErroEstruturaFiscal("A versão fiscal mudou. Atualize a revisão antes de aprovar."),
  new ErroConfiguracaoBrasilNfe("A configuração protegida mudou. Reabra a revisão."),
  new ErroTransmissaoFiscalBloqueadaBrasilNfe(),
  new ErroHttpBrasilNfe("CREDENCIAL_INVALIDA"),
  new ErroConsultaBrasilNfe("IDENTIDADE_DIVERGENTE"),
  new ErroValidacaoSnapshotBrasilNfe("Produto sintético: falta NCM."),
])("apresenta somente a mensagem do erro local autorizado %s, sem serializar causa ou objeto", async erro => {
  Object.defineProperty(erro, "cause", { value: { Token: "SEGREDO_SINTETICO_NAO_RETORNAR", resposta: "OBJETO_EXTERNO_PRIVADO" } });
  sim.emitir.mockRejectedValue(erro);
  const resultado = await emitirNotaPedidoBrasilNfeAction({ documentoId: "documento-sintetico" });
  expect(resultado).toEqual({ erro: erro.message }); expect(JSON.stringify(resultado)).not.toMatch(/SEGREDO_SINTETICO|OBJETO_EXTERNO|cause/);
});
it("não confia no nome externo de um Error que imita uma classe local", async () => {
  const erro = new Error("Token=SEGREDO_SINTETICO_NAO_RETORNAR"); erro.name = "ErroEstruturaFiscal"; sim.emitir.mockRejectedValue(erro);
  expect(await emitirNotaPedidoBrasilNfeAction({ documentoId: "documento-sintetico" })).toEqual({ erro: "A ação não foi confirmada. Consulte o documento antes de qualquer novo envio." });
});
