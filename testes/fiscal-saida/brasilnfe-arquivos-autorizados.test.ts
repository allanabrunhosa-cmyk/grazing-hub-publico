import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdaptadorFiscalSaida } from "@/lib/fiscal-saida/contrato";
import type { SessaoAtual } from "@/lib/session";
const s = vi.hoisted(() => ({ obter: vi.fn(), consultar: vi.fn(), enviar: vi.fn(), cancelar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/fiscal-saida/servico", () => ({ obterArquivosFiscalSaidaManual: s.obter, consultarFiscalSaida: s.consultar }));
import { completarArquivosAposAutorizacao } from "@/lib/fiscal-saida/brasilnfe/arquivos-autorizados";

const sessao = { userId: "usuario-ficticio" } as SessaoAtual;
const adaptador = { id: "BRASIL_NFE", ambiente: "PRODUCAO", enviar: s.enviar, cancelar: s.cancelar } as unknown as AdaptadorFiscalSaida;
const documento = { id: "documento-ficticio", pedidoId: "pedido-ficticio", status: "AUTORIZADO", ambiente: "PRODUCAO", provedor: "BRASIL_NFE", xmlDisponivel: false, formatoImpressao: null, tentativas: 1, chaveFiscal: "1".repeat(44), protocolo: "123456789", ultimoErro: null } as unknown as Parameters<typeof completarArquivosAposAutorizacao>[1];
beforeEach(() => vi.resetAllMocks());

describe("Arquivos após autorização, sem nova operação fiscal", () => {
  it.each(["PDF", "HTML"] as const)("obtém XML e impressão %s pelo serviço manual e devolve o resumo atualizado", async formatoImpressao => {
    const atualizado = { ...documento, xmlDisponivel: true, formatoImpressao };
    s.consultar.mockResolvedValue([atualizado]);
    expect(await completarArquivosAposAutorizacao(adaptador, documento, sessao)).toEqual(atualizado);
    expect(s.obter).toHaveBeenCalledExactlyOnceWith(adaptador, documento.id, sessao);
    expect(s.consultar).toHaveBeenCalledExactlyOnceWith(documento.pedidoId, sessao);
    expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled();
  });
  it("XML parcial fica disponível sem alterar autorização, identidade ou tentativa", async () => {
    s.consultar.mockResolvedValue([{ ...documento, xmlDisponivel: true }]);
    const r = await completarArquivosAposAutorizacao(adaptador, documento, sessao);
    expect(r).toMatchObject({ ...documento, xmlDisponivel: true, avisoArquivos: expect.stringContaining("A impressão ainda não está disponível") });
    expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled();
  });
  it("falha de arquivo preserva AUTORIZADO e mostra orientação segura para repetir o download", async () => {
    s.obter.mockRejectedValue(new Error("SEGREDO-EXTERNO-EXCLUSIVAMENTE-SINTETICO"));
    const r = await completarArquivosAposAutorizacao(adaptador, documento, sessao);
    expect(r).toMatchObject({ ...documento, avisoArquivos: expect.stringContaining("Use Obter documentos") });
    expect(JSON.stringify(r)).not.toContain("SEGREDO-EXTERNO");
    expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled();
  });
  it.each(["PDF", "HTML"] as const)("não baixa novamente quando XML e %s já existem", async formatoImpressao => {
    const completo = { ...documento, xmlDisponivel: true, formatoImpressao };
    expect(await completarArquivosAposAutorizacao(adaptador, completo, sessao)).toBe(completo);
    expect(s.obter).not.toHaveBeenCalled(); expect(s.consultar).not.toHaveBeenCalled();
  });
  it.each(["PROCESSANDO", "PENDENTE_CONFERENCIA", "REJEITADO", "CANCELADO", "DENEGADO"])("não obtém arquivos automaticamente para %s", async status => {
    const outro = { ...documento, status };
    expect(await completarArquivosAposAutorizacao(adaptador, outro, sessao)).toBe(outro);
    expect(s.obter).not.toHaveBeenCalled(); expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled();
  });
});
