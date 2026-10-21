import { beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ sessao: vi.fn(), evento: vi.fn(), fonte: vi.fn(), alvo: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  atividadeUsuario: { findFirst: sim.evento },
  historicoFinanceiroPedido: { findUnique: sim.fonte }, historicoCartao: { findUnique: sim.fonte },
  historicoCadastroVenda: { findUnique: sim.fonte }, produtoVenda: { findUnique: sim.alvo },
} }));
import { consultarDetalheAtividade } from "@/lib/atividades/consulta";
import { alteracoesPermitidas } from "@/lib/atividades/privacidade";
const evento = {
  id: "evento", ocorridoEm: new Date("2026-10-10T15:00:00Z"), autorId: "autor", autorNome: "Autor sintético",
  atorTipo: "USUARIO", atorReferencia: null, origem: "INTERFACE", modulo: "financeiro", recurso: "financeiro.movimentacoes",
  acao: "VENCIMENTO_AJUSTADO", entidade: "PedidoVenda", entidadeId: "pedido", resumo: "Vencimento ajustado.", resultado: "SUCESSO",
  fonteTabela: "HistoricoFinanceiroPedido", fonteId: "origem", antes: null, depois: null,
};
function leitor(permissoes: Record<string, string[]>) {
  sim.sessao.mockResolvedValue({ userId: "leitor", admin: false, permissoes: {
    "configuracoes.usuarios": ["visualizar"], "configuracoes.usuarios.atividades": ["visualizar"], ...permissoes,
  }, excecoes: {} });
}
beforeEach(() => { vi.resetAllMocks(); sim.evento.mockResolvedValue(evento); sim.alvo.mockResolvedValue(null); });
describe("projeção financeira permitida nos detalhes de atividades", () => {
  it("converte o histórico canônico de vencimento em antes/depois sem copiar detalhes privados", async () => {
    leitor({ "financeiro.movimentacoes": ["visualizar"] });
    sim.fonte.mockResolvedValue({ tipo: "VENCIMENTO_AJUSTADO", detalhes: {
      anterior: "2026-10-01T00:00:00.000Z", novo: "2026-10-15T00:00:00.000Z",
      tituloId: "titulo-privado", valor: "999.99", token: "segredo-sintetico", observacao: "Texto privado",
    } });
    const detalhe = await consultarDetalheAtividade("autor", "evento");
    expect(detalhe.alteracoes).toEqual([{ campo: "dataVencimento", antes: "2026-10-01T00:00:00.000Z", depois: "2026-10-15T00:00:00.000Z" }]);
    expect(detalhe.link).toBeNull();
    expect(JSON.stringify(detalhe)).not.toMatch(/titulo-privado|999.99|segredo|Texto privado|detalhes/);
    expect(sim.fonte).toHaveBeenCalledWith({ where: { id: "origem" }, select: { tipo: true, detalhes: true } });
  });
  it("recebimento expõe somente escalares financeiros autorizados", async () => {
    leitor({ "financeiro.movimentacoes": ["visualizar"] });
    sim.evento.mockResolvedValue({ ...evento, acao: "RECEBIMENTO" });
    sim.fonte.mockResolvedValue({ tipo: "RECEBIMENTO", detalhes: {
      recebido: "20.00", saldo: "80.00", valorOriginal: "100.00", token: "segredo-sintetico", contaId: "conta-privada", pagamentos: [{ numero: "proibido" }],
    } });
    const detalhe = await consultarDetalheAtividade("autor", "evento");
    expect(detalhe.alteracoes).toEqual(expect.arrayContaining([
      { campo: "recebido", antes: "—", depois: "20.00" }, { campo: "saldo", antes: "—", depois: "80.00" },
    ]));
    expect(JSON.stringify(detalhe)).not.toMatch(/segredo|conta-privada|proibido/);
  });
  it("acesso a faturas não concede os valores protegidos pela permissão de movimentações", async () => {
    leitor({ "financeiro.faturas": ["visualizar"] });
    sim.evento.mockResolvedValue({ ...evento, recurso: "financeiro.faturas", entidade: "CartaoCredito", fonteTabela: "HistoricoCartao" });
    sim.fonte.mockResolvedValue({ antes: { status: "ABERTA", recebido: "0.00", saldo: "100.00", taxa: "2.00" }, depois: { status: "FECHADA", recebido: "20.00", saldo: "80.00", taxa: "3.00" } });
    expect((await consultarDetalheAtividade("autor", "evento")).alteracoes).toEqual([{ campo: "status", antes: "ABERTA", depois: "FECHADA" }]);
    expect(sim.evento.mock.calls[0][0].where.recurso.in).not.toContain("financeiro.movimentacoes");
  });
  it.each([false, true])("custos do cadastro exigem também movimentações: %s", async movimentacoes => {
    leitor({ "vendas.produtos": ["visualizar"], "financeiro.custos": ["visualizar"], ...(movimentacoes ? { "financeiro.movimentacoes": ["visualizar"] } : {}) });
    sim.evento.mockResolvedValue({ ...evento, modulo: "cadastros", recurso: "vendas.produtos", entidade: "PRODUTO", fonteTabela: "HistoricoCadastroVenda" });
    sim.fonte.mockResolvedValue({ antes: { preco: "10.00", ativo: true }, depois: { preco: "20.00", ativo: false } });
    const alteracoes = (await consultarDetalheAtividade("autor", "evento")).alteracoes;
    expect(alteracoes.some(a => a.campo === "preco")).toBe(movimentacoes);
    expect(alteracoes).toContainEqual({ campo: "ativo", antes: "true", depois: "false" });
  });
  it("modo sem valores mantém datas e elimina todos os novos escalares financeiros", () => {
    expect(alteracoesPermitidas({ dataVencimento: "2026-10-01", recebido: "0", saldo: "100", valor: "100", taxa: "1", credito: "10" },
      { dataVencimento: "2026-10-15", recebido: "20", saldo: "80", valor: "90", taxa: "2", credito: "20" }, false))
      .toEqual([{ campo: "dataVencimento", antes: "2026-10-01", depois: "2026-10-15" }]);
  });
});
