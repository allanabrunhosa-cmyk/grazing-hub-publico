vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
const simulacao = vi.hoisted(() => {
  const banco = {
    $queryRaw: vi.fn(), notaFiscalRecebida: { findUniqueOrThrow: vi.fn() },
    cancelamentoCompra: { findUnique: vi.fn().mockResolvedValue(null) },
    notaFiscalDuplicata: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    categoriaFinanceira: { findFirst: vi.fn(), findUnique: vi.fn() }, insumo: { findUnique: vi.fn() }, fornecedor: { findUnique: vi.fn() },
    formaPagamento: { upsert: vi.fn() },
    notaFiscalItem: { findUnique: vi.fn(), update: vi.fn() },
    lancamentoFinanceiro: { create: vi.fn() }, notaFiscalItemLancamento: { create: vi.fn() },
    fornecedorNotaVinculo: { findUnique: vi.fn() }, insumoCodigoFornecedor: { upsert: vi.fn() }, insumoFornecedor: { upsert: vi.fn() },
  };
  return { banco, transacao: vi.fn(), movimentar: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: { ...simulacao.banco, $transaction: simulacao.transacao } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn().mockResolvedValue({userId:"teste"}) }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: vi.fn() }));
vi.mock("@/lib/sefaz/busca-agendada", () => ({ agendarBusca: vi.fn() }));
vi.mock("@/lib/estoque/registrarMovimentacao", () => ({ registrarMovimentacao: simulacao.movimentar }));
import { confirmarConciliacaoNotaAction } from "@/app/(protegido)/notas-fiscais/actions";
const entrada = {
  notaFiscalId:"nota",localId:"local",dataEntradaEstoque:"2024-02-29",
  itens:[{notaFiscalItemId:"item",acao:"CONCILIAR" as const,destino:"ESTOQUE" as const,insumoId:"insumo",quantidade:2,valorTotal:100,modoCusto:"MEDIA" as const}],
  duplicatas:[{id:"parcela",numero:"001",dataVencimento:"2024-03-30",valor:100}],
};
beforeEach(() => {
  vi.clearAllMocks();
  simulacao.banco.formaPagamento.upsert.mockResolvedValue({id:"boleto"});
  simulacao.transacao.mockImplementation(async executar => executar(simulacao.banco));
  simulacao.banco.notaFiscalRecebida.findUniqueOrThrow.mockResolvedValue({id:"nota",chaveAcesso:"0".repeat(44),fornecedorCnpj:null,dataEmissao:new Date("2024-02-20T12:00:00Z"),ultimaManifestacao:"CONFIRMACAO_DA_OPERACAO"});
  simulacao.banco.notaFiscalDuplicata.findMany.mockResolvedValue([{...entrada.duplicatas[0],dataVencimento:new Date("2024-03-30T12:00:00Z"),_count:{lancamentos:0}}]);
  simulacao.banco.notaFiscalItem.findUnique.mockResolvedValue({id:"item",notaFiscalId:"nota",status:"PENDENTE",numeroItem:1,descricaoProduto:"Queijo"});
  simulacao.banco.categoriaFinanceira.findFirst.mockResolvedValue({id:"cmv"});
  simulacao.banco.insumo.findUnique.mockResolvedValue({nome:"Queijo",categoriaFinanceiraId:null});
  simulacao.banco.categoriaFinanceira.findUnique.mockResolvedValue({id:"consumo",ativo:true,excluidoEm:null,grupo:"DESPESAS_OPERACIONAIS"});
  simulacao.banco.lancamentoFinanceiro.create.mockResolvedValue({id:"lancamento"});
  simulacao.movimentar.mockResolvedValue({movimentacaoId:"movimento"});
});
describe("entrada efetiva da NF independente das datas financeiras", () => {
  it("envia a data escolhida ao estoque, preservando competência e vencimento", async () => {
    expect(await confirmarConciliacaoNotaAction(entrada)).toEqual({ok:true,movimentacoesCriadas:1});
    expect(simulacao.movimentar).toHaveBeenCalledWith(expect.objectContaining({data:new Date("2024-02-29T15:00:00Z"),quantidade:2}));
    expect(simulacao.banco.lancamentoFinanceiro.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({dataCompetencia:new Date("2024-02-20T12:00:00Z"),dataVencimento:new Date("2024-03-30T12:00:00Z")})}));
  });
  it.each([undefined,"","2024-02-30","9999-01-01"])("não grava estoque nem parcelas com entrada inválida: %s", async dataEntradaEstoque => {
    expect(await confirmarConciliacaoNotaAction({...entrada,dataEntradaEstoque})).toHaveProperty("erro");
    expect(simulacao.transacao).not.toHaveBeenCalled();
    expect(simulacao.movimentar).not.toHaveBeenCalled();
  });
  it("reenvio com outra data não move novamente um item conciliado", async () => {
    simulacao.banco.notaFiscalItem.findUnique.mockResolvedValue({id:"item",notaFiscalId:"nota",status:"CONCILIADO"});
    expect(await confirmarConciliacaoNotaAction({...entrada,dataEntradaEstoque:"2024-03-01"})).toEqual({ok:true,movimentacoesCriadas:0});
    expect(simulacao.movimentar).not.toHaveBeenCalled();
    expect(simulacao.banco.notaFiscalItem.update).not.toHaveBeenCalled();
  });
  it("uso e consumo não exige data de entrada e não movimenta estoque", async () => {
    expect(await confirmarConciliacaoNotaAction({...entrada,dataEntradaEstoque:undefined,itens:[{notaFiscalItemId:"item",acao:"CONCILIAR",destino:"USO_E_CONSUMO",categoriaFinanceiraId:"consumo",valorTotal:100}]})).toEqual({ok:true,movimentacoesCriadas:0});
    expect(simulacao.movimentar).not.toHaveBeenCalled();
  });
});
