import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { analisarEnderecoShippingHistorico, criarEntregaHistorica, entregaHistoricaProjetadaValida, hashEntradaFonteEntregasHistoricas, validarFonteEntregasHistoricas } from "@/lib/vendas/entregas-historicas-dominio";
import { planejarEnriquecimentoEntregas, type FonteVinculadaEntrega } from "@/lib/vendas/entregas-historicas";
import { entregaProjetadaSintetica, fonteEntregasSintetica, SHIPPING_SINTETICO } from "./entregas-historicas.fixture";

function vinculada(dados: Partial<FonteVinculadaEntrega> = {}): FonteVinculadaEntrega {
  return { id: "fonte-historica", destinoId: "pedido-historico", chave: "55", origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "PEDIDO_HISTORICO", dadosOrigem: { registro: { fonteOriginal: "intacta" }, hub: { parcelaNaoDetalhada: { valor: "5" } } }, pedido: { id: "pedido-historico", status: "HISTORICO", origem: "HISTORICO_LEGADO", referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: "55" }, ...dados };
}
const entrada = () => ({ fonte: fonteEntregasSintetica(), fonteSha256: "a".repeat(64), loteId: "entregas-sinteticas" });
describe("Shipping histórico: fonte, parser e plano consultivo", () => {
  it("usa o CEP terminal com UF e município, não um bloco numérico de complemento nem bairro inventado", () => {
    expect(analisarEnderecoShippingHistorico(SHIPPING_SINTETICO)).toMatchObject({ modalidade: "ENTREGA_INFORMADA", cep: "12345678", cidade: "São Paulo", uf: "SP", bairro: null, provas: { cep: { confirmado: true } } });
  });
  it.each([null, "", "  \n "])("endereço vazio é retirada por instrução expressa, não prova da planilha: %j", endereco => {
    expect(analisarEnderecoShippingHistorico(endereco)).toMatchObject({ modalidade: "RETIRADA", criterioModalidade: "USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE", cep: null, cidade: null, bairro: null });
  });
  it.each(["Texto incompleto", "Destinatário fictício\nRua Sintética\nSem cidade\nCEP inválido"])("endereço preenchido incompleto não vira retirada: %s", endereco => {
    expect(analisarEnderecoShippingHistorico(endereco)).toMatchObject({ modalidade: "ENTREGA_INFORMADA", cep: null, cidade: null, uf: null });
  });
  it("só usa bairro explicitamente rotulado e recusa cidade/UF contraditórias", () => {
    const texto = "Destinatário fictício\nRua Sintética, 10\nBairro: Centro sintético\nCidade sintética\nUF: SP\n12345-678";
    expect(analisarEnderecoShippingHistorico(texto)).toMatchObject({ bairro: "Centro sintético", cidade: "Cidade sintética", uf: "SP", cep: "12345678" });
    expect(analisarEnderecoShippingHistorico(texto.replace("Cidade sintética", "Cidade sintética - RJ"))).toMatchObject({ modalidade: "ENTREGA_INFORMADA", bairro: null, cidade: null, uf: null, cep: null });
  });
  it("valida fonte aprovada, coluna Shipping, números exatos e duplicidades", () => {
    expect(validarFonteEntregasHistoricas(fonteEntregasSintetica()).linhas).toHaveLength(1);
    const outraColuna = fonteEntregasSintetica(); outraColuna.colunas.I = "Full Adress (Billing)" as "Full Address (Shipping)";
    expect(() => validarFonteEntregasHistoricas(outraColuna)).toThrow("FONTE_INVALIDA");
    const duplicada = fonteEntregasSintetica(); duplicada.linhas.push({ ...duplicada.linhas[0], linha: 3 });
    expect(() => validarFonteEntregasHistoricas(duplicada)).toThrow("DUPLICADA");
    expect(() => validarFonteEntregasHistoricas({ ...fonteEntregasSintetica(), spreadsheetId: "outra-fonte" })).toThrow("FONTE_INVALIDA");
  });
  it("só preenche bairro postal quando CEP, município e UF são compatíveis, com proveniência", () => {
    const fonte = fonteEntregasSintetica(), postal = { versao: 1 as const, origem: "VIACEP" as const, consultadoEm: "2026-10-15T12:00:00Z", resultados: { "12345678": { cep: "12345678", bairro: "Bairro postal sintético", cidade: "São Paulo", uf: "SP", consultadoEm: "2026-10-15T12:00:00Z" } } };
    const e = criarEntregaHistorica(fonte, fonte.linhas[0], "a".repeat(64), postal, "b".repeat(64));
    expect(e).toMatchObject({ enderecoOriginal: SHIPPING_SINTETICO, bairro: "Bairro postal sintético", postal: { compativel: true, origem: "VIACEP" }, provas: { bairro: { origem: "VIACEP", precisao: "postal" } } });
    postal.resultados["12345678"].cidade = "Outra cidade";
    expect(criarEntregaHistorica(fonte, fonte.linhas[0], "a".repeat(64), postal, "b".repeat(64))).toMatchObject({ bairro: null, cidade: "São Paulo", postal: { compativel: false, conflitos: ["CIDADE_DIVERGENTE"] } });
    expect(() => hashEntradaFonteEntregasHistoricas(fonte, "a".repeat(64), postal)).toThrow("HASH_POSTAL_INVALIDO");
  });
  it("não confunde proveniência de cobrança ou de outro pedido com Shipping", () => {
    const e = entregaProjetadaSintetica(); expect(entregaHistoricaProjetadaValida(e, "55")).toMatchObject({ modalidade: "ENTREGA", cep: "12345678" });
    expect(entregaHistoricaProjetadaValida(e, "56")).toBeNull(); expect(entregaHistoricaProjetadaValida({ ...e, origem: "cobranca" }, "55")).toBeNull();
    expect(entregaHistoricaProjetadaValida(entregaProjetadaSintetica(null), "55")).toMatchObject({ modalidade: "RETIRADA", cep: null });
    expect(entregaHistoricaProjetadaValida({ ...e, modalidade: "RETIRADA", criterioModalidade: "USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE" }, "55")).toBeNull();
  });
  it("plano estritamente ligado mantém pedido e JSON comercial originais e é idempotente", () => {
    const f = vinculada(), original = structuredClone(f), p = planejarEnriquecimentoEntregas(entrada(), [f]);
    expect(p.contagens).toMatchObject({ aplicar: 1, conflitos: 0, semVinculo: 0 }); expect(f).toEqual(original);
    expect(p.backupMetadados.linhas[0]).toMatchObject({ fonteId: f.id, antesPresente: false, antes: null });
    f.dadosOrigem = { ...f.dadosOrigem as object, hub: { parcelaNaoDetalhada: { valor: "5" }, entregaHistorica: p.linhas[0].depois } };
    expect(planejarEnriquecimentoEntregas(entrada(), [f]).contagens).toMatchObject({ aplicar: 0, manter: 1 });
  });
  it("não cria pedido para linha sem vínculo nem aceita número nativo como vínculo", () => {
    expect(planejarEnriquecimentoEntregas(entrada(), []).contagens).toMatchObject({ semVinculo: 1, aplicar: 0 });
    const f = vinculada(); f.pedido!.status = "CONFIRMADO"; f.pedido!.origem = "INTERNO";
    expect(planejarEnriquecimentoEntregas(entrada(), [f]).contagens).toMatchObject({ conflitos: 1, aplicar: 0 });
  });
  it.each([{}, { hub: null }, { hub: [] }, { hub: { entregaHistorica: { origem: "anotacao-manual" } } }])("hub ausente/inválido ou metadado diferente fica conflito sem sobrescrever: %j", dadosOrigem => {
    expect(planejarEnriquecimentoEntregas(entrada(), [vinculada({ dadosOrigem })]).contagens).toMatchObject({ conflitos: 1, aplicar: 0 });
  });
  it("mudança da fonte, do cache ou do JSON atual invalida o token da prévia", () => {
    const e = entrada(), f = vinculada(), p = planejarEnriquecimentoEntregas(e, [f]);
    expect(planejarEnriquecimentoEntregas({ ...e, fonteSha256: "c".repeat(64) }, [f]).token).not.toBe(p.token);
    f.dadosOrigem = { hub: { outraChavePreservada: true } };
    expect(planejarEnriquecimentoEntregas(e, [f]).token).not.toBe(p.token);
  });
});
