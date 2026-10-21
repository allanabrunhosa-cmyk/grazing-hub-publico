import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
type Ambiente = "HOMOLOGACAO" | "PRODUCAO";
type Documento = ReturnType<typeof documento>;
const s = vi.hoisted(() => ({ acesso: vi.fn(), calcular: vi.fn(), regime: vi.fn(), numeracao: vi.fn(), pre: vi.fn(), preparar: vi.fn(), consultar: vi.fn(), cliente: vi.fn(), rede: vi.fn(),
  pedido: vi.fn(), docPrimeiro: vi.fn(), docPorId: vi.fn(), docContagem: vi.fn(), conflito: vi.fn(), sql: vi.fn(), escrita: vi.fn(), tx: vi.fn(), fotografias: [] as Documento[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: s.tx, $queryRaw: s.sql, documentoFiscalSaida: { findFirst: s.docPrimeiro, findUniqueOrThrow: s.docPorId, count: s.docContagem } } }));
vi.mock("@/lib/vendas/pedidos", () => ({ conferirAcesso: s.acesso }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regime-empresa", () => ({ obterRegimeFiscalEmpresaBrasilNfe: s.regime }));
vi.mock("@/lib/fiscal-saida/brasilnfe/numeracao", () => ({ obterNumeracaoFiscalBrasilNfe: s.numeracao }));
vi.mock("@/lib/fiscal-saida/brasilnfe/pre-requisitos", () => ({ obterPreRequisitosEmissaoBrasilNfe: s.pre, obterPreRequisitosBrasilNfe: s.pre }));
vi.mock("@/lib/fiscal-saida/brasilnfe/configuracao", () => ({ obterClienteHomologacaoBrasilNfe: s.cliente, conferirAcessoAdministrativoBrasilNfe: vi.fn() }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regras-tributarias", async original => ({ ...await original<object>(), obterComplementosAprovadosDocumentoBrasilNfe: async () => null }));
vi.mock("@/lib/fiscal-saida/servico", () => ({ prepararFiscalSaida: s.preparar, consultarFiscalSaida: s.consultar, whereAmbienteConflitanteFiscalSaida: s.conflito,
  conferirCalculoAtualFiscalSaida: vi.fn(), executarFiscalSaidaManual: vi.fn(), obterArquivosFiscalSaidaManual: vi.fn() }));
import { prepararEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
const sessao = { userId: "operador-sintetico", versao: 1 } as SessaoAtual;
const pedido = () => ({ id: "pedido-ficticio", numero: 20, versao: 5, status: "CONFIRMADO", origem: "INTERNO", referenciaOrigem: null,
  total: new Prisma.Decimal("165"), subtotal: new Prisma.Decimal("139"), desconto: new Prisma.Decimal("0"), frete: new Prisma.Decimal("26"), outrosCustos: new Prisma.Decimal("0"),
  compradorSnapshot: { nome: "Consumidor exclusivamente sintético" }, cobrancaSnapshot: {}, destinatarioSnapshot: {},
  itens: [{ id: "item-ficticio", produtoId: "produto-ficticio", produtoSnapshot: { nome: "Produto exclusivamente sintético" }, quantidade: new Prisma.Decimal("1"), unidadeSnapshot: "UN", totalLinha: new Prisma.Decimal("139") }] });
function documento(modelo: 55 | 65 = 55, ambiente: Ambiente = "HOMOLOGACAO", tributacao: Record<string, unknown> = {}) {
  return { id: "documento-anterior", versaoPedido: 5, provedor: "BRASIL_NFE", referenciaProvedor: "referencia-anterior" as string | null, modeloDocumento: modelo, status: "PENDENTE_CONFERENCIA", ambiente, hashPayload: "a".repeat(64),
    numero: "1" as string | null, serie: modelo === 55 ? "6" : "7", chaveFiscal: null, protocolo: null, ultimoErro: "Resultado incerto exige conferência." as string | null, tentativas: 1,
    eventos: [{ id: "evento-anterior", tipo: "RESULTADO_INCERTO", createdAt: new Date("2026-10-14T12:00:00Z") }],
    payload: { versao: 2, emitente: { nome: "Empresa exclusivamente sintética", cnpj: "00000000000000" }, comprador: pedido().compradorSnapshot, cobranca: {},
      itens: [{ id: "item-ficticio", produtoId: "produto-ficticio", produto: { nome: "Produto exclusivamente sintético" }, quantidade: "1", unidade: "UN", total: "139.00" }],
      tributacao: { apto: false, pendencias: ["Produto exclusivamente sintético: origem e CI não comprovados."], ...tributacao } } };
}
const tabela = (leitura = vi.fn()) => ({ findUniqueOrThrow: leitura, findUnique: leitura, findFirst: leitura, findMany: leitura, create: s.escrita, update: s.escrita, upsert: s.escrita, delete: s.escrita, createMany: s.escrita, updateMany: s.escrita });

describe("Prévia local prepara fotografia e histórico sem transmissão ou efeitos comerciais", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("fetch", s.rede); s.fotografias = [];
    const tx = { pedidoVenda: tabela(s.pedido), documentoFiscalSaida: { ...tabela(), findUniqueOrThrow: s.docPorId }, itemPedidoVenda: tabela(vi.fn().mockResolvedValue(null)),
      versaoEstruturaFiscal: tabela(vi.fn().mockResolvedValue([])), eventoConfiguracaoBrasilNfe: tabela(vi.fn().mockResolvedValue([])), pedidoIfood: tabela(vi.fn().mockResolvedValue(null)),
      eventoFiscalSaida: tabela(), planoFiscalBrasilNfe: tabela(), lancamentoFinanceiro: tabela(), movimentacaoEstoque: tabela(), notaFiscalRecebida: tabela(), $queryRaw: s.sql, $executeRaw: s.escrita };
    s.tx.mockImplementation(async f => f(tx)); s.acesso.mockResolvedValue({ userId: sessao.userId }); s.pedido.mockResolvedValue(pedido());
    s.docPrimeiro.mockImplementation(async ({ where }: { where: { ambiente: Ambiente; modeloDocumento: number } }) => s.fotografias.find(d => d.ambiente === where.ambiente && d.modeloDocumento === where.modeloDocumento) ?? null);
    s.docPorId.mockImplementation(async ({ where }: { where: { id: string } }) => { const d = s.fotografias.find(d => d.id === where.id); if (!d) throw new Error("Fotografia sintética ausente"); return d; });
    s.conflito.mockImplementation((ambiente: Ambiente, modelo: 55 | 65) => ({ ambiente, ...(ambiente === "HOMOLOGACAO" ? { modeloDocumento: modelo } : {}) }));
    s.docContagem.mockImplementation(async ({ where }: { where: { id: { not: string }; AND: [{ ambiente: Ambiente; modeloDocumento?: number }] } }) => s.fotografias.filter(d => d.id !== where.id.not && d.ambiente === where.AND[0].ambiente
      && (where.AND[0].modeloDocumento === undefined || d.modeloDocumento === where.AND[0].modeloDocumento) && ["AUTORIZADO", "PENDENTE_CONFERENCIA"].includes(d.status)).length);
    s.calcular.mockResolvedValue({ pendencias: ["Produto exclusivamente sintético: origem e CI não comprovados."], documento: { Produtos: [] } });
    // O serviço da fila é a fronteira simulada desta suíte. As suítes SQL conferem
    // sua persistência real; aqui só PREPARADO local pode ser delegado.
    s.preparar.mockImplementation(async (_id: string, _versao: number, _sessao: SessaoAtual, modelo: "55" | "65", opcoes: { ambiente: Ambiente; consumidorFinal?: boolean; indicadorPresenca?: number }) => {
      const calculo = await s.calcular(tx, await s.pedido(), modelo, opcoes), d = documento(Number(modelo) as 55 | 65, opcoes.ambiente, { ...calculo, documento: { ...calculo.documento, ModeloDocumento: Number(modelo), TipoAmbiente: opcoes.ambiente === "PRODUCAO" ? 1 : 2, ConsumidorFinal: opcoes.consumidorFinal, IndicadorPresenca: opcoes.indicadorPresenca ?? 0 } });
      d.id = `preparado-${modelo}-${opcoes.ambiente}`; d.status = "PREPARADO"; d.tentativas = 0; d.referenciaProvedor = null; d.numero = null; d.ultimoErro = null; d.eventos = [];
      s.fotografias.push(d); s.escrita({ tipo: "PREPARADO_LOCAL", documentoId: d.id }); return d;
    });
    s.consultar.mockImplementation(async () => s.fotografias.map(d => ({ ...d, formatoImpressao: d.tentativas ? "PDF" : null })));
    s.sql.mockImplementation(async (sql: TemplateStringsArray, id: string) => sql.join("").includes("ConfiguracaoBrasilNfe") ? [{ existe: true, tokenConfigurado: true }] : [{ xmlDisponivel: s.fotografias.some(d => d.id === id && d.tentativas > 0) }]);
    s.regime.mockResolvedValue({ ie: "000000000000", crt: 1, descricaoCrt: "Simples Nacional" }); s.numeracao.mockResolvedValue({ linhas: [], pendencias: ["Numeração ainda não consultada."] });
    s.cliente.mockResolvedValue({ versao: 1, emitenteHash: "e".repeat(64), cliente: { tokenCifrado: "segredo-nao-deve-sair", userToken: "outro-segredo-nao-deve-sair" } });
    s.pre.mockResolvedValue({ empresaCorrespondente: true, certificado: { situacao: "VALIDO", validade: "2099-11-07" }, evidenciaPainel: { servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true }, csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: true, identificador: true } } });
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([[55, "HOMOLOGACAO"], [65, "HOMOLOGACAO"], [55, "PRODUCAO"], [65, "PRODUCAO"]] as const)("modelo%s/%s prepara só a fotografia contextual sem envio", async (modelo, ambiente) => {
    const comercial = pedido(), anterior = JSON.stringify(comercial); s.pedido.mockResolvedValue(comercial);
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, modelo, ambiente, sessao, { indicadorPresenca: 2 });
    expect(r).toMatchObject({ modelo, ambiente, total: "165.00", valores: { subtotal: "139.00", frete: "26.00", desconto: "0.00", outrosCustos: "0.00" }, podeEmitir: false,
      documento: { id: `preparado-${modelo}-${ambiente}`, status: "PREPARADO", modeloDocumento: modelo, ambiente, tentativas: 0 }, liberacaoTransmissao: { liberada: false }, contextoOperacao: { indicadorPresenca: 2, exigeEscolhaPresenca: false, consumidorFinal: true } });
    expect(r.itens).toEqual([expect.objectContaining({ id: "item-ficticio", total: "139.00", fiscal: null })]);
    expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "tributacao", mensagem: expect.stringContaining("CI não comprovados") }));
    expect(r.pendencias.some(p => p.campo === "csc")).toBe(modelo === 65 && ambiente === "HOMOLOGACAO");
    expect(s.acesso).toHaveBeenCalledWith(expect.anything(), sessao, ["consultar", "revisar", "fiscal"], "pedido-ficticio");
    expect(s.preparar).toHaveBeenCalledExactlyOnceWith("pedido-ficticio", 5, sessao, String(modelo), { ambiente, consumidorFinal: true, indicadorPresenca: 2 });
    expect(s.escrita.mock.calls).toEqual([[{ tipo: "PREPARADO_LOCAL", documentoId: r.documento!.id }]]);
    expect(JSON.stringify(comercial)).toBe(anterior); expect(s.rede).not.toHaveBeenCalled();
  });
  it("preserva identidade, tentativas e histórico de resultado incerto no mesmo contexto", async () => {
    const d = documento(); s.fotografias = [d]; const anterior = structuredClone(d);
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao);
    expect(r.documento).toMatchObject({ id: d.id, hashSnapshot: d.hashPayload, hashPayloadFiscal: null, modeloDocumento: 55, ambiente: "HOMOLOGACAO", status: d.status, tentativas: d.tentativas, eventos: d.eventos, xmlDisponivel: true, formatoImpressao: "PDF" });
    expect(r.pendencias.some(p => p.campo === "resultado")).toBe(true); expect(r.podeEmitir).toBe(false);
    expect(d).toEqual(anterior); expect(s.escrita).not.toHaveBeenCalled(); expect(s.preparar).not.toHaveBeenCalled(); expect(s.rede).not.toHaveBeenCalled();
  });
  it.each([
    { tipo: "PJ", nomeCompleto: "", razaoSocial: "Empresa adicional sintética", documento: "11222333000181", nomeEsperado: "Empresa adicional sintética" },
    { tipo: "PF", nomeCompleto: "Pessoa adicional sintética", razaoSocial: "", documento: "11111111266", nomeEsperado: "Pessoa adicional sintética" },
  ])("prévia mostra o titular da cobrança adicional $tipo selecionada sem misturar a Principal", async titular => {
    const d = documento();
    const principal = { tipo: "PJ", razaoSocial: "Empresa principal sintética", documento: "11444777000161", logradouro: "Rua da Principal", numero: "1", cidade: "São Paulo", uf: "SP" };
    const adicional = { ...titular, logradouro: "Rua Adicional", numero: "42", cidade: "São Paulo", uf: "SP" };
    Object.assign(d.payload, { comprador: { ...principal, nome: "Comprador principal" }, cobranca: { ...adicional, enderecos: [principal, adicional], selecionado: 1 } });
    s.fotografias = [d]; const antes = structuredClone(d);
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao);
    expect(r.destinatario).toEqual({ nome: titular.nomeEsperado, documento: titular.documento, endereco: "Rua Adicional, 42, São Paulo, SP" });
    expect(d).toEqual(antes); expect(s.preparar).not.toHaveBeenCalled(); expect(s.escrita).not.toHaveBeenCalled(); expect(s.rede).not.toHaveBeenCalled();
  });
  it.each(["PF", "PJ"])("não completa titular adicional %s ausente com documento ou nome da Principal", async tipo => {
    const d = documento();
    const principal = { tipo: "PJ", nome: "Comprador principal", razaoSocial: "Empresa principal sintética", documento: "11444777000161" };
    const adicional = { tipo, nomeCompleto: "", razaoSocial: "", documento: "", titularPendente: tipo === "PJ" };
    Object.assign(d.payload, { comprador: principal, cobranca: { ...adicional, enderecos: [principal, adicional], selecionado: 1 } });
    s.fotografias = [d]; const antes = structuredClone(d);
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao);
    expect(r.destinatario).toEqual({ nome: "", documento: "", endereco: null });
    expect(r.podeEmitir).toBe(false); expect(d).toEqual(antes);
    expect(s.preparar).not.toHaveBeenCalled(); expect(s.escrita).not.toHaveBeenCalled(); expect(s.rede).not.toHaveBeenCalled();
  });
  it("mantém o histórico hom55 sem reutilizá-lo na preparação prod65", async () => {
    const d = documento(), anterior = structuredClone(d); s.fotografias = [d];
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 65, "PRODUCAO", sessao, { indicadorPresenca: 2 });
    expect(r.documento).toMatchObject({ id: "preparado-65-PRODUCAO", modeloDocumento: 65, ambiente: "PRODUCAO", status: "PREPARADO" });
    expect(r.pendencias.some(p => p.campo === "duplicidade")).toBe(false); expect(r.podeEmitir).toBe(false); expect(s.fotografias).toContainEqual(anterior); expect(d).toEqual(anterior); expect(s.rede).not.toHaveBeenCalled();
    expect(s.conflito).toHaveBeenCalledWith("PRODUCAO", 65);
  });
  it("resultado produtivo de outro modelo bloqueia emissão da mesma venda sem apagar histórico", async () => {
    const d = documento(55, "PRODUCAO"), anterior = structuredClone(d); s.fotografias = [d];
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 65, "PRODUCAO", sessao, { indicadorPresenca: 2 });
    expect(r.pendencias.some(p => p.campo === "duplicidade")).toBe(true); expect(r.podeEmitir).toBe(false); expect(d).toEqual(anterior); expect(s.rede).not.toHaveBeenCalled();
  });
  it.each(["Sua sessão foi encerrada.", "Seu acesso não permite esta operação."])("respeita a guarda central: %s", async mensagem => {
    s.acesso.mockRejectedValue(new Error(mensagem));
    await expect(prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao)).rejects.toThrow(mensagem);
    expect(s.pedido).not.toHaveBeenCalled(); expect(s.calcular).not.toHaveBeenCalled(); expect(s.escrita).not.toHaveBeenCalled(); expect(s.rede).not.toHaveBeenCalled();
  });
  it.each([{ status: "RASCUNHO" }, { versao: 6 }])("recusa estado/revisão divergente antes da preparação %j", async alteracao => {
    s.pedido.mockResolvedValue({ ...pedido(), ...alteracao });
    await expect(prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao)).rejects.toThrow("revisão vigente");
    expect(s.preparar).not.toHaveBeenCalled(); expect(s.calcular).not.toHaveBeenCalled(); expect(s.escrita).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])("recusa revisão inválida%s antes de ler banco", async versao => {
    await expect(prepararEmissaoPedidoBrasilNfe("pedido-ficticio", versao, 55, "HOMOLOGACAO", sessao)).rejects.toThrow("inválid"); expect(s.tx).not.toHaveBeenCalled();
  });
  it("retorna códigos do motor sem expor o cliente protegido ou segredos", async () => {
    s.calcular.mockResolvedValue({ pendencias: [], documento: { Produtos: [{ CodProdutoServico: "produto-ficticio", NCM: "19059090", CFOP: 5101, OrigemProduto: 0, Imposto: { ICMS: { CodSituacaoTributaria: "102" }, PIS: { CodSituacaoTributaria: "49" }, COFINS: { CodSituacaoTributaria: "49" } } }] } });
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao);
    expect(r.itens[0].fiscal).toEqual({ ncm: "19059090", cfop: "5101", origem: "0", icms: "102", pis: "49", cofins: "49" });
    expect(JSON.stringify(r)).not.toMatch(/tokenCifrado|userToken|segredo-nao-deve-sair|senha|certificadoBase64/); expect(r.podeEmitir).toBe(false); expect(s.rede).not.toHaveBeenCalled();
  });
  it("pendência incompatível não é exposta como texto nem convertida em sucesso", async () => {
    s.calcular.mockResolvedValue({ pendencias: [{ mensagem: "objeto incompatível" }], documento: { Produtos: [] } });
    const r = await prepararEmissaoPedidoBrasilNfe("pedido-ficticio", 5, 55, "HOMOLOGACAO", sessao);
    expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "tributacao", mensagem: expect.stringContaining("Completar e aprovar") }));
    expect(JSON.stringify(r)).not.toMatch(/objeto incompatível|\[object Object\]/); expect(r.podeEmitir).toBe(false); expect(s.rede).not.toHaveBeenCalled();
  });
});
