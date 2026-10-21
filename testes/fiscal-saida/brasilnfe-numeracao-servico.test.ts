import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const banco = vi.hoisted(() => ({ config: { id: "singleton", versao: 3, tokenCifrado: "cifra-sintetica-token", userTokenCifrado: "cifra-sintetica-user" },
  loja: { id: "singleton", nome: "Emitente fictício", cnpj: "00000000000000", enderecoEstruturado: {} },
  usuario: { id: "usuario-ficticio", ativo: true, excluidoEm: null, sessaoVersao: 0, permissoesPersonalizadas: {}, perfilAcesso: { sistema: "ADMINISTRADOR", permissoes: {} } },
  eventos: [] as { id: string; tipo: string; dados: unknown; createdAt: Date }[],
  tx: { $executeRaw: vi.fn(), usuario: { findUnique: vi.fn() }, configuracaoBrasilNfe: { findUnique: vi.fn(), update: vi.fn() }, configuracaoLoja: { findUnique: vi.fn() }, eventoConfiguracaoBrasilNfe: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() }, documentoFiscalSaida: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((fn: (tx: typeof banco.tx) => Promise<unknown>) => fn(banco.tx)) } }));
vi.mock("@/lib/crypto", () => ({ cifrar: vi.fn(), decifrar: vi.fn((_cifra: string, contexto: string) => contexto.includes("usertoken") ? "usuario-sintetico-secreto" : "empresa-sintetica-secreta") }));
import { ClienteBrasilNfe, ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { consultarNumeracaoFiscalBrasilNfe, obterNumeracaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao";
import type { SessaoAtual } from "@/lib/session";
const sessao = { userId: "usuario-ficticio", versao: 0, admin: false, nome: "Pessoa fictícia", email: "ficticio@example.invalid", permissoes: {}, excecoes: {}, perfilNome: "Fictício" } as SessaoAtual;
beforeEach(() => {
  vi.restoreAllMocks(); banco.config.versao = 3; banco.usuario.ativo = true; banco.usuario.sessaoVersao = 0; banco.usuario.perfilAcesso = { sistema: "ADMINISTRADOR", permissoes: {} };
  banco.eventos = []; banco.loja.cnpj = "00000000000000";
  banco.tx.usuario.findUnique.mockImplementation(async () => banco.usuario);
  banco.tx.configuracaoBrasilNfe.findUnique.mockImplementation(async () => ({ ...banco.config }));
  banco.tx.configuracaoLoja.findUnique.mockImplementation(async () => ({ ...banco.loja }));
  banco.tx.documentoFiscalSaida.findMany.mockResolvedValue([]);
  banco.tx.eventoConfiguracaoBrasilNfe.findFirst.mockImplementation(async (query: { where: { tipo: string } }) => banco.eventos.filter(e => e.tipo === query.where.tipo).at(-1) ?? null);
  banco.tx.eventoConfiguracaoBrasilNfe.findMany.mockResolvedValue([]);
  banco.tx.eventoConfiguracaoBrasilNfe.create.mockImplementation(async ({ data }: { data: { tipo: string; dados: unknown } }) => { const evento = { id: `evento-sintetico-${banco.eventos.length}`, tipo: data.tipo, dados: data.dados, createdAt: new Date() }; banco.eventos.push(evento); return evento; });
});
describe("Serviço de numeração: banco simulado, autorização real e nenhum efeito fiscal/comercial", () => {
  it("abrir tela não consulta API nem grava evento", async () => {
    const consultar = vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao");
    expect((await obterNumeracaoFiscalBrasilNfe(sessao)).consulta.situacao).toBe("NAO_CONSULTADA");
    expect(consultar).not.toHaveBeenCalled(); expect(banco.tx.eventoConfiguracaoBrasilNfe.create).not.toHaveBeenCalled();
  });
  it("consulta manual armazena apenas projeção, sem credenciais/configuração/emissão", async () => {
    const consultar = vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao").mockResolvedValue({ numeracoes: [{ ambiente: 2, modelo: 55, serie: "001", numero: "5", padrao: true }], avisosPresentes: false });
    const r = await consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao);
    expect(r.consulta.situacao).toBe("CONCLUIDA"); expect(consultar).toHaveBeenCalledTimes(1); expect(r.linhas[0].proximoNumero).toBe("5");
    expect(banco.tx.configuracaoBrasilNfe.update).not.toHaveBeenCalled();
    for (const segredo of ["empresa-sintetica-secreta", "usuario-sintetico-secreto", banco.config.tokenCifrado]) expect(JSON.stringify([r, banco.eventos])).not.toContain(segredo);
  });
  it.each(["inativo", "sessao", "permissao"])("nega acesso revogado antes de consulta: %s", async caso => {
    if (caso === "inativo") banco.usuario.ativo = false; if (caso === "sessao") banco.usuario.sessaoVersao = 1; if (caso === "permissao") banco.usuario.perfilAcesso.sistema = "OPERADOR";
    const consultar = vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao");
    await expect(consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao)).rejects.toThrow("acesso");
    expect(consultar).not.toHaveBeenCalled(); expect(banco.eventos).toEqual([]);
  });
  it("não reutiliza leitura de outro emitente/configuração", async () => {
    vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao").mockResolvedValue({ numeracoes: [], avisosPresentes: false });
    await consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao); banco.config.versao = 4;
    expect((await obterNumeracaoFiscalBrasilNfe(sessao)).consulta.situacao).toBe("OBSOLETA");
    banco.config.versao = 3; banco.loja.cnpj = "11111111111111";
    expect((await obterNumeracaoFiscalBrasilNfe(sessao)).consulta.situacao).toBe("OBSOLETA");
  });
  it("descarta resultado se cadastro muda durante HTTP", async () => {
    vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao").mockImplementation(async () => { banco.config.versao = 4; return { numeracoes: [], avisosPresentes: false }; });
    await expect(consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao)).rejects.toThrow("descartado");
    expect(banco.eventos.map(e => e.tipo)).toEqual(["NUMERACAO_CONSULTA_INICIADA"]);
  });
  it("respeita intervalo, sem retry automático", async () => {
    const consultar = vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao").mockResolvedValue({ numeracoes: [], avisosPresentes: false });
    await consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao);
    await expect(consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao)).rejects.toThrow("30 segundos"); expect(consultar).toHaveBeenCalledTimes(1);
  });
  it("preserva HTTP 403 seguro sem mensagens externas nem alteração de contador", async () => {
    vi.spyOn(ClienteBrasilNfe.prototype, "consultarNumeracao").mockRejectedValue(new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "HTTP", httpStatus: 403 }));
    const r = await consultarNumeracaoFiscalBrasilNfe({ versao: 3 }, sessao); expect(r.consulta).toMatchObject({ situacao: "FALHOU", httpStatus: 403 }); expect(r.linhas).toEqual([]);
  });
});
