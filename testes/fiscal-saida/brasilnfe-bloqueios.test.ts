import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdaptadorFiscalSaida } from "@/lib/fiscal-saida/contrato";
const sim = vi.hoisted(() => ({ adapter: null as AdaptadorFiscalSaida | null, transacao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: sim.transacao } }));
vi.mock("@/lib/vendas/pedidos", () => ({ conferirAcesso: vi.fn() }));
vi.mock("@/lib/ifood/acompanhamento", () => ({ acompanhamentoDoPedido: vi.fn(), exigirEfeitoOperacional: vi.fn() }));
vi.mock("@/lib/fiscal-saida/provedor", () => ({ obterAdaptadorFiscalSaida: () => sim.adapter, BLOQUEIO_PRODUCAO_FISCAL_SAIDA: "Produção fiscal bloqueada no marco 1." }));
import { aplicarRetornoFiscalSaida, obterArquivosFiscalSaida, processarFiscalSaida, solicitarAcaoFiscalSaida } from "@/lib/fiscal-saida/servico";
import { POST } from "@/app/api/fiscal-saida/retorno/route";
import type { SessaoAtual } from "@/lib/session";
const sessao = { userId: "autor-ficticio" } as SessaoAtual;
function adaptador(ambiente: "PRODUCAO" | "HOMOLOGACAO", bloqueioOperacional?: string): AdaptadorFiscalSaida { return { id: "BRASIL_NFE", ambiente, bloqueioOperacional, enviar: vi.fn(), consultar: vi.fn(), cancelar: vi.fn(), obterDocumentos: vi.fn(), autenticarRetorno: vi.fn() }; }
describe("Bloqueios M1 nas fronteiras da fila e callback", () => {
  beforeEach(() => { vi.clearAllMocks(); sim.adapter = null; });
  it.each(["PRODUCAO", "HOMOLOGACAO"] as const)("bloqueia adaptador %s antes de banco/efeitos/consulta externa", async ambiente => {
    const a = sim.adapter = adaptador(ambiente, ambiente === "HOMOLOGACAO" ? "Operação bloqueada no marco 1" : undefined);
    for (const acao of ["ENVIAR", "CONSULTAR", "CANCELAR"] as const) await expect(solicitarAcaoFiscalSaida("doc-ficticio", acao, "Justificativa fictícia suficiente", sessao)).rejects.toThrow(acao === "CONSULTAR" ? "bloqueada" : "Emissão ainda não liberada");
    expect(await processarFiscalSaida()).toMatchObject({ processado: false });
    await expect(obterArquivosFiscalSaida("doc-ficticio", sessao)).rejects.toThrow("bloqueada");
    await expect(aplicarRetornoFiscalSaida(a, { documentoId: "doc-ficticio", eventoId: "ficticio", sequencia: 1, status: "PROCESSANDO" })).rejects.toThrow("bloqueada");
    expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    expect(sim.transacao).not.toHaveBeenCalled();
    for (const metodo of [a.enviar, a.consultar, a.cancelar, a.obterDocumentos, a.autenticarRetorno]) expect(metodo).not.toHaveBeenCalled();
  });
  it("sem registro operacional não executa processador nem aceita callback", async () => {
    expect(await processarFiscalSaida()).toEqual({ processado: false, mensagem: "Emissor não configurado" });
    expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    expect(sim.transacao).not.toHaveBeenCalled();
  });
});
