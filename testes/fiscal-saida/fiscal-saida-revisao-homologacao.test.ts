import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentoFiscalSaida, Prisma } from "@/generated/prisma/client";
const s = vi.hoisted(() => ({ vigente: vi.fn(), normal: vi.fn(), propostas: vi.fn(), pedido: vi.fn(), evento: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/tributacao/pedidos", () => ({ calcularPreviaPedido: s.normal, calcularPreviaPedidoComRevisaoConsolidada: s.propostas }));
vi.mock("@/lib/tributacao/servico", async original => ({ ...await original<typeof import("@/lib/tributacao/servico")>(), conferirVigenciaSnapshotFiscal: s.vigente }));
import { hashFiscal } from "@/lib/tributacao/servico";
import { conferirCalculoAtualFiscalSaida } from "@/lib/fiscal-saida/servico";

const versoes = [{ id: "classificacao-exclusivamente-sintetica", hash: "a".repeat(64), versao: 3, tipo: "CLASSIFICACAO", chave: "produto-exclusivamente-sintetico", statusOriginal: "RASCUNHO" }];
const tributacao = () => ({ previa: { contexto: { modelo: "55" } }, documento: { ModeloDocumento: 55, TipoAmbiente: 2, ConsumidorFinal: true, IndicadorPresenca: 1, Cliente: { IndicadorIe: 9 } },
  revisaoConsolidada: { tipo: "PROPOSTAS_PARA_REVISAO", versao: 1, ambiente: "HOMOLOGACAO", aprovacaoInterna: false, versoes: structuredClone(versoes) } });
const documento = () => ({ id: "documento-exclusivamente-sintetico", pedidoId: "pedido-exclusivamente-sintetico", ambiente: "HOMOLOGACAO", modeloDocumento: 55, status: "SEM_EMISSOR", acao: null, hashPayload: "b".repeat(64), payload: { versao: 2, tributacao: tributacao() } } as unknown as DocumentoFiscalSaida);
const tx = { pedidoVenda: { findUniqueOrThrow: s.pedido }, eventoFiscalSaida: { findFirst: s.evento } } as unknown as Prisma.TransactionClient;
const prova = (d: DocumentoFiscalSaida) => ({ dados: { hashSnapshot: d.hashPayload, hashVersoes: hashFiscal(versoes), usuarioId: "usuario-exclusivamente-sintetico", aprovacaoInterna: false, finalidade: "TESTE_HOMOLOGACAO" } });

describe("Revisão fotografada para o único teste55 de homologação", () => {
  beforeEach(() => { vi.clearAllMocks(); s.pedido.mockResolvedValue({ id: "pedido-exclusivamente-sintetico" }); s.evento.mockResolvedValue(null); s.propostas.mockImplementation(async () => tributacao()); s.normal.mockResolvedValue({}); });
  it("prévia não processada recalcula as mesmas propostas sem inventar aprovação interna", async () => {
    const d = documento(); await conferirCalculoAtualFiscalSaida(tx, d);
    expect(s.propostas).toHaveBeenCalledWith(tx, expect.objectContaining({ id: d.pedidoId }), "55", { ambiente: "HOMOLOGACAO", consumidorFinal: true, indicadorPresenca: 1, indicadorIe: 9 }, versoes.map(v => ({ id: v.id, hash: v.hash })));
    expect(s.vigente).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled(); expect(s.normal).not.toHaveBeenCalled();
    expect(d.payload).toMatchObject({ tributacao: { revisaoConsolidada: { aprovacaoInterna: false } } });
  });
  it.each(["SOLICITACAO", "ENVIAR", "PROCESSANDO"] as const)("%s exige evento exato antes de recalcular ou transmitir", async momento => {
    const d = documento(); if (momento === "ENVIAR") d.acao = "ENVIAR"; if (momento === "PROCESSANDO") d.status = "PROCESSANDO";
    await expect(conferirCalculoAtualFiscalSaida(tx, d, momento === "SOLICITACAO" ? { enviar: true } : undefined)).rejects.toThrow("sem registro específico");
    expect(s.propostas).not.toHaveBeenCalled(); expect(s.normal).not.toHaveBeenCalled();
  });
  it("evento exato permite apenas conferir o teste, mantendo aprovação false e identidade original", async () => {
    const d = documento(), antes = structuredClone(d); s.evento.mockResolvedValue(prova(d));
    await conferirCalculoAtualFiscalSaida(tx, d, { enviar: true });
    expect(s.evento).toHaveBeenCalledWith(expect.objectContaining({ where: { documentoId: d.id, tipo: "EMISSAO_MANUAL_REVISAO_HOMOLOGACAO" } }));
    expect(s.propostas).toHaveBeenCalledOnce(); expect(d).toEqual(antes); expect(s.vigente).not.toHaveBeenCalled();
  });
  it.each([{ hashSnapshot: "c".repeat(64) }, { hashVersoes: "c".repeat(64) }, { usuarioId: "" }, { aprovacaoInterna: true }, { finalidade: "EMISSAO_PRODUTIVA" }])("evento divergente não libera a revisão: %j", async alteracao => {
    const d = documento(); s.evento.mockResolvedValue({ dados: { ...prova(d).dados, ...alteracao } });
    await expect(conferirCalculoAtualFiscalSaida(tx, d, { enviar: true })).rejects.toThrow("sem registro específico"); expect(s.propostas).not.toHaveBeenCalled();
  });
  it.each(["PRODUCAO", "MODELO65"] as const)("marcador de propostas não autoriza%s mesmo com evento registrado", async contexto => {
    const d = documento(); if (contexto === "PRODUCAO") d.ambiente = "PRODUCAO"; else d.modeloDocumento = 65; s.evento.mockResolvedValue(prova(d));
    await expect(conferirCalculoAtualFiscalSaida(tx, d, { enviar: true })).rejects.toThrow("outro contexto fiscal"); expect(s.propostas).not.toHaveBeenCalled();
  });
  it("alteração do cálculo ou das versões continua invalidando o hash integral fotografado", async () => {
    const d = documento(); s.evento.mockResolvedValue(prova(d)); s.propostas.mockResolvedValue({ ...tributacao(), dadoFiscalAlterado: true });
    await expect(conferirCalculoAtualFiscalSaida(tx, d, { enviar: true })).rejects.toThrow("cálculo fiscal vigente mudou");
  });
  it("fotografia ordinária continua exigindo versões vigentes e cálculo normal", async () => {
    const d = documento(), t = tributacao(), normal = { previa: t.previa, documento: t.documento }; d.payload = { versao: 2, tributacao: normal }; s.normal.mockResolvedValue(normal);
    await conferirCalculoAtualFiscalSaida(tx, d, { enviar: true });
    expect(s.vigente).toHaveBeenCalledWith(tx, d.payload); expect(s.normal).toHaveBeenCalledOnce(); expect(s.propostas).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled();
  });
});
