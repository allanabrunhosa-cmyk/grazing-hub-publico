import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
import { prepararPayloadLocalBrasilNfe, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
const preparar = (m: ReturnType<typeof massaPayloadLocal>, modelo: 55 | 65 = 55) => prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros);
function massaRecolhimentoDas(crt: 1 | 2 | 3 | 4 = 1, cst = "49") {
  const m = massaPayloadLocal(); m.parametros.emitente.crt = crt;
  Object.assign(m.documento.payload.itens[0].fiscal.produto, { pis: cst, cofins: cst, ...(crt === 2 || crt === 3 ? { csosn: "", cstIcms: "40" } : {}) });
  Object.assign(m.parametros.itens[0], { pis: { tratamento: "RECOLHIDO_DAS" }, cofins: { tratamento: "RECOLHIDO_DAS" } });
  m.documento.hashPayload = createHash("sha256").update(JSON.stringify(m.documento.payload)).digest("hex");
  m.parametros.vinculo.hashPayload = m.documento.hashPayload;
  return m;
}

describe("Montagem e pré-validação locais Brasil NFe — sem HTTP", () => {
  it.each([55, 65] as const)("monta %s, fecha valores, preserva fotografia e mantém envio bloqueado", modelo => {
    const m = massaPayloadLocal(), antes = JSON.stringify(m), fetch = vi.spyOn(globalThis, "fetch");
    try {
      const r = preparar(m, modelo);
      expect(r.pendencias).toEqual([]); expect(r.montagemConcluida).toBe(true); expect(r.transmissaoPermitida).toBe(false);
      expect(r.payload).toMatchObject({ IdentificadorInterno: m.documento.id, ModeloDocumento: modelo, TipoAmbiente: 2, EnviarEmail: false, ValorTotal: "24.53" });
      expect(r.payload!.Produtos[0]).toMatchObject({ Quantidade: "2", ValorUnitario: "13.25", ValorTotal: "26.50", ValorDesconto: "2.00", ValorFrete: "0.02", ValorOutrasDespesas: "0.01", QuantidadeTributavel: "2.0000", ValorUnitarioTributavel: "13.2500000000" });
      expect(r.payload!.Pagamentos[0].VlPago).toBe("24.53");
      for (const campo of ["ValorFrete", "ValorDesconto", "Serie", "Numero", "Lote", "Codigo", "Token", "UserToken", "CSC", "Certificado"]) expect(r.payload).not.toHaveProperty(campo);
      expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(m)).toBe(antes);
    } finally { fetch.mockRestore(); }
  });
  it("pendências identificam campo, item, produto, operação e responsável, sem inventar classificação", () => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.ncm = "";
    const r = preparar(m, 65);
    expect(r.payload).toBeNull(); expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].NCM", codigo: "AUSENTE", itemId: "item-ficticio", produtoId: "produto-ficticio", operacao: "NFC_E_VENDA", responsavel: "REVISAO_FISCAL" }));
    expect(() => serializarPayloadLocalBrasilNfe(r)).toThrow("inválido");
  });
  it.each([55, 65] as const)("GTIN ausente/inválido bloqueia modelo%s por item sem copiar código do grupo", modelo => {
    for (const ean of ["", "12345671", "00000000", "00000000000000", "12345670\n"]) {
      const m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.ean = ean;
      Object.assign(m.documento.payload.itens[0].fiscal, { grupo: { ean: "12345670" } });
      const antes = JSON.stringify(m), fetch = vi.spyOn(globalThis, "fetch");
      try {
        const r = preparar(m, modelo);
        expect(r.montagemConcluida).toBe(false); expect(r.payload).toBeNull(); expect(r.transmissaoPermitida).toBe(false);
        expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].EAN", codigo: ean ? "FORMATO" : "AUSENTE", itemId: "item-ficticio", produtoId: "produto-ficticio" }));
        expect(JSON.stringify(m)).toBe(antes); expect(fetch).not.toHaveBeenCalled();
      } finally { fetch.mockRestore(); }
    }
  });
  it.each(["12345670", "123456789012", "1234567890128", "12345678901231", "0123456789012", "SEM GTIN"])("conserva GTIN declarado %s como texto sem perder zero inicial", ean => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.ean = ean;
    const r = preparar(m); expect(r.pendencias).toEqual([]); expect(r.payload!.Produtos[0].EAN).toBe(ean);
    expect(JSON.parse(serializarPayloadLocalBrasilNfe(r)).Produtos[0].EAN).toBe(ean); expect(r.transmissaoPermitida).toBe(false);
  });
  it.each(["documentoId", "hashPayload", "revisaoPedido"] as const)("invalida parâmetro fiscal de outra identidade/revisão: %s", campo => {
    const m = massaPayloadLocal(); Object.assign(m.parametros.vinculo, { [campo]: campo === "revisaoPedido" ? 2 : "divergente" });
    expect(preparar(m).pendencias).toContainEqual(expect.objectContaining({ campo: "parametros.vinculo", codigo: "DIVERGENTE" }));
  });
  it("divergência de emitente não muda cadastro nem aceita a fotografia", () => {
    const m = massaPayloadLocal(); m.cadastro.cnpj = "11111111111111";
    expect(preparar(m).pendencias).toContainEqual(expect.objectContaining({ campo: "emitente.Cnpj", codigo: "DIVERGENTE" }));
    expect(m.documento.payload.emitente.cnpj).toBe("00000000000000");
  });
  it("configuração ausente produz pendências concretas e não usa o grupo como fallback", () => {
    const m = massaPayloadLocal();
    const r = prepararPayloadLocalBrasilNfe(m.documento, 55, { ...m.cadastro, enderecoEstruturado: null }, null);
    expect(r.payload).toBeNull(); expect(r.pendencias.some(p => p.campo === "emitente.Endereco.CodMunicipio")).toBe(true);
    expect(r.pendencias.some(p => p.campo === "Produtos[0].regraFiscal")).toBe(true);
  });
  it.each(["subtotal", "desconto", "total"] as const)("não corrige silenciosamente total comercial divergente: %s", campo => {
    const m = massaPayloadLocal(); m.documento.payload.valores[campo] = "100";
    expect(preparar(m).montagemConcluida).toBe(false);
  });
  it("rateia só frete/outros custos, com resíduo em centavos e desconto fotografado", () => {
    const m = massaPayloadLocal(), item = m.documento.payload.itens[0], regra = m.parametros.itens[0];
    m.documento.payload.itens.push({ ...structuredClone(item), id: "item-2" });
    m.parametros.itens.push({ ...structuredClone(regra), itemId: "item-2" });
    Object.assign(m.documento.payload.valores, { subtotal: "53.00", desconto: "4.00", total: "49.03" });
    const r = preparar(m); expect(r.pendencias).toEqual([]);
    expect(r.payload!.Produtos.map(p => p.ValorFrete)).toEqual(["0.01", "0.01"]);
    expect(r.payload!.Produtos.map(p => p.ValorOutrasDespesas)).toEqual(["0.01", "0.00"]);
    expect(r.payload!.Produtos.map(p => p.ValorDesconto)).toEqual(["2.00", "2.00"]);
  });
  it("conversão tributável explícita conserva o bruto", () => {
    const m = massaPayloadLocal(); m.parametros.itens[0].fatorTributavel = "2.5";
    expect(preparar(m).payload!.Produtos[0]).toMatchObject({ QuantidadeTributavel: "5.0000", ValorUnitarioTributavel: "5.3000000000" });
  });
  it.each(["1.000001", "1e2", "-1", "um", "0"])("rejeita quantidade imprecisa/indevida %s sem arredondar o snapshot", q => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].quantidade = q;
    expect(preparar(m).pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].Quantidade", codigo: "FORMATO" }));
  });
  it("ICMS/PIS/COFINS tributados usam apenas bases/alíquotas explícitas e mantêm precisão no JSON", () => {
    const m = massaPayloadLocal(); m.parametros.emitente.crt = 3;
    Object.assign(m.documento.payload.itens[0].fiscal.produto, { csosn: "", cstIcms: "00", pis: "01", cofins: "02" });
    Object.assign(m.parametros.itens[0], { icms: { tratamento: "TRIBUTADO", BaseCalculo: "24.50", AliquotaICMS: "18.1234", modalidadeBcIcms: 3 }, pis: { tratamento: "TRIBUTADO", BaseCalculo: "24.50", Aliquota: "1.6500" }, cofins: { tratamento: "TRIBUTADO", BaseCalculo: "24.50", Aliquota: "7.6000" } });
    const r = preparar(m); expect(r.pendencias).toEqual([]);
    expect(r.payload!.Produtos[0].Imposto.ICMS.ValorIcms).toBe("4.44");
    const corpo = serializarPayloadLocalBrasilNfe(r);
    expect(corpo).toContain('"AliquotaICMS":18.1234'); expect(corpo).toContain('"ValorUnitarioTributavel":13.2500000000');
    expect(JSON.parse(corpo).Produtos[0].Imposto.PIS.Aliquota).toBe(1.65);
  });
  it.each(([55, 65] as const).flatMap(modelo => ([1, 2, 4] as const).flatMap(crt => ["49", "99"].map(cst => ({ modelo, crt, cst })))))("DAS explicitamente configurado: modelo$modelo CRT$crt CST$cst, sem calcular contribuições ou autorizar emissão", ({ modelo, crt, cst }) => {
    const m = massaRecolhimentoDas(crt, cst), antes = JSON.stringify(m), fetch = vi.spyOn(globalThis, "fetch");
    try {
      const r = preparar(m, modelo); expect(r.pendencias).toEqual([]); expect(r.montagemConcluida).toBe(true); expect(r.transmissaoPermitida).toBe(false);
      expect(r.payload!.Produtos[0].Imposto.PIS).toEqual({ CodSituacaoTributaria: cst, BaseCalculo: "0.00", Aliquota: "0.0000" });
      expect(r.payload!.Produtos[0].Imposto.COFINS).toEqual({ CodSituacaoTributaria: cst, BaseCalculo: "0.00", Aliquota: "0.0000" });
      expect(r.payload!.Produtos[0]).toMatchObject({ Quantidade: "2", ValorUnitario: "13.25", ValorTotal: "26.50", ValorDesconto: "2.00", ValorFrete: "0.02", ValorOutrasDespesas: "0.01" });
      expect(r.payload!.ValorTotal).toBe("24.53"); expect(r.payload!.Pagamentos[0].VlPago).toBe("24.53");
      const corpo = serializarPayloadLocalBrasilNfe(r); expect(corpo).toContain('"BaseCalculo":0.00'); expect(corpo).toContain('"Aliquota":0.0000');
      expect(corpo).toContain('"ValorUnitarioTributavel":13.2500000000');
      expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(m)).toBe(antes); expect(r).not.toHaveProperty("aprovacaoInterna");
    } finally { fetch.mockRestore(); }
  });
  it.each([55, 65] as const)("DAS não atende CRT3 no modelo%s, e resultado bloqueado não é serializável", modelo => {
    const r = preparar(massaRecolhimentoDas(3), modelo);
    expect(r.payload).toBeNull(); expect(r.montagemConcluida).toBe(false); expect(r.transmissaoPermitida).toBe(false);
    for (const tributo of ["PIS", "COFINS"]) expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: `Produtos[0].${tributo}.tratamento`, codigo: "DIVERGENTE" }));
    expect(() => serializarPayloadLocalBrasilNfe(r)).toThrow("inválido");
  });
  it.each((["pis", "cofins"] as const).flatMap(tributo => ["01", "04", "07", "50", "98", "", "0", "999"].map(cst => ({ tributo, cst }))))("DAS rejeita CST$cst de $tributo, sem trocar classificação", ({ tributo, cst }) => {
    const m = massaRecolhimentoDas(); m.documento.payload.itens[0].fiscal.produto[tributo] = cst;
    const antes = JSON.stringify(m);
    for (const modelo of [55, 65] as const) {
      const r = preparar(m, modelo); expect(r.payload).toBeNull(); expect(r.transmissaoPermitida).toBe(false);
      expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: `Produtos[0].${tributo.toUpperCase()}.CodSituacaoTributaria`, codigo: "DIVERGENTE" }));
    }
    expect(JSON.stringify(m)).toBe(antes);
  });
  it.each((["pis", "cofins"] as const).flatMap(tributo => ["BaseCalculo", "Aliquota", "Valor", "AliquotaPorQuantidade"].map(campo => ({ tributo, campo }))))("DAS rejeita parâmetro $campo em $tributo mesmo que monetariamente zero", ({ tributo, campo }) => {
    const m = massaRecolhimentoDas(); Object.assign(m.parametros.itens[0][tributo], { [campo]: "0" });
    for (const modelo of [55, 65] as const) {
      const r = preparar(m, modelo); expect(r.payload).toBeNull(); expect(r.transmissaoPermitida).toBe(false);
      expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: `Produtos[0].${tributo.toUpperCase()}.tratamento`, codigo: "DIVERGENTE" }));
    }
  });
  it("DAS não é inferido de CST49/99 e não modifica o contrato sem destaque anterior", () => {
    const anterior = massaPayloadLocal(), original = JSON.stringify(anterior), antes = preparar(anterior);
    expect(antes.payload!.Produtos[0].Imposto.PIS).toEqual({ CodSituacaoTributaria: "07" });
    expect(antes.payload!.Produtos[0].Imposto.COFINS).toEqual({ CodSituacaoTributaria: "07" });
    expect(JSON.stringify(anterior)).toBe(original);
    const m = massaRecolhimentoDas(); m.parametros.itens[0].pis = { tratamento: "SEM_DESTAQUE" };
    const r = preparar(m); expect(r.payload).toBeNull(); expect(r.pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].PIS.tratamento", codigo: "DIVERGENTE" }));
    const misto = massaRecolhimentoDas(); misto.parametros.itens[0].cofins = { tratamento: "SEM_DESTAQUE" }; misto.documento.payload.itens[0].fiscal.produto.cofins = "07";
    expect(preparar(misto).payload!.Produtos[0].Imposto.COFINS).toEqual({ CodSituacaoTributaria: "07" });
  });
  it.each(["ipiAplicavel", "stAplicavel", "fcpAplicavel", "difalAplicavel", "ibsCbsAplicavel", "beneficioFiscalAplicavel"] as const)("tributação aplicável %s bloqueia o recorte até extensão específica", campo => {
    const m = massaPayloadLocal(); m.parametros.itens[0][campo] = true;
    expect(preparar(m).pendencias).toContainEqual(expect.objectContaining({ campo: `Produtos[0].${campo}`, codigo: "NAO_SUPORTADO" }));
  });
  it("CSOSN/CST incompatíveis e alíquota ausente não recebem defaults", () => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.cstIcms = "00";
    expect(preparar(m).pendencias.some(p => p.campo === "Produtos[0].ICMS")).toBe(true);
    m.documento.payload.itens[0].fiscal.produto.csosn = ""; m.parametros.emitente.crt = 3;
    Object.assign(m.parametros.itens[0], { icms: { tratamento: "TRIBUTADO", BaseCalculo: "24.50", modalidadeBcIcms: 3 } });
    expect(preparar(m).pendencias.some(p => p.campo.endsWith("AliquotaICMS") && p.codigo === "AUSENTE")).toBe(true);
  });
  it("CEST requer decisão explícita e código quando aplicável", () => {
    const m = massaPayloadLocal(); m.parametros.itens[0].cestAplicavel = true;
    expect(preparar(m).pendencias.some(p => p.campo.endsWith("CEST") && p.codigo === "AUSENTE")).toBe(true);
  });
  it("NF-e identifica destinatário; NFC-e anônima só fora da entrega domiciliar", () => {
    const m = massaPayloadLocal(); m.parametros.destinatario = { identificar: false };
    expect(preparar(m, 55).payload).toBeNull(); expect(preparar(m, 65).payload).not.toBeNull();
    m.parametros.operacao.IndicadorPresenca = 4;
    expect(preparar(m, 65).pendencias.some(p => p.campo === "Cliente")).toBe(true);
  });
  it("NFC-e rejeita CFOP não documentado e consumidor contribuinte", () => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.cfop = "6102";
    m.parametros.destinatario = { ...m.parametros.destinatario, identificar: true, origem: "comprador", IndicadorIe: 1, endereco: m.cadastro.enderecoEstruturado };
    expect(preparar(m, 65).pendencias.some(p => p.campo.endsWith("CFOP"))).toBe(true);
    expect(preparar(m, 65).pendencias.some(p => p.campo === "Cliente.IndicadorIe")).toBe(true);
  });
  it("pagamentos/parcelas e cobrança não reaplicam desconto nem deduzem taxa financeira", () => {
    const m = massaPayloadLocal(); m.parametros.pagamentos.fonte = "PARCELAS"; m.parametros.pagamentos.incluirCobranca = true;
    const r = preparar(m); expect(r.pendencias).toEqual([]);
    expect(r.payload!.Cobranca!.Fatura).toMatchObject({ Valor: "24.53", Desconto: "0.00", ValorLiquido: "24.53" });
    m.documento.payload.parcelas[0].valor = "23.00";
    expect(preparar(m).pendencias.some(p => p.campo === "Pagamentos.VlPago")).toBe(true);
  });
  it("forma fiscal ausente, cartão sem autorização e troco não fotografado geram pendência", () => {
    const m = massaPayloadLocal(); m.parametros.pagamentos.mapeamentos = [];
    expect(preparar(m).pendencias.some(p => p.campo.endsWith("FormaPagamento"))).toBe(true);
    m.parametros.pagamentos.mapeamentos = [{ formaId: "forma-ficticia", FormaPagamento: "03", IndicadorPagamento: 0 }];
    expect(preparar(m).pendencias.some(p => p.campo.endsWith("NumeroAutorizacao"))).toBe(true);
    m.parametros.pagamentos.troco = "1.00";
    expect(preparar(m).pendencias.some(p => p.campo === "Pagamentos.VlTroco" && p.codigo === "NAO_SUPORTADO")).toBe(true);
  });
  it("não serializa resultados adulterados e não carrega campos estranhos/segredos", () => {
    const m = massaPayloadLocal(); Object.assign(m.parametros, { Token: "SEGREDO_TESTE", CSC: "SEGREDO_TESTE" });
    const r = preparar(m); expect(serializarPayloadLocalBrasilNfe(r)).not.toContain("SEGREDO_TESTE");
    expect(Object.isFrozen(r.payload!.Produtos[0])).toBe(true);
    expect(() => serializarPayloadLocalBrasilNfe({ ...r, payload: { ...r.payload!, TipoAmbiente: 2 } })).toThrow("inválido");
  });
  it("limita listas e identifica caracteres indevidos sem ecoar o conteúdo no erro", () => {
    const m = massaPayloadLocal(); m.parametros.itens = Array(991).fill(m.parametros.itens[0]);
    expect(preparar(m).pendencias.some(p => p.campo === "parametros.itens" && p.codigo === "FORMATO")).toBe(true);
    m.documento.payload.itens[0].fiscal.produto.ncm = "<SEGREDO_TESTE>";
    expect(JSON.stringify(preparar(m).pendencias)).not.toContain("SEGREDO_TESTE");
  });
  it("conversão que excede os limites fiscais e vencimento inexistente são pendências, sem truncamento", () => {
    const m = massaPayloadLocal(); m.parametros.itens[0].fatorTributavel = "0.000001";
    expect(preparar(m).pendencias.some(p => p.campo === "Produtos[0].QuantidadeTributavel")).toBe(true);
    m.parametros.itens[0].fatorTributavel = "1"; m.parametros.pagamentos.incluirCobranca = true;
    m.documento.payload.parcelas[0].dataVencimento = "2026-02-30T00:00:00.000Z";
    expect(preparar(m).pendencias.some(p => p.campo === "Cobranca.Parcelas[0].Vencimento" && p.codigo === "FORMATO")).toBe(true);
  });
  it("produto alterado exige regra fiscal para a revisão fotografada e exportação exige extensão", () => {
    const m = massaPayloadLocal(); m.parametros.itens[0].versaoCadastro = 2;
    expect(preparar(m).pendencias.some(p => p.campo === "Produtos[0].regraFiscal" && p.codigo === "DIVERGENTE")).toBe(true);
    m.parametros.itens[0].versaoCadastro = 1; m.documento.payload.itens[0].fiscal.produto.cfop = "7102";
    expect(preparar(m).pendencias.some(p => p.campo === "Produtos[0].CFOP" && p.codigo === "NAO_SUPORTADO")).toBe(true);
  });
  it.each(["Quantidade", "ValorUnitario"])("limite de onze inteiros no leiaute fiscal é distinto do banco: %s", campo => {
    const m = massaPayloadLocal(), item = m.documento.payload.itens[0];
    Object.assign(item, campo === "Quantidade" ? { quantidade: "100000000000", preco: "0.01", acrescimos: "0", desconto: "0", total: "1000000000.00" } : { quantidade: "0.0001", preco: "100000000000.00", acrescimos: "0", desconto: "0", total: "10000000.00" });
    Object.assign(m.documento.payload.valores, { subtotal: item.total, desconto: "0", frete: "0", outrosCustos: "0", total: item.total });
    expect(preparar(m).pendencias).toContainEqual(expect.objectContaining({ campo: `Produtos[0].${campo}`, codigo: "FORMATO" }));
  });
  it("montagem produtiva é local e preserva bloqueio; modelo indevido falha", () => {
    const m = massaPayloadLocal();
    const local = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros, "PRODUCAO");
    expect(local.payload?.TipoAmbiente).toBe(1); expect(local.transmissaoPermitida).toBe(false);
    expect(() => prepararPayloadLocalBrasilNfe(m.documento, 57 as 55, m.cadastro, m.parametros)).toThrow("inválido");
  });
});
