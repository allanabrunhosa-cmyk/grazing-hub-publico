import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ guarda: vi.fn(), pode: vi.fn(), saida: vi.fn(), entrada: vi.fn(), servico: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.guarda, podeAcessar: m.pode }));
vi.mock("@/lib/prisma", () => ({ prisma: { documentoFiscalSaida: { findUnique: m.saida }, notaFiscalRecebida: { findUnique: m.entrada }, notaFiscalServico: { findUnique: m.servico } } }));
import { consultarDocumentoDashboard } from "@/lib/fiscal-dashboard/documento";
import type { TipoDocumentoDashboardFiscal } from "@/lib/fiscal-dashboard/tipos";
beforeEach(() => { vi.resetAllMocks(); m.guarda.mockResolvedValue({}); m.pode.mockResolvedValue(true); });
describe("Detalhes fiscais do Dashboard: consulta local autorizada", () => {
  it("exige o painel antes de consultar qualquer fonte", async () => {
    m.guarda.mockRejectedValue(new Error("Sem acesso"));
    await expect(consultarDocumentoDashboard("NF_ENTRADA", "nota")).rejects.toThrow("Sem acesso");
    expect(m.pode).not.toHaveBeenCalled(); expect(m.entrada).not.toHaveBeenCalled();
  });
  it.each([["NF_SAIDA", "vendas.fiscal"], ["NF_ENTRADA", "notas"], ["NFC_ENTRADA", "notas"], ["NFS_ENTRADA", "financeiro.nfse"]] as const)("revalida permissão específica de %s", async (tipo, recurso) => {
    m.pode.mockResolvedValue(false);
    expect(await consultarDocumentoDashboard(tipo, "nota")).toHaveProperty("erro");
    expect(m.pode).toHaveBeenCalledWith(recurso); expect(m.saida).not.toHaveBeenCalled(); expect(m.entrada).not.toHaveBeenCalled(); expect(m.servico).not.toHaveBeenCalled();
  });
  it.each([["INVALIDO", "nota"], ["NF_ENTRADA", "../segredo"], ["NF_SAIDA", "x".repeat(101)], ["NFS_ENTRADA", ""]])("recusa entrada inválida antes do banco: %s", async (tipo, id) => {
    expect(await consultarDocumentoDashboard(tipo as TipoDocumentoDashboardFiscal, id)).toHaveProperty("erro");
    expect(m.pode).not.toHaveBeenCalled(); expect(m.entrada).not.toHaveBeenCalled();
  });
  it("exige consulta de Pedidos além do acesso fiscal para saída", async () => {
    m.pode.mockImplementation(async recurso => recurso !== "vendas.pedidos");
    expect(await consultarDocumentoDashboard("NF_SAIDA", "nota")).toHaveProperty("erro");
    expect(m.saida).not.toHaveBeenCalled();
  });
  it("mostra resumo sem inventar itens ou disparar obtenção externa", async () => {
    m.entrada.mockResolvedValue({ xml: null, chaveAcesso: "3".repeat(44), fornecedorNome: "Empresa sintética" });
    const r = await consultarDocumentoDashboard("NF_ENTRADA", "nota");
    expect(r).toMatchObject({ itens: [], aviso: expect.stringContaining("XML completo não disponível") });
    expect(m.entrada).toHaveBeenCalledTimes(1); expect(m.servico).not.toHaveBeenCalled(); expect(m.saida).not.toHaveBeenCalled();
  });
  it("reutiliza extratores oficiais para os itens locais da nota", async () => {
    m.saida.mockResolvedValue({ chaveFiscal: "3".repeat(44), numero: "1", serie: "1", protocolo: "123", protocoloCancelamento: null, ambiente: "PRODUCAO", xml: '<nfeProc><NFe><infNFe><ide><natOp>Venda sintética</natOp></ide><emit><xNome>Empresa sintética</xNome></emit><det nItem="1"><prod><cProd>A</cProd><xProd>Kit de teste</xProd><uCom>KIT</uCom><qCom>2</qCom><vProd>100.50</vProd></prod></det></infNFe></NFe></nfeProc>' });
    const r = await consultarDocumentoDashboard("NF_SAIDA", "saida");
    expect(r).toMatchObject({ itens: [{ numero: 1, descricao: "Kit de teste", quantidade: 2, unidade: "KIT", valor: 100.5 }] });
    expect(JSON.stringify(r)).not.toContain("<nfeProc>");
  });
  it("consulta NFS-e sem trazer contatos nem efetuar lançamento", async () => {
    m.servico.mockResolvedValue({ numero: "2", serie: null, chaveAcesso: null, codigoVerificacao: "ABC", prestadorNome: "Prestador sintético", municipioNome: "Cidade", uf: "SP", valorIss: { toFixed: () => "12.30" } });
    const r = await consultarDocumentoDashboard("NFS_ENTRADA", "servico");
    expect(r).toMatchObject({ campos: expect.arrayContaining([{ nome: "ISS (R$)", valor: "12,30" }]), itens: [] });
    expect(m.servico.mock.calls[0][0].select).not.toHaveProperty("prestadorDados");
  });
  it("retorna erro recuperável sem expor falha interna", async () => {
    m.entrada.mockRejectedValue(new Error("dados privados"));
    expect(await consultarDocumentoDashboard("NF_ENTRADA", "nota")).toEqual({ erro: "Não foi possível consultar a nota. Tente novamente." });
  });
});
