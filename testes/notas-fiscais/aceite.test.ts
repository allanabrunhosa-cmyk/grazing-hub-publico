vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntradaConciliacao } from "@/lib/notas-fiscais/validar-conciliacao";

const simulacao = vi.hoisted(() => ({
  sessao: vi.fn(), manifestar: vi.fn(), conciliar: vi.fn(), trava: vi.fn(), nota: vi.fn(),
  local: vi.fn(), cmv: vi.fn(), categoria: vi.fn(), insumo: vi.fn(), transacao: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: simulacao.transacao } }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: simulacao.manifestar }));
vi.mock("@/app/(protegido)/notas-fiscais/actions", () => ({ confirmarConciliacaoNotaAction: simulacao.conciliar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { aceitarNotaAction } from "@/app/(protegido)/notas-fiscais/aceitar-nota";

const entrada: EntradaConciliacao = {
  notaFiscalId: "nota", localId: "local", dataEntradaEstoque: "2024-02-29",
  itens: [{ notaFiscalItemId: "item", acao: "CONCILIAR", destino: "ESTOQUE", insumoId: "insumo", quantidade: 2, valorTotal: 100, modoCusto: "MEDIA" }],
  duplicatas: [{ id: "parcela", numero: "001", dataVencimento: "2026-10-10", valor: 100 }],
};
const nota = {
  id: "nota", tipo: "PROC_NFE", xml: '<nfeProc><NFe><infNFe><det nItem="1"><prod><vProd>100</vProd></prod></det><total><ICMSTot><vProd>100</vProd><vNF>100</vNF></ICMSTot></total></infNFe></NFe></nfeProc>', chaveAcesso: "0".repeat(44), ultimaManifestacao: null,
  itens: [{ id: "item", numeroItem: 1, status: "PENDENTE" }],
  duplicatas: [{ ...entrada.duplicatas[0], dataVencimento: new Date("2026-10-10T12:00:00Z"), _count: { lancamentos: 0 } }],
};
beforeEach(() => {
  vi.resetAllMocks();
  simulacao.sessao.mockResolvedValue({ userId: "usuario" });
  simulacao.transacao.mockImplementation(async (executar) => executar({
    $queryRaw: simulacao.trava, notaFiscalRecebida: { findUnique: simulacao.nota },
    cancelamentoCompra: { findUnique: vi.fn().mockResolvedValue(null) },
    localEstoque: { findUnique: simulacao.local }, insumo: { findUnique: simulacao.insumo },
    categoriaFinanceira: { findUnique: simulacao.categoria, findFirst: simulacao.cmv },
  }));
  simulacao.trava.mockResolvedValue([{ obtida: true }]);
  simulacao.nota.mockResolvedValue(nota);
  simulacao.local.mockResolvedValue({ id: "local" });
  simulacao.insumo.mockResolvedValue({ id: "insumo" });
  simulacao.cmv.mockResolvedValue({ id: "cmv" });
  simulacao.categoria.mockResolvedValue({ id: "consumo", ativo: true, grupo: "DESPESAS_OPERACIONAIS" });
  simulacao.manifestar.mockResolvedValue({ sucesso: true, protocolo: "teste" });
  simulacao.conciliar.mockResolvedValue({ ok: true, movimentacoesCriadas: 1 });
});

describe("aceite integrado à conciliação", () => {
  it("rejeita omissão de frete antes do envio fiscal", async () => {
    simulacao.nota.mockResolvedValue({ ...nota, xml: nota.xml.replace("</prod>", "<vFrete>10</vFrete></prod>") });
    expect(await aceitarNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("frete") });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("rejeita total adulterado antes do envio fiscal", async () => {
    expect(await aceitarNotaAction({ ...entrada, distribuicaoDesconto: { modo: "NOTA", itens: [] }, itens: [{ ...entrada.itens[0], valorTotal: 80 }] } as EntradaConciliacao)).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("valida a classificação do insumo antes de enviar o aceite fiscal", async () => {
    simulacao.insumo.mockResolvedValue({ nome: "Salame", categoriaFinanceiraId: "charcutaria" });
    simulacao.categoria.mockResolvedValue({ id: "charcutaria", ativo: false, grupo: "CMV" });
    expect(await aceitarNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("categoria financeira") });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("registra o aceite antes de gravar estoque e financeiro", async () => {
    expect(await aceitarNotaAction(entrada)).toEqual({ ok: true });
    expect(simulacao.manifestar).toHaveBeenCalledExactlyOnceWith(nota.chaveAcesso, "CONFIRMACAO_DA_OPERACAO");
    expect(simulacao.conciliar).toHaveBeenCalledExactlyOnceWith(entrada);
    expect(simulacao.manifestar.mock.invocationCallOrder[0]).toBeLessThan(simulacao.conciliar.mock.invocationCallOrder[0]);
  });
  it("não cria estoque nem despesas quando a SEFAZ rejeita", async () => {
    simulacao.manifestar.mockResolvedValue({ sucesso: false, mensagem: "Rejeição de teste" });
    expect(await aceitarNotaAction(entrada)).toEqual({ erro: "Rejeição de teste" });
    expect(simulacao.conciliar).not.toHaveBeenCalled();
  });
  it("informa aceite fiscal registrado se a conciliação falhar", async () => {
    simulacao.conciliar.mockResolvedValue({ erro: "Falha no banco" });
    expect(await aceitarNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("aceite fiscal já foi registrado") });
  });
  it("retoma conciliação sem reenviar uma confirmação registrada", async () => {
    simulacao.nota.mockResolvedValue({ ...nota, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
    expect(await aceitarNotaAction(entrada)).toEqual({ ok: true });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.conciliar).toHaveBeenCalledOnce();
  });
  it("reenvio de nota totalmente concluída não duplica nada", async () => {
    simulacao.nota.mockResolvedValue({ ...nota, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO", itens: [{ id: "item", status: "CONCILIADO" }] });
    expect(await aceitarNotaAction(entrada)).toEqual({ ok: true });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.conciliar).not.toHaveBeenCalled();
  });
  it("bloqueia outro aceite em andamento", async () => {
    simulacao.trava.mockResolvedValue([{ obtida: false }]);
    expect(await aceitarNotaAction(entrada)).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("exige sessão", async () => {
    simulacao.sessao.mockResolvedValue(null);
    expect(await aceitarNotaAction(entrada)).toHaveProperty("erro");
    expect(simulacao.transacao).not.toHaveBeenCalled();
  });
  it.each([
    { ...entrada, dataEntradaEstoque: undefined },
    { ...entrada, dataEntradaEstoque: "2024-02-30" },
    { ...entrada, dataEntradaEstoque: "9999-01-01" },
    { ...entrada, itens: [] },
    { ...entrada, itens: [{ notaFiscalItemId: "item", acao: "IGNORAR" }] },
    { ...entrada, itens: [{ ...entrada.itens[0], insumoId: "" }] },
    { ...entrada, itens: [{ ...entrada.itens[0], quantidade: 0 }] },
    { ...entrada, duplicatas: [] },
    { ...entrada, duplicatas: [{ ...entrada.duplicatas[0], dataVencimento: "2026-02-30" }] },
    { ...entrada, duplicatas: [{ ...entrada.duplicatas[0], id: "outra-nota" }] },
    { ...entrada, itens: [...entrada.itens, ...entrada.itens] },
  ])("bloqueia dados incompletos/inválidos antes de qualquer envio (%#)", async (dados) => {
    expect(await aceitarNotaAction(dados as EntradaConciliacao)).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.conciliar).not.toHaveBeenCalled();
  });
  it("bloqueia alteração de parcelas que já geraram despesas", async () => {
    simulacao.nota.mockResolvedValue({ ...nota, duplicatas: nota.duplicatas.map((parcela) => ({ ...parcela, _count: { lancamentos: 1 } })) });
    expect(await aceitarNotaAction({ ...entrada, duplicatas: [{ ...entrada.duplicatas[0], valor: 50 }] })).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("exige categoria de despesa ativa para uso e consumo", async () => {
    simulacao.categoria.mockResolvedValue({ ativo: true, grupo: "RECEITA_BRUTA" });
    expect(await aceitarNotaAction({ ...entrada, itens: [{ notaFiscalItemId: "item", acao: "CONCILIAR", destino: "USO_E_CONSUMO", categoriaFinanceiraId: "receita", valorTotal: 100 }] })).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
