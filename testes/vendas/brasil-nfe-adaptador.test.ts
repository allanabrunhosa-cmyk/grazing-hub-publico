import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type { ConfiguracaoBrasilNfe, DocumentoBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-contrato";
import type { IdentidadeFiscalSaida } from "@/lib/fiscal-saida/contrato";
vi.mock("server-only", () => ({}));
// Simula somente o transporte do contrato futuro; a liberação real permanece falsa.
vi.mock("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao", () => ({ exigirTransmissaoBrasilNfeLiberada: () => {}, transmissaoBrasilNfeLiberada: () => true }));
import { criarAdaptadorBrasilNfe, ErroValidacaoSnapshotBrasilNfe, validarSnapshotBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
import { obterAdaptadorFiscalSaida } from "@/lib/fiscal-saida/provedor";
import { hojeFiscal } from "@/lib/tributacao/validacao";
import { aplicarLayoutRtc, type SnapshotLayoutRtc } from "@/lib/tributacao/layout-rtc";

const c: ConfiguracaoBrasilNfe = { token: "token-empresa-ficticio", userToken: "token-usuario-ficticio", cnpj: "12345678000195", ambiente: "HOMOLOGACAO", consultaIdentificadorValidada: true, homologacaoReferencia: "evidencia-interna-ficticia", producaoAutorizada: false };
const i: IdentidadeFiscalSaida = { documentoId: "doc-ficticio", ambiente: "HOMOLOGACAO", referencia: null, chaveIdempotencia: "doc-ficticio" };
const chave = "35261012345678000195550010000001281123456789";
function documento(): DocumentoBrasilNfe {
  return { ModeloDocumento: 55, TipoAmbiente: 2, NaturezaOperacao: "Venda de mercadoria", Finalidade: 1, IndicadorPresenca: 2, ConsumidorFinal: true, ValorTotal: "29.97", Produtos: [{ NmProduto: "Produto sintético", CodProdutoServico: "SKU-TESTE", NCM: "19053100", EAN: "SEM GTIN", OrigemProduto: 0, CFOP: 5102, UnidadeComercial: "UN", UnidadeComercialTributavel: "UN", Quantidade: "3", QuantidadeTributavel: "3", ValorUnitario: "9.99", ValorUnitarioTributavel: "9.99", ValorTotal: "29.97", Imposto: { ICMS: { CodSituacaoTributaria: "102" }, PIS: { CodSituacaoTributaria: "49", Aliquota: "0" }, COFINS: { CodSituacaoTributaria: "49", Aliquota: "0" } } }], Pagamentos: [{ FormaPagamento: "17", VlPago: "29.97" }], Cliente: { CpfCnpj: "12345678901", NmCliente: "Cliente sintético", IndicadorIe: 9, Endereco: { Cep: "01001000", Logradouro: "Rua fictícia", Numero: "1", Bairro: "Bairro fictício", Municipio: "São Paulo", CodMunicipio: "3550308", Uf: "SP" } } };
}
function payload(d = documento()): Prisma.JsonValue {
  return JSON.parse(JSON.stringify({ schema: "grazing.fiscal-saida", versao: 2, valores: { total: "29.97" }, tributacao: { apto: true, pendencias: [], emitenteCnpj: c.cnpj, crt: 1, documento: d, previa: { contexto: { data: hojeFiscal() } } } })) as Prisma.JsonValue;
}
/** Os caminhos e percentuais abaixo são fixtures matemáticas; não documentam a API ou alíquotas legais. */
function payloadRtc2027(): Prisma.JsonValue {
  const d = documento();
  d.ValorTotal = "35.00";
  d.Pagamentos[0].VlPago = "35.00";
  Object.assign(d.Produtos[0], { ValorUnitario: "10.00", ValorUnitarioTributavel: "10.00", ValorTotal: "30.00", ValorFrete: "3.00", ValorOutrasDespesas: "2.00" });
  d.Produtos[0].Imposto.ICMS = { CodSituacaoTributaria: "00", BaseCalculo: "30.00", AliquotaICMS: "30", ValorIcms: "9.00" };
  d.Produtos[0].Imposto.IBSCBS = { CodSituacaoTributaria: "000", CodClassificacaoTributaria: "000001", BaseCalculo: "20.00", AliquotaCBS: "5", AliquotaIBSUF: "0", AliquotaIBSMun: "0" };
  const rtc2027: SnapshotLayoutRtc = {
    layout: {
      codigo: "NT2026.008", homologacaoComprovada: true, evidenciaHomologacao: "Fixture sintética para validação interna, sem prova externa.",
      campos: { valorProdutoLiquido: "FixtureRtc.ProdutoLiquido", valorUnitarioLiquido: "FixtureRtc.UnitarioLiquido", valorTotalItem: "FixtureRtc.TotalItem", valorLiquidoProdutosTotal: "FixtureRtc.ProdutosLiquidos", valorTotalDocumento: "FixtureRtc.TotalDocumento" },
    },
    produtos: [{ produtoLiquido: "20.00", unitarioLiquido: "6.6666666667", totalItem: "35.00" }],
    valorLiquidoProdutosTotal: "20.00", valorTotalDocumento: "35.00",
  };
  return JSON.parse(JSON.stringify({ schema: "grazing.fiscal-saida", versao: 2, valores: { total: "35.00" }, tributacao: { apto: true, pendencias: [], emitenteCnpj: c.cnpj, crt: 3, documento: aplicarLayoutRtc(d, rtc2027), rtc2027, previa: { contexto: { data: "2027-01-01" } } } })) as Prisma.JsonValue;
}
const ausente = { Encontrada: false, Nota: null, Historico: [], erros: [], avisos: [], status: 0 };
function nota(overrides = {}) {
  return { ModeloDocumento: 55, IdentificadorInterno: i.documentoId, Chave: chave, Numero: 128, Serie: "1", NumeroProtocolo: "135260000000123", CodTipoAmbiente: 2, Status: 1, Emitida: true, CodStatusResposta: 100, ...overrides };
}
function consulta(n = nota(), overrides = {}) { return { Encontrada: true, Nota: n, Historico: [], erros: [], status: 0, ...overrides }; }
function autorizacao(overrides = {}) { return { Error: "", ReturnNF: { ChaveNF: chave, Numero: 128, Serie: 1, NumeroProtocolo: "135260000000123", CodTipoAmbiente: 2, CodStatusRespostaSefaz: 100, Ok: true, ...overrides } }; }
function transporte(filas: Record<string, unknown[]>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(init?.method).toBe("POST");
    const metodo = String(url).split("/").at(-1)!;
    const r = filas[metodo]?.shift();
    if (r === undefined) throw new Error("Requisição imprevista no teste");
    if (r instanceof Error) throw r;
    if (r instanceof Response) return r;
    return Response.json(r);
  });
}
afterEach(() => { vi.unstubAllEnvs(); });

describe("Brasil NFe: adaptador real testado apenas com HTTP sintético", () => {
  it("NFC-e sem destinatário conserva o contrato existente e NF-e ou entrega continuam exigindo identificação", () => {
    const anonima = documento(); anonima.ModeloDocumento = 65; delete anonima.Cliente;
    expect(validarSnapshotBrasilNfe(payload(anonima), c).documento.Cliente).toBeUndefined();
    for (const [modelo, presenca] of [[55, 2], [65, 4]] as const) {
      const obrigatoria = documento(); obrigatoria.ModeloDocumento = modelo; obrigatoria.IndicadorPresenca = presenca; delete obrigatoria.Cliente;
      expect(() => validarSnapshotBrasilNfe(payload(obrigatoria), c)).toThrow(/destinatário/);
    }
  });
  it.each([55, 65] as const)("modelo %s identifica produto e campo fiscal ausente antes de qualquer HTTP", async modelo => {
    for (const [campo, rotulo] of [["NCM", "NCM"], ["EAN", "GTIN"], ["CFOP", "CFOP"], ["OrigemProduto", "Origem"], ["UnidadeComercialTributavel", "Unidade tributável"]]) {
      const d = documento(); d.ModeloDocumento = modelo;
      delete (d.Produtos[0] as unknown as Record<string, unknown>)[campo];
      const rede = transporte({});
      await expect(criarAdaptadorBrasilNfe(c, rede).enviar(i, payload(d))).rejects.toThrow(ErroValidacaoSnapshotBrasilNfe);
      await expect(criarAdaptadorBrasilNfe(c, rede).enviar(i, payload(d))).rejects.toThrow(new RegExp(`Produto 1 \\(Produto sintético\\).*${rotulo}`));
      expect(rede).not.toHaveBeenCalled();
    }
  });
  it("erro fiscal identifica CST por tributo e não reflete conteúdo inválido do cadastro", () => {
    const d = documento(); d.Produtos[0].Imposto.PIS.CodSituacaoTributaria = "";
    expect(() => validarSnapshotBrasilNfe(payload(d), c)).toThrow("Produto 1 (Produto sintético): CST do PIS não informado");
    d.Produtos[0].NmProduto = "<script>SEGREDO-SINTETICO</script>"; d.Produtos[0].NCM = "";
    try { validarSnapshotBrasilNfe(payload(d), c); expect.fail("A ficha deve ser bloqueada"); }
    catch (erro) { expect(erro).toBeInstanceOf(ErroValidacaoSnapshotBrasilNfe); expect((erro as Error).message).toContain("Produto 1: NCM"); expect((erro as Error).message).not.toContain("SEGREDO-SINTETICO"); }
  });
  it("erro de endereço identifica o campo sem devolver CPF ou endereço do cliente", () => {
    const d = documento(); delete d.Cliente!.Endereco!.CodMunicipio;
    expect(() => validarSnapshotBrasilNfe(payload(d), c)).toThrow("Código IBGE do município do destinatário não informado");
  });
  it("preserva pagamento com cartão não integrado na serialização da NFC-e", async () => {
    const d = documento(); d.ModeloDocumento = 65; d.IndicadorPresenca = 1;
    d.Pagamentos = [{ FormaPagamento: "03", VlPago: "29.97", TipoIntegracao: false }];
    const chave65 = chave.slice(0, 20) + "65" + chave.slice(22);
    const rede = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao({ ChaveNF: chave65 })] });
    await criarAdaptadorBrasilNfe(c, rede).enviar(i, payload(d));
    expect(JSON.parse(String(rede.mock.calls[2][1]!.body)).Pagamentos).toEqual([{ FormaPagamento: "03", VlPago: 29.97, TipoIntegracao: false }]);
  });
  it("cartão integrado exige os dados da transação e não aceita texto como escolha de integração", () => {
    const d = documento(); d.ModeloDocumento = 65; d.IndicadorPresenca = 1;
    d.Pagamentos = [{ FormaPagamento: "03", VlPago: "29.97", TipoIntegracao: true }];
    expect(() => validarSnapshotBrasilNfe(payload(d), c)).toThrow("CNPJ da credenciadora do cartão integrado não informado");
    Object.assign(d.Pagamentos[0], { CNPJCredenciadora: "12345678000195" });
    expect(() => validarSnapshotBrasilNfe(payload(d), c)).toThrow("Autorização da transação do cartão integrado não informado");
    Object.assign(d.Pagamentos[0], { NumeroAutorizacao: "SINTETICO-1" });
    expect(validarSnapshotBrasilNfe(payload(d), c)).toMatchObject({ apto: true });
    Object.assign(d.Pagamentos[0], { TipoIntegracao: "false" });
    expect(() => validarSnapshotBrasilNfe(payload(d), c)).toThrow("tipo de integração do cartão inválido");
  });
  it("mantém provedor desligado sem configuração explícita e rejeita habilitação sem homologação", () => {
    vi.stubEnv("BRASIL_NFE_ATIVO", ""); expect(obterAdaptadorFiscalSaida()).toBeNull();
    expect(() => criarAdaptadorBrasilNfe({ ...c, consultaIdentificadorValidada: false })).toThrow("homologação");
    expect(() => criarAdaptadorBrasilNfe({ ...c, homologacaoReferencia: "" })).toThrow("homologação");
  });
  it("consulta ausência antes de transmitir, preserva precisão, identidade e desligamento de email", async () => {
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao()] });
    const a = criarAdaptadorBrasilNfe(c, f); const p = payload(); const r = await a.enviar(i, p);
    expect(r).toMatchObject({ status: "AUTORIZADO", numero: "128", chave, protocolo: "135260000000123" });
    expect(Number.isSafeInteger(r.sequencia)).toBe(true);
    expect(f.mock.calls.map(([u]) => String(u).split("/").at(-1))).toEqual(["BuscarEmpresa", "ConsultarNotaFiscal", "EnviarNotaFiscal"]);
    const envio = f.mock.calls[2][1]!; const body = JSON.parse(String(envio.body));
    expect(body).toMatchObject({ IdentificadorInterno: i.documentoId, ModeloDocumento: 55, TipoAmbiente: 2, EnviarEmail: false, ValorTotal: 29.97, Produtos: [{ Quantidade: 3, ValorUnitario: 9.99, ValorTotal: 29.97 }] });
    expect(body).not.toHaveProperty("Token"); expect(envio.redirect).toBe("error"); expect(envio.cache).toBe("no-store"); expect(p).toEqual(payload());
  });
  it("documento já autorizado retorna pela consulta sem emitir novamente", async () => {
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [consulta()] });
    expect(await criarAdaptadorBrasilNfe(c, f).enviar(i, payload())).toMatchObject({ status: "AUTORIZADO" });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("múltiplas tentativas e erro de consulta impedem envio", async () => {
    for (const resposta of [consulta(nota(), { Historico: [nota()] }), { ...ausente, status: 1 }, { ...ausente, erros: [{ codigo: "403" }] }, { Encontrada: false }]) {
      const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [resposta] });
      await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, payload())).rejects.toThrow();
      expect(f).toHaveBeenCalledTimes(2);
    }
  });
  it("produção permanece bloqueada antes de qualquer chamada externa", async () => {
    const f = transporte({}); const a = criarAdaptadorBrasilNfe({ ...c, ambiente: "PRODUCAO" }, f);
    await expect(a.enviar({ ...i, ambiente: "PRODUCAO" }, payload())).rejects.toThrow("não autorizada");
    await expect(a.cancelar({ ...i, ambiente: "PRODUCAO" }, "Motivo de teste válido")).rejects.toThrow("não autorizada");
    expect(f).not.toHaveBeenCalled();
  });
  it("token de empresa de outro CNPJ ou CRT divergente impede transmissão", async () => {
    for (const e of [{ CNPJ: "99999999000199", CRT: 1 }, { CNPJ: c.cnpj, CRT: 3 }]) {
      const f = transporte({ BuscarEmpresa: [e] });
      await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, payload())).rejects.toThrow("emitente"); expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it("cadastro do provedor aceita CNPJ com máscara, sem descartar letras para ocultar erro", async () => {
    const f = transporte({ BuscarEmpresa: [{ CNPJ: "12.345.678/0001-95", CRT: 1 }], ConsultarNotaFiscal: [consulta()] });
    expect(await criarAdaptadorBrasilNfe(c, f).enviar(i, payload())).toMatchObject({ status: "AUTORIZADO" });
    const invalido = transporte({ BuscarEmpresa: [{ CNPJ: "CNPJ12345678000195", CRT: 1 }] });
    await expect(criarAdaptadorBrasilNfe(c, invalido).enviar(i, payload())).rejects.toThrow("emitente");
  });
  it("preserva a consulta do emitente em snapshots legados sem IE fotografada", async () => {
    const p = payload(); const antes = JSON.stringify(p);
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [consulta()] });
    expect(await criarAdaptadorBrasilNfe(c, f).enviar(i, p)).toMatchObject({ status: "AUTORIZADO" });
    expect(f).toHaveBeenCalledTimes(2); expect(JSON.stringify(p)).toBe(antes);
  });
  it.each(["enviar", "preVisualizar"] as const)("%s confere a IE exata ou pontuada sem reescrever o snapshot", async metodo => {
    for (const ie of ["012345678901", " 012.345.678/901- "]) {
      const p = payload() as { tributacao: { emitenteIE?: string } }; p.tributacao.emitenteIE = "012345678901";
      const antes = JSON.stringify(p);
      const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1, IE: ie }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao()], PreVisualizarNotaFiscal: [{ Status: true, Base64Xml: Buffer.from("<NFe>IE FIXTURE</NFe>").toString("base64") }] });
      const a = criarAdaptadorBrasilNfe(c, f);
      if (metodo === "enviar") expect(await a.enviar(i, p as unknown as Prisma.JsonValue)).toMatchObject({ status: "AUTORIZADO" });
      else expect(await a.preVisualizar!(i, p as unknown as Prisma.JsonValue)).toMatchObject({ xml: expect.stringContaining("IE FIXTURE") });
      expect(JSON.stringify(p)).toBe(antes);
      expect(String(f.mock.calls[0][0]).split("/").at(-1)).toBe("BuscarEmpresa");
    }
  });
  it.each(["enviar", "preVisualizar"] as const)("%s bloqueia IE divergente, ausente ou inválida antes de qualquer endpoint fiscal", async metodo => {
    for (const empresa of [{ IE: "01234567890" }, { IE: "112345678901" }, {}, { IE: null }, { IE: "IE012345678901" }, { InscricaoEstadual: "012345678901" }]) {
      const p = payload() as { tributacao: { emitenteIE?: string } }; p.tributacao.emitenteIE = "012345678901";
      const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1, ...empresa }] });
      const a = criarAdaptadorBrasilNfe(c, f);
      await expect(metodo === "enviar" ? a.enviar(i, p as unknown as Prisma.JsonValue) : a.preVisualizar!(i, p as unknown as Prisma.JsonValue)).rejects.toThrow("Inscrição estadual do emitente");
      expect(f).toHaveBeenCalledTimes(1);
      expect(f.mock.calls.map(([url]) => String(url).split("/").at(-1))).toEqual(["BuscarEmpresa"]);
    }
  });
  it("recusa IE malformada no snapshot antes de consultar empresa ou documento", async () => {
    for (const ie of ["1", "012345678901234", "IE012345678901", "", null, 123456789012]) {
      const p = payload() as { tributacao: { emitenteIE?: unknown } }; p.tributacao.emitenteIE = ie;
      const f = transporte({});
      await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, p as unknown as Prisma.JsonValue)).rejects.toThrow("Inscrição estadual do emitente inválida");
      expect(f).not.toHaveBeenCalled();
    }
  });
  it("HTTP 200 sem comprovação e autorização em ambiente ou chave divergente não viram sucesso", async () => {
    for (const n of [autorizacao({ NumeroProtocolo: "" }), autorizacao({ CodTipoAmbiente: 1 }), autorizacao({ ChaveNF: chave.replace(c.cnpj, "99999999000199") }), { Error: "", ReturnNF: { Ok: true } }]) {
      const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [n] });
      await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, payload())).rejects.toThrow();
    }
  });
  it("rejeição é distinta de resultado incerto e não vaza mensagens sensíveis do provedor", async () => {
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao({ CodStatusRespostaSefaz: 778, Ok: false })] });
    expect(await criarAdaptadorBrasilNfe(c, f).enviar(i, payload())).toMatchObject({ status: "REJEITADO", erro: expect.stringContaining("778") });
    const timeout = transporte({ ConsultarNotaFiscal: [new Error("Token PRIVADO Nome REAL")] });
    await expect(criarAdaptadorBrasilNfe(c, timeout).consultar(i)).rejects.toThrow("resposta não confirmada");
  });
  it("duplicidade e denegação retornadas pelo fisco exigem conferência", async () => {
    for (const codigo of [204, 205, 539]) {
      const f = transporte({ ConsultarNotaFiscal: [consulta(nota({ Status: 3, Emitida: false, CodStatusResposta: codigo }))] });
      await expect(criarAdaptadorBrasilNfe(c, f).consultar(i)).rejects.toThrow("conclusiva");
    }
  });
  it("cancelamento confirma protocolo do evento e conserva protocolo da autorização", async () => {
    const f = transporte({ ConsultarNotaFiscal: [consulta()], CancelarNotaFiscal: [{ Status: 1, CodStatusRespostaSefaz: 135, NuProtocolo: "135260000000456", Error: "" }] });
    const r = await criarAdaptadorBrasilNfe(c, f).cancelar(i, "Cancelamento sintético justificado");
    expect(r).toMatchObject({ status: "CANCELADO", protocolo: "135260000000123", protocoloEvento: "135260000000456", chave });
    expect(JSON.parse(String(f.mock.calls[1][1]?.body))).toMatchObject({ ChaveNF: chave, TipoAmbiente: 2, NumeroProtocolo: "135260000000123" });
  });
  it("cancelamento pendente/rejeitado e consulta sem protocolo do evento preservam conferência", async () => {
    const f = transporte({ ConsultarNotaFiscal: [consulta()], CancelarNotaFiscal: [{ Status: 2, CodStatusRespostaSefaz: 135 }] });
    await expect(criarAdaptadorBrasilNfe(c, f).cancelar(i, "Cancelamento sintético justificado")).rejects.toThrow("não confirmado");
    const f2 = transporte({ ConsultarNotaFiscal: [consulta(nota({ Status: 2, CodStatusResposta: 101 }))] });
    await expect(criarAdaptadorBrasilNfe(c, f2).consultar(i)).rejects.toThrow("protocolo do evento");
  });
  it("prévia real usa endpoint sem transmissão e rejeita callback não documentado", async () => {
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], PreVisualizarNotaFiscal: [{ Status: true, Base64Xml: Buffer.from("<NFe>PREVIA SINTETICA</NFe>").toString("base64"), Base64File: Buffer.from("%PDF-1.4 PREVIA SINTETICA").toString("base64") }] });
    const a = criarAdaptadorBrasilNfe(c, f);
    expect(await a.preVisualizar!(i, payload())).toMatchObject({ xml: expect.stringContaining("PREVIA") });
    expect(JSON.parse(String(f.mock.calls[1][1]?.body))).toMatchObject({ TipoEnvio: 1, TipoArquivo: 2, mostrarTarjaPreVisualizacao: true, notaFiscal: { TipoAmbiente: 2, ModeloDocumento: 55, nFInfos: [expect.objectContaining({ IdentificadorInterno: i.documentoId })] } });
    expect(await a.autenticarRetorno(Buffer.from("{}"), new Headers())).toBeNull(); expect(f).toHaveBeenCalledTimes(2);
  });
  it("arquivos são bytes protegidos; HTML/URL públicos ou XML com entidade não são aceitos", async () => {
    for (const extra of [{ Base64File: Buffer.from("<html>não é PDF</html>").toString("base64") }, { Base64Xml: Buffer.from('<!DOCTYPE x [<!ENTITY y SYSTEM "file:///privado">]><x/>').toString("base64") }, { Base64File: "https://arquivo.invalid/nota.pdf" }]) {
      const f = transporte({ ConsultarNotaFiscal: [consulta(nota(extra))] });
      await expect(criarAdaptadorBrasilNfe(c, f).obterDocumentos(i)).rejects.toThrow();
    }
  });
  it("resposta HTTP falsa ou fora do contrato de ausência não libera reenvio", async () => {
    const f = transporte({ ConsultarNotaFiscal: [new Response("<html>erro</html>", { status: 200, headers: { "Content-Type": "text/html" } })] });
    await expect(criarAdaptadorBrasilNfe(c, f).consultar(i)).rejects.toThrow("resposta não confirmada");
  });
  it("BR0008 observado na homologação só confirma ausência com eco exato e contrato completo", async () => {
    const resposta = { ...ausente, status: 1, erros: [{ codigo: "BR0008", descricao: `Nenhum documento localizado para o IdentificadorInterno '${i.documentoId}'.`, correcao: "" }] };
    const f = transporte({ ConsultarNotaFiscal: [resposta] }); expect(await criarAdaptadorBrasilNfe(c, f).consultar(i)).toMatchObject({ status: "NAO_ENCONTRADO" });
    for (const v of [{ ...resposta, Nota: undefined }, { ...resposta, erros: [{ ...resposta.erros[0], descricao: "Nenhum documento localizado" }] }, { ...resposta, Historico: [nota()] }, { ...resposta, Encontrada: true, Nota: nota() }, { ...resposta, Error: "Falha externa" }, { ...resposta, erros: [...resposta.erros, { codigo: "BR0099" }] }]) {
      await expect(criarAdaptadorBrasilNfe(c, transporte({ ConsultarNotaFiscal: [v] })).consultar(i)).rejects.toThrow();
    }
  });
  it("validação bloqueia NCM inválido, regime antecipado, valores inconsistentes e modelo automático do emissor", () => {
    const d = documento(); d.Produtos[0].NCM = "1905310A"; expect(() => validarSnapshotBrasilNfe(payload(d), c)).toThrow();
    const d2 = documento(); d2.Produtos[0].Imposto.ICMS.CodSituacaoTributaria = "00"; expect(() => validarSnapshotBrasilNfe(payload(d2), c)).toThrow("CRT");
    const d3 = documento(); d3.Produtos[0].ValorUnitario = "10"; expect(() => validarSnapshotBrasilNfe(payload(d3), c)).toThrow("divergem");
    const d4 = documento(); d4.Produtos[0].CodTributacao = "modelo-provedor"; expect(() => validarSnapshotBrasilNfe(payload(d4), c)).toThrow("automáticos");
  });
  it("valida GTIN na fronteira e preserva código textual com zero inicial até o provedor", async () => {
    const d = documento(); d.Produtos[0].EAN = "06291041500213";
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao()] });
    expect(await criarAdaptadorBrasilNfe(c, f).enviar(i, payload(d))).toMatchObject({ status: "AUTORIZADO" });
    const body = JSON.parse(String(f.mock.calls[2][1]?.body));
    expect(body.Produtos[0].EAN).toBe("06291041500213"); expect(body.Produtos[0]).not.toHaveProperty("EANTrib");
    for (const codigo of ["6291041500214", "00000000", "12345678901", "SEMGTIN", "629104150021A"]) {
      const invalido = documento(); invalido.Produtos[0].EAN = codigo;
      const semRede = transporte({});
      await expect(criarAdaptadorBrasilNfe(c, semRede).enviar(i, payload(invalido))).rejects.toThrow("GTIN");
      expect(semRede).not.toHaveBeenCalled();
    }
  });
  it("não reutiliza um GTIN comercial para conversão tributável não comprovada", () => {
    const unidade = documento(); unidade.Produtos[0].UnidadeComercialTributavel = "KG";
    expect(() => validarSnapshotBrasilNfe(payload(unidade), c)).toThrow("Conversão");
    const quantidade = documento(); quantidade.Produtos[0].QuantidadeTributavel = "1"; quantidade.Produtos[0].ValorUnitarioTributavel = "29.97";
    expect(() => validarSnapshotBrasilNfe(payload(quantidade), c)).toThrow("Conversão");
  });
  it("preserva quatro casas de qCom/qTrib na fronteira JSON, sem arredondar a quantidade", async () => {
    const d = documento();
    d.Produtos[0].Quantidade = "3.000100";
    d.Produtos[0].QuantidadeTributavel = "3.000100";
    const p = payload(d);
    const antes = JSON.stringify(p);
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao()] });
    await criarAdaptadorBrasilNfe(c, f).enviar(i, p);
    const enviado = JSON.parse(String(f.mock.calls[2][1]?.body));
    expect(enviado.Produtos[0]).toMatchObject({ Quantidade: 3.0001, QuantidadeTributavel: 3.0001, ValorTotal: 29.97 });
    expect(JSON.stringify(p)).toBe(antes);
  });
  it.each(["Quantidade", "QuantidadeTributavel"] as const)("recusa precisão excedente em %s antes de qualquer chamada HTTP", async campo => {
    for (const quantidade of ["3.00001", "3.000010", "0.000001", "100000000000", 3.00001]) {
      const d = documento(); d.Produtos[0][campo] = quantidade;
      const p = payload(d); const antes = JSON.stringify(p); const f = transporte({});
      await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, p)).rejects.toThrow("11 inteiros e 4 casas");
      expect(f).not.toHaveBeenCalled();
      expect(JSON.stringify(p)).toBe(antes);
    }
  });
  it.each(["ValorUnitario", "ValorUnitarioTributavel"] as const)("bloqueia 12 inteiros em %s mesmo quando quantidade e total comercial fecham", async campo => {
    const d = documento();
    d.ValorTotal = "10000000000.00";
    d.Pagamentos[0].VlPago = d.ValorTotal;
    Object.assign(d.Produtos[0], { Quantidade: "0.100000", QuantidadeTributavel: "0.100000", ValorUnitario: "99999999999.99", ValorUnitarioTributavel: "99999999999.99", ValorTotal: d.ValorTotal });
    d.Produtos[0][campo] = "100000000000";
    const p = payload(d) as { valores: { total: string } };
    p.valores.total = d.ValorTotal;
    const f = transporte({}); const antes = JSON.stringify(p);
    await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, p as unknown as Prisma.JsonValue)).rejects.toThrow("Valor unitário fiscal exige até 11 inteiros");
    expect(f).not.toHaveBeenCalled();
    expect(JSON.stringify(p)).toBe(antes);
  });
  it("bloqueia preço unitário de 120 bilhões sem transformar o valor comercial", async () => {
    const d = documento(); d.ValorTotal = "12000000000.00"; d.Pagamentos[0].VlPago = d.ValorTotal;
    Object.assign(d.Produtos[0], { Quantidade: "0.1", QuantidadeTributavel: "0.1", ValorUnitario: "120000000000", ValorUnitarioTributavel: "120000000000", ValorTotal: d.ValorTotal });
    const p = payload(d) as { valores: { total: string } }; p.valores.total = d.ValorTotal;
    const f = transporte({}); const antes = JSON.stringify(p);
    await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, p as unknown as Prisma.JsonValue)).rejects.toThrow("11 inteiros");
    expect(f).not.toHaveBeenCalled(); expect(JSON.stringify(p)).toBe(antes);
  });
  it("aceita 11 inteiros no unitário com dez casas preenchidas e preserva a fotografia", async () => {
    const d = documento(); d.ValorTotal = "9999999999.99"; d.Pagamentos[0].VlPago = d.ValorTotal;
    Object.assign(d.Produtos[0], { Quantidade: "0.100000", QuantidadeTributavel: "0.100000", ValorUnitario: "99999999999.9000000000", ValorUnitarioTributavel: "99999999999.9000000000", ValorTotal: d.ValorTotal });
    const p = payload(d) as { valores: { total: string } }; p.valores.total = d.ValorTotal;
    const antes = JSON.stringify(p);
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao()] });
    await criarAdaptadorBrasilNfe(c, f).enviar(i, p as unknown as Prisma.JsonValue);
    expect(JSON.parse(String(f.mock.calls[2][1]?.body)).Produtos[0]).toMatchObject({ ValorUnitario: 99999999999.9, ValorUnitarioTributavel: 99999999999.9, Quantidade: 0.1, ValorTotal: 9999999999.99 });
    expect(JSON.stringify(p)).toBe(antes);
  });
  it.each(["ValorUnitario", "ValorUnitarioTributavel"] as const)("recusa mais de dez casas em %s mesmo quando o total arredondado fecha", async campo => {
    const d = documento(); d.Produtos[0][campo] = "9.99000000001";
    const f = transporte({}); const p = payload(d); const antes = JSON.stringify(p);
    await expect(criarAdaptadorBrasilNfe(c, f).enviar(i, p)).rejects.toThrow("Precisão fiscal");
    expect(f).not.toHaveBeenCalled(); expect(JSON.stringify(p)).toBe(antes);
  });
  it("preserva as dez casas significativas do unitário representável na API", async () => {
    const d = documento(); d.Produtos[0].ValorUnitario = "9.9900000001"; d.Produtos[0].ValorUnitarioTributavel = "9.9900000001";
    const p = payload(d); const antes = JSON.stringify(p);
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], ConsultarNotaFiscal: [ausente], EnviarNotaFiscal: [autorizacao()] });
    await criarAdaptadorBrasilNfe(c, f).enviar(i, p);
    expect(JSON.parse(String(f.mock.calls[2][1]?.body)).Produtos[0]).toMatchObject({ ValorUnitario: 9.9900000001, ValorUnitarioTributavel: 9.9900000001, ValorTotal: 29.97 });
    expect(JSON.stringify(p)).toBe(antes);
  });
  it("recusa unitário que viraria 12 inteiros ao converter para JSON numérico", () => {
    const d = documento();
    d.ValorTotal = "10000000000.00";
    d.Pagamentos[0].VlPago = d.ValorTotal;
    Object.assign(d.Produtos[0], { Quantidade: "0.1", QuantidadeTributavel: "0.1", ValorUnitario: "99999999999.9999999999", ValorUnitarioTributavel: "99999999999.9999999999", ValorTotal: d.ValorTotal });
    const p = payload(d) as { valores: { total: string } };
    p.valores.total = d.ValorTotal;
    expect(() => validarSnapshotBrasilNfe(p as unknown as Prisma.JsonValue, c)).toThrow("não representável");
  });
  it("em 2027 exige metadados RTC, sem interpretar os campos legados como suporte do provedor", async () => {
    const p = payload() as { tributacao: { previa: { contexto: { data: string } } } };
    p.tributacao.previa.contexto.data = "2027-01-01";
    const f = transporte({});
    await expect(criarAdaptadorBrasilNfe(c, f).preVisualizar!(i, p as unknown as Prisma.JsonValue)).rejects.toThrow("RTC 2027");
    expect(f).not.toHaveBeenCalled();
  });
  it("confere valores líquidos e totais nos caminhos do perfil sem somar os tributos novamente", async () => {
    const p = payloadRtc2027(); const antes = JSON.stringify(p);
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 3 }], PreVisualizarNotaFiscal: [{ Status: true, Base64Xml: Buffer.from("<NFe>RTC FIXTURE</NFe>").toString("base64") }] });
    expect(validarSnapshotBrasilNfe(p, c)).toMatchObject({ crt: 3, rtc2027: { valorTotalDocumento: "35.00", valorLiquidoProdutosTotal: "20.00" } });
    await criarAdaptadorBrasilNfe(c, f).preVisualizar!(i, p);
    const body = JSON.parse(String(f.mock.calls[1][1]?.body));
    expect(body.notaFiscal.nFInfos[0]).toMatchObject({ ValorTotal: 35, FixtureRtc: { ProdutosLiquidos: 20, TotalDocumento: 35 }, Produtos: [{ ValorTotal: 30, ValorFrete: 3, ValorOutrasDespesas: 2, FixtureRtc: { ProdutoLiquido: 20, UnitarioLiquido: 6.6666666667, TotalItem: 35 } }] });
    expect(JSON.stringify(p)).toBe(antes);
    expect(f.mock.calls.map(([url]) => String(url).split("/").at(-1))).toEqual(["BuscarEmpresa", "PreVisualizarNotaFiscal"]);
  });
  it("não antecipa RTC em 2026 nem aceita metadados RTC sem data canônica", () => {
    for (const data of ["2026-12-31", null]) {
      const p = payloadRtc2027() as { tributacao: { previa?: { contexto: { data: string } } } };
      if (data === null) delete p.tributacao.previa;
      else p.tributacao.previa!.contexto.data = data;
      expect(() => validarSnapshotBrasilNfe(p as unknown as Prisma.JsonValue, c)).toThrow("data canônica");
    }
    const legado = payload() as { tributacao: { previa?: unknown } };
    delete legado.tributacao.previa;
    expect(validarSnapshotBrasilNfe(legado as unknown as Prisma.JsonValue, c)).toMatchObject({ apto: true });
  });
  it("rejeita layout RTC sem evidência, incompleto ou com caminhos incompatíveis", () => {
    const invalidos: ((layout: SnapshotLayoutRtc["layout"]) => void)[] = [
      layout => { layout.homologacaoComprovada = false; },
      layout => { layout.evidenciaHomologacao = ""; },
      layout => { layout.campos.valorTotalItem = null; },
      layout => { layout.campos.valorTotalItem = layout.campos.valorProdutoLiquido; },
      layout => { layout.campos.valorProdutoLiquido = "constructor.Valor"; },
      layout => { layout.campos.valorTotalDocumento = "CampoDaApiNaoComprovado"; },
    ];
    for (const invalidar of invalidos) {
      const p = payloadRtc2027() as { tributacao: { rtc2027: SnapshotLayoutRtc } };
      invalidar(p.tributacao.rtc2027.layout);
      expect(() => validarSnapshotBrasilNfe(p as unknown as Prisma.JsonValue, c)).toThrow(/RTC/);
    }
  });
  it("recusa diferenças entre valores RTC, quantidades, linhas e totais fotografados", () => {
    const invalidos: ((t: { rtc2027: SnapshotLayoutRtc; documento: DocumentoBrasilNfe }) => void)[] = [
      t => { t.rtc2027.produtos[0].unitarioLiquido = "6.67"; },
      t => { t.rtc2027.produtos[0].produtoLiquido = "30.01"; t.rtc2027.valorLiquidoProdutosTotal = "30.01"; },
      t => { t.rtc2027.produtos[0].totalItem = "34.99"; t.rtc2027.valorTotalDocumento = "34.99"; },
      t => { t.rtc2027.valorLiquidoProdutosTotal = "19.99"; },
      t => { t.rtc2027.produtos.push({ ...t.rtc2027.produtos[0] }); },
      t => { (t.documento.Produtos[0].FixtureRtc as Record<string, unknown>).ProdutoLiquido = "19.99"; },
      t => { (t.documento.FixtureRtc as Record<string, unknown>).TotalDocumento = "34.99"; },
    ];
    for (const invalidar of invalidos) {
      const p = payloadRtc2027() as { tributacao: { rtc2027: SnapshotLayoutRtc; documento: DocumentoBrasilNfe } };
      invalidar(p.tributacao);
      expect(() => validarSnapshotBrasilNfe(p as unknown as Prisma.JsonValue, c)).toThrow(/RTC/);
    }
  });
  it("ausência posterior ao processamento produz observação nova e não fica presa na sequência anterior", async () => {
    const f = transporte({ ConsultarNotaFiscal: [ausente] });
    const anterior = 10;
    expect(await criarAdaptadorBrasilNfe(c, f).consultar({ ...i, ultimaSequencia: anterior })).toMatchObject({ status: "NAO_ENCONTRADO", sequencia: anterior + 1 });
  });
  it("preserva pagamento sem cobrança e impede divergência dos pagamentos", () => {
    const d = documento(); d.Pagamentos = [{ FormaPagamento: "90", VlPago: "0" }];
    expect(validarSnapshotBrasilNfe(payload(d), c)).toMatchObject({ apto: true });
    const d2 = documento(); d2.Pagamentos[0].VlPago = "29.96";
    expect(() => validarSnapshotBrasilNfe(payload(d2), c)).toThrow("Pagamentos");
  });
  it("prévia de outra vigência não transmite nem impede consulta histórica", async () => {
    const p = payload() as { tributacao: { previa: { contexto: { data: string } } } };
    p.tributacao.previa.contexto.data = "2026-01-01";
    const f = transporte({ ConsultarNotaFiscal: [consulta()] }); const a = criarAdaptadorBrasilNfe(c, f);
    await expect(a.enviar(i, p as unknown as Prisma.JsonValue)).rejects.toThrow("Vigência"); expect(f).not.toHaveBeenCalled();
    expect(await a.consultar(i)).toMatchObject({ status: "AUTORIZADO" });
  });
  it("pré-visualização permite fotografia histórica sem transmissão", async () => {
    const p = payload() as { tributacao: { previa: { contexto: { data: string } } } };
    p.tributacao.previa.contexto.data = "2026-01-01";
    const f = transporte({ BuscarEmpresa: [{ CNPJ: c.cnpj, CRT: 1 }], PreVisualizarNotaFiscal: [{ Status: true, Base64Xml: Buffer.from("<NFe>HISTORICA SINTETICA</NFe>").toString("base64") }] });
    expect(await criarAdaptadorBrasilNfe(c, f).preVisualizar!(i, p as unknown as Prisma.JsonValue)).toMatchObject({ xml: expect.stringContaining("HISTORICA") });
  });
});
