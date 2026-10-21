import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { PerfilFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { classificacaoFicticia } from "./declaracao-fci-fixtures";
const s = vi.hoisted(() => ({ versoes: [] as VersaoFiscalDto[], calcular: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/tributacao/servico", () => ({ consultarVersoesFiscais: async () => s.versoes, conferirAutorFiscal: vi.fn() }));
vi.mock("@/lib/tributacao/motor", async original => ({ ...await original<typeof import("@/lib/tributacao/motor")>(), calcularTributacao: s.calcular }));
vi.mock("@/lib/tributacao/validacao", async original => ({ ...await original<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => "2026-10-15" }));
import { calcularPreviaPedido, calcularPreviaPedidoComRevisaoConsolidada } from "@/lib/tributacao/pedidos";
import { hashDeclaracaoFci } from "@/lib/tributacao/declaracao-fci";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "../fiscal-saida/brasilnfe-payload-local-fixtures";
function massa() {
  const decimal = (v: string) => new Prisma.Decimal(v);
  return { id: "pedido-exclusivamente-sintetico", atendimento: "ENTREGA", subtotal: decimal("139"), total: decimal("165"), desconto: decimal("0"), frete: decimal("26"), outrosCustos: decimal("0"), formaPagamentoInformada: "PIX", pagamentoInformadoSnapshot: { tipo: "PIX" },
    compradorSnapshot: { nome: "Comprador exclusivamente sintético", documento: "52998224725", tipo: "PF" }, cobrancaSnapshot: { cep: "01001000", logradouro: "Logradouro sintético", numero: "1", bairro: "Bairro sintético", cidade: "São Paulo", uf: "SP", pais: "BRASIL", codigoMunicipio: "3550308" }, enderecoSnapshot: { uf: "SP" },
    itens: [{ id: "item-ficticio", produtoId: classificacaoFicticia().produtoId!, produtoSnapshot: { nome: "Produto exclusivamente sintético" }, quantidade: decimal("1"), unidadeSnapshot: "UN", precoAplicado: decimal("139"), totalLinha: decimal("139"), composicaoSnapshot: [], escolhasSnapshot: [], estadoComposicao: "CONHECIDA" }] } as unknown as Parameters<typeof calcularPreviaPedido>[1];
}
const tx = { produtoVenda: { findMany: async () => [] }, insumo: { findMany: async () => [] }, historicoPedidoVenda: { count: async () => 0 } } as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.clearAllMocks(); s.versoes = [];
  const dados: PerfilFiscal = { estabelecimento: "singleton", cnpj: "00000000000000", inscricaoEstadual: "000000000000", uf: "SP", codigoMunicipio: "3550308", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Prova exclusivamente sintética", emissor: "BRASIL_NFE", modelos: ["55", "65"], reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
  s.versoes.push({ id: "perfil-ficticio", tipo: "PERFIL", chave: "singleton", versao: 1, vigenciaInicio: "2026-01-01", status: "ATIVO", dados, hash: hashDeclaracaoFci(dados), fontes: ["FONTE-SINTETICA"], justificativa: "Perfil sintético", criadoPorNome: "Pessoa sintética", createdAt: "2026-01-01T12:00:00Z" });
  s.calcular.mockImplementation(contexto => ({ apto: false, pendencias: ["Revisão de parâmetros ainda pendente."], contexto, perfilId: "perfil-ficticio", regime: "SIMPLES_NACIONAL", linhas: [], totalMercadorias: "0.00", justificativas: [] }));
});
describe("Montagem de revisão e identidade em homologação", () => {
  it("55/2 troca somente NmCliente antes do snapshot e conserva identificação/endereço comercial", async () => {
    const p = massa(), antes = structuredClone({ comprador: p.compradorSnapshot, cobranca: p.cobrancaSnapshot });
    const r = await calcularPreviaPedido(tx, p, "55", { ambiente: "HOMOLOGACAO", consumidorFinal: true, indicadorIe: 9, indicadorPresenca: 2 });
    expect(r.documento.Cliente).toMatchObject({ NmCliente: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL", CpfCnpj: "52998224725", Endereco: { CodMunicipio: "3550308", Numero: "1" } });
    expect({ comprador: p.compradorSnapshot, cobranca: p.cobrancaSnapshot }).toEqual(antes); expect(r.documento.ValorTotal).toBe("165.00");
  });
  it.each([["55", "PRODUCAO"], ["65", "PRODUCAO"], ["65", "HOMOLOGACAO"]] as const)("modelo%s/%s não recebe a literal exclusiva55/2", async (modelo, ambiente) => {
    const r = await calcularPreviaPedido(tx, massa(), modelo, { ambiente, consumidorFinal: true, indicadorIe: 9, indicadorPresenca: 1 }); expect(r.documento.Cliente!.NmCliente).toBe("Comprador exclusivamente sintético");
  });
  it("revisão sobrepõe somente a versão selecionada, conserva requisitos faltantes e não aprova", async () => {
    const dados = classificacaoFicticia(); delete dados.analiseNcm; delete dados.ncmAplicabilidade;
    const proposta: VersaoFiscalDto = { id: "classificacao-proposta-ficticia", tipo: "CLASSIFICACAO", chave: dados.produtoId!, versao: 4, vigenciaInicio: "2026-10-15", status: "RASCUNHO", dados, hash: hashDeclaracaoFci(dados), fontes: ["FONTE-SINTETICA"], justificativa: "Proposta sintética", criadoPorNome: "Pessoa sintética", createdAt: "2026-10-15T12:00:00Z" }; s.versoes.push(proposta);
    const r = await calcularPreviaPedidoComRevisaoConsolidada(tx, massa(), "55", { ambiente: "HOMOLOGACAO", consumidorFinal: true, indicadorIe: 9, indicadorPresenca: 2 }, [{ id: proposta.id, hash: proposta.hash }]);
    expect(r.revisaoConsolidada).toMatchObject({ aprovacaoInterna: false, versoes: [{ id: proposta.id, hash: proposta.hash, statusOriginal: "RASCUNHO" }] });
    expect(r.previa.revisaoConsolidada).toEqual(r.revisaoConsolidada); expect(r.pendencias).toContain("Revisão de parâmetros ainda pendente."); expect(proposta.status).toBe("RASCUNHO");
    const recebidas = s.calcular.mock.calls[0][2] as VersaoFiscalDto[]; expect(recebidas.find(v => v.id === proposta.id)!.status).toBe("ATIVO");
  });
  it.each(["55", "65"] as const)("RETIRADA modelo%s não presume venda presencial e conserva o pedido", async modelo => {
    const p = massa(); p.atendimento = "RETIRADA"; p.canalNomeSnapshot = "Canal comercial sintético"; const antes = JSON.stringify(p);
    const r = await calcularPreviaPedido(tx, p, modelo, { ambiente: "HOMOLOGACAO", consumidorFinal: true, indicadorIe: 9 });
    expect(r.apto).toBe(false); expect(r.pendencias).toContain(`Confirmar presença/canal da operação ${modelo === "55" ? "NF-e" : "NFC-e"}; retirada ou atendimento comercial não comprovam presença fiscal.`); expect(r.documento.IndicadorPresenca).toBe(0); expect(JSON.stringify(p)).toBe(antes);
  });
  it.each([["55", 1], ["55", 2], ["65", 1], ["65", 2]] as const)("escolha explícita%s/%s resolve somente a pendência de presença", async (modelo, indicadorPresenca) => {
    const p = massa(); p.atendimento = "RETIRADA"; const antes = JSON.stringify(p);
    const r = await calcularPreviaPedido(tx, p, modelo, { ambiente: "HOMOLOGACAO", consumidorFinal: true, indicadorIe: 9, indicadorPresenca });
    expect(r.documento.IndicadorPresenca).toBe(indicadorPresenca); expect(r.pendencias.some(p => typeof p === "string" && /presença\/canal/.test(p))).toBe(false); expect(r.pendencias).toContain("Revisão de parâmetros ainda pendente."); expect(JSON.stringify(p)).toBe(antes);
  });
  it("ENTREGA automática4 permanece exclusiva da NFC-e; NF-e exige escolha", async () => {
    const p = massa(), opcoes = { ambiente: "HOMOLOGACAO" as const, consumidorFinal: true, indicadorIe: 9 as const };
    const nfce = await calcularPreviaPedido(tx, p, "65", opcoes), nfe = await calcularPreviaPedido(tx, p, "55", opcoes);
    expect(nfce.documento.IndicadorPresenca).toBe(4); expect(nfce.pendencias.some(p => typeof p === "string" && /presença\/canal/.test(p))).toBe(false);
    expect(nfe.documento.IndicadorPresenca).toBe(0); expect(nfe.pendencias.some(p => typeof p === "string" && /presença\/canal/.test(p))).toBe(true);
  });
});

const pagamentosCartao = [{ tipo: "CARTAO_CREDITO", codigo: "03" }, { tipo: "CARTAO_DEBITO", codigo: "04" }] as const;
const pendenciaCartao = "Pagamento com cartão: confirme se o pagamento foi processado fora do HUB, sem integração (POS ou link externo). O sistema não possui os dados de uma transação integrada.";
describe("Cartão no snapshot fiscal v2 por modelo e ambiente", () => {
  it.each(pagamentosCartao.flatMap(pagamento => (["55", "65"] as const).flatMap(modelo => (["HOMOLOGACAO", "PRODUCAO"] as const).map(ambiente => ({ ...pagamento, modelo, ambiente })))))
  ("cartão$codigo/modelo$modelo/$ambiente conserva pagamento e demais impedimentos", async ({ tipo, codigo, modelo, ambiente }) => {
    const p = massa(); p.formaPagamentoInformada = tipo; p.pagamentoInformadoSnapshot = { tipo, formaId: "cartao-exclusivamente-sintetico", parcelas: 1 };
    const antes = JSON.stringify(p);
    const r = await calcularPreviaPedido(tx, p, modelo, { ambiente, consumidorFinal: true, indicadorIe: 9, indicadorPresenca: 1 });
    expect(r.pendencias).not.toContain(pendenciaCartao);
    expect(r.pendencias).toContain("Revisão de parâmetros ainda pendente.");
    expect(r.pendencias).toContain("Linhas fiscais não fecham com subtotal menos desconto do pedido.");
    expect(r.apto).toBe(false);
    expect(r.documento.Pagamentos).toEqual([{ FormaPagamento: codigo, VlPago: "165.00", ...(modelo === "65" ? { TipoIntegracao: false } : {}) }]);
    expect(r.documento.ValorTotal).toBe("165.00"); expect(JSON.stringify(p)).toBe(antes);
  });
  it.each(pagamentosCartao.flatMap(pagamento => (["HOMOLOGACAO", "PRODUCAO"] as const).map(ambiente => ({ ...pagamento, ambiente }))))
  ("NFC-e/$codigo/$ambiente mantém a representação de cartão externo sem exigir quitação", async ({ tipo, codigo, ambiente }) => {
    const p = massa(); p.formaPagamentoInformada = tipo; p.pagamentoInformadoSnapshot = { tipo, formaId: "cartao-exclusivamente-sintetico", parcelas: 1 };
    const antes = JSON.stringify(p);
    const r = await calcularPreviaPedido(tx, p, "65", { ambiente, consumidorFinal: true, indicadorIe: 9, indicadorPresenca: 1, pagamentoCartaoNaoIntegrado: true });
    expect(r.pendencias).not.toContain(pendenciaCartao);
    expect(r.pendencias).toContain("Revisão de parâmetros ainda pendente.");
    expect(r.pendencias).toContain("Linhas fiscais não fecham com subtotal menos desconto do pedido.");
    expect(r.apto).toBe(false);
    expect(r.pagamentoCartaoNaoIntegrado).toBe(true);
    expect(r.documento.Pagamentos).toEqual([{ FormaPagamento: codigo, VlPago: "165.00", TipoIntegracao: false }]);
    expect(JSON.stringify(p)).toBe(antes);
  });
  it.each([false, null, "true", 1])("recusa confirmação de cartão inválida %s sem converter para true", async pagamentoCartaoNaoIntegrado => {
    const p = massa(); p.formaPagamentoInformada = "CARTAO_CREDITO"; p.pagamentoInformadoSnapshot = { tipo: "CARTAO_CREDITO" };
    await expect(calcularPreviaPedido(tx, p, "65", { pagamentoCartaoNaoIntegrado } as never)).rejects.toThrow("Contexto fiscal da operação inválido.");
  });
  it("não amplia a aceitação de cartão não integrado para outra UF", async () => {
    const perfil = s.versoes.find(v => v.tipo === "PERFIL")!; (perfil.dados as PerfilFiscal).uf = "MG";
    const p = massa(); p.formaPagamentoInformada = "CARTAO_CREDITO"; p.pagamentoInformadoSnapshot = { tipo: "CARTAO_CREDITO" };
    const r = await calcularPreviaPedido(tx, p, "65", { indicadorPresenca: 1, pagamentoCartaoNaoIntegrado: true });
    expect(r.pendencias).toContain("Pagamento com cartão não integrado: este fluxo está validado somente para emitente de São Paulo. Confira as exigências da UF do emitente antes de emitir NFC-e.");
    expect(r.pagamentoCartaoNaoIntegrado).toBeUndefined();
    expect(r.documento.Pagamentos).toEqual([{ FormaPagamento: "03", VlPago: "165.00" }]);
  });
  it.each(["PIX", "DINHEIRO"])("confirmação de cartão não altera outro pagamento %s", async tipo => {
    const p = massa(); p.formaPagamentoInformada = tipo; p.pagamentoInformadoSnapshot = { tipo };
    const r = await calcularPreviaPedido(tx, p, "65", { indicadorPresenca: 1, pagamentoCartaoNaoIntegrado: true });
    expect(r.pagamentoCartaoNaoIntegrado).toBeUndefined();
    expect(r.documento.Pagamentos).toEqual([{ FormaPagamento: tipo === "PIX" ? "17" : "01", VlPago: "165.00" }]);
  });
  it("confirmação de cartão não altera o contrato de NF-e55", async () => {
    const p = massa(); p.formaPagamentoInformada = "CARTAO_CREDITO"; p.pagamentoInformadoSnapshot = { tipo: "CARTAO_CREDITO" };
    const r = await calcularPreviaPedido(tx, p, "55", { indicadorPresenca: 1, pagamentoCartaoNaoIntegrado: true });
    expect(r.pagamentoCartaoNaoIntegrado).toBeUndefined();
    expect(r.documento.Pagamentos).toEqual([{ FormaPagamento: "03", VlPago: "165.00" }]);
  });
  it.each(pagamentosCartao.flatMap(pagamento => (["HOMOLOGACAO", "PRODUCAO"] as const).map(ambiente => ({ ...pagamento, ambiente }))))
  ("montador real55/$codigo/$ambiente preserva pagamento sem card e valida o total", ({ codigo, ambiente }) => {
    const m = massaPayloadLocal(), base = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros, ambiente);
    const pagamentos = [{ FormaPagamento: codigo, VlPago: "24.53" }];
    const fotografia = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, emitenteIE: m.parametros.emitente.ie, crt: 1,
      documento: { ...base.payload!, Pagamentos: pagamentos }, previa: { contexto: { data: "2026-10-15" } } } } };
    const antes = JSON.stringify(fotografia), r = prepararPayloadSnapshotBrasilNfeLocal(fotografia, 55, { cnpj: m.cadastro.cnpj, ambiente });
    expect(r.montagemConcluida).toBe(true); expect(r.transmissaoPermitida).toBe(false);
    expect(r.payload?.Pagamentos).toEqual(pagamentos);
    const corpo = JSON.parse(serializarPayloadLocalBrasilNfe(r));
    expect(corpo.Pagamentos).toEqual([{ FormaPagamento: codigo, VlPago: 24.53 }]);
    expect(JSON.stringify(fotografia)).toBe(antes);
    const divergente = { ...fotografia, payload: { ...fotografia.payload, tributacao: { ...fotografia.payload.tributacao,
      documento: { ...fotografia.payload.tributacao.documento, Pagamentos: [{ FormaPagamento: codigo, VlPago: "24.52" }] } } } };
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(divergente, 55, { cnpj: m.cadastro.cnpj, ambiente })).toThrow("Pagamentos fiscais não fecham com o documento.");
  });
});
