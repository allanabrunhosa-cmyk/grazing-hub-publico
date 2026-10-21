// CNPJ exclusivamente fictício, com dígitos verificadores válidos para a fixture.
import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  agente: vi.fn(),
  nota: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  estado: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  trava: vi.fn(),
  transacao: vi.fn(),
  municipal: vi.fn(),
}));
vi.mock("https", () => ({ request: mocks.request }));
vi.mock("@/lib/sefaz/certificado", () => ({
  criarAgenteMTLS: mocks.agente,
  obterCnpjConsulta: async () => "11222333000181",
}));
vi.mock("@/lib/prisma", () => ({ prisma: { notaFiscalServico: mocks.nota, nfseDistribuicaoEstado: mocks.estado, $transaction: mocks.transacao } }));
vi.mock("@/lib/notas-fiscais/fornecedor", () => ({ resolverFornecedorNota: async () => null }));
vi.mock("@/lib/nfse/municipal-sp", async importarOriginal => ({ ...await importarOriginal<object>(), localizarNfseMunicipal: mocks.municipal }));
import { importarNfseMunicipal, importarNfsePorDps, importarNfsePorChave, importarNfseXml, sincronizarNfse } from "@/lib/nfse/servico";

const entrada = { cpfCnpj: "12.345.678/0001-90", serie: "3", numero: "42", municipioCodigo: "3550308", autor: "Teste" };
const idConsulta = "355030821234567800019000003000000000000042";
const chave = "1".repeat(50);
function xml(id = `DPS${idConsulta}`, emissao = "2026-09-21T10:00:00-03:00") {
  return `<NFSe><infNFSe Id="NFS${chave}"><nNFSe>42</nNFSe><dhEmi>${emissao}</dhEmi>
    <emit><CNPJ>12345678000190</CNPJ><xNome>Prestador teste</xNome></emit>
    <DPS><infDPS Id="${id}"><cLocEmi>3550308</cLocEmi><serie>3</serie><nDPS>42</nDPS>
    <prest><CNPJ>12345678000190</CNPJ><xNome>Prestador teste</xNome></prest>
    <toma><CNPJ>11222333000181</CNPJ><xNome>Tomador teste</xNome></toma>
    </infDPS></DPS></infNFSe></NFSe>`;
}
function responder(status: number, corpo: unknown = {}) {
  mocks.request.mockImplementationOnce((_opcoes, callback) => {
    const requisicao = new EventEmitter();
    return Object.assign(requisicao, {
      end() {
        const resposta = Object.assign(new EventEmitter(), { statusCode: status });
        callback(resposta);
        resposta.emit("data", Buffer.from(JSON.stringify(corpo)));
        resposta.emit("end");
      },
    });
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.agente.mockResolvedValue({});
  mocks.nota.findUnique.mockResolvedValue({ id: "existente", xml: "<NFSe/>" });
  mocks.trava.mockResolvedValue([{ obtida: true }]);
  mocks.estado.findUniqueOrThrow.mockResolvedValue({ nsuConsulta: "0", proximaBuscaEm: null });
  mocks.transacao.mockImplementation(async callback => callback({
    $queryRaw: mocks.trava, nfseDistribuicaoEstado: mocks.estado, notaFiscalServico: mocks.nota,
  }));
});

describe("persistência da importação municipal", () => {
  const consulta = { municipioCodigo: "3550308", cnpjPrestador: "12345678000190", numero: "42", dataEmissao: "2026-09-01", codigoVerificacao: "ABCD1234" };
  function documento() {
    return xml(undefined, "2026-09-01T10:00:00-03:00").replace("</infDPS>", "<dhEmi>2026-09-01T10:00:00-03:00</dhEmi><valores><vServPrest><vServ>619.00</vServ></vServPrest></valores></infDPS>");
  }
  function documentoMunicipal() {
    return `<p:RetornoConsulta xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="2"><Sucesso>true</Sucesso></Cabecalho><NFe>
      <ChaveNFe><InscricaoPrestador>123</InscricaoPrestador><NumeroNFe>42</NumeroNFe><CodigoVerificacao>ABCD1234</CodigoVerificacao><ChaveNotaNacional>${chave}</ChaveNotaNacional></ChaveNFe>
      <DataEmissaoNFe>2026-09-01T10:00:00</DataEmissaoNFe><CPFCNPJPrestador><CNPJ>12345678000190</CNPJ></CPFCNPJPrestador><RazaoSocialPrestador>Prestador teste</RazaoSocialPrestador>
      <CPFCNPJTomador><CNPJ>11222333000181</CNPJ></CPFCNPJTomador><RazaoSocialTomador>Tomador teste</RazaoSocialTomador>
      <ValorServicos>619.00</ValorServicos><ValorIR>19.00</ValorIR><ValorISS>12.00</ValorISS><ISSRetido>false</ISSRetido><StatusNFe>N</StatusNFe>
    </NFe></p:RetornoConsulta>`;
  }
  beforeEach(() => mocks.municipal.mockResolvedValue({ ...consulta, chave, valorServico: 619, xmlMunicipal: documentoMunicipal() }));
  it("importa a nota anterior ao corte e preserva a identidade usada pela importação por chave", async () => {
    mocks.nota.findUnique.mockResolvedValue(null);
    responder(200, { nfseXmlGZipB64: gzipSync(documento()).toString("base64") });
    expect(await importarNfseMunicipal(consulta, "Teste municipal")).toHaveProperty("nova", true);
    const municipal = mocks.nota.create.mock.calls[0][0].data;
    responder(200, { nfseXmlGZipB64: gzipSync(documento()).toString("base64") });
    await importarNfsePorChave(chave, "Teste chave");
    expect(mocks.nota.create.mock.calls[1][0].data.identificador).toBe(municipal.identificador);
    expect(municipal).toMatchObject({ importadaManualmente: true, valorServico: 619, criadoPorNome: "Teste municipal" });
    expect(municipal).not.toHaveProperty("lancamentos");
  });
  it("reimportação mantém situação, XML e despesas existentes", async () => {
    responder(200, { nfseXmlGZipB64: gzipSync(documento()).toString("base64") });
    expect(await importarNfseMunicipal(consulta)).toHaveProperty("nova", false);
    expect(mocks.nota.create).not.toHaveBeenCalled();
    expect(mocks.nota.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "existente" }, data: { importadaManualmente: true } });
  });
  it("usa o registro oficial municipal quando a chave ainda não existe no download nacional", async () => {
    mocks.nota.findUnique.mockResolvedValue(null);
    responder(404, { erro: { codigo: "E2401", descricao: "Chave de acesso não encontrada." } });
    expect(await importarNfseMunicipal(consulta, "Teste municipal")).toHaveProperty("nova", true);
    expect(mocks.nota.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      origem: "MUNICIPAL", identificador: `NFS${chave}`, chaveAcesso: chave,
      numero: "42", valorServico: 619, valorLiquido: 600, criadoPorNome: "Teste municipal",
    }) });
  });
  it.each(["tomador", "valor", "chave"])("bloqueia a persistência quando diverge %s", async campo => {
    const errado = campo === "tomador" ? documento().replace("11222333000181", "99999999000199") : campo === "valor" ? documento().replace("619.00", "620.00") : documento().replace(`NFS${chave}`, `NFS${"2".repeat(50)}`);
    responder(200, { nfseXmlGZipB64: gzipSync(errado).toString("base64") });
    expect(await importarNfseMunicipal(consulta)).toHaveProperty("erro");
    expect(mocks.nota.findUnique).not.toHaveBeenCalled();
    expect(mocks.nota.create).not.toHaveBeenCalled();
  });
});

describe("notas anteriores ao recorte automático", () => {
  const xmlAntigo = () => xml(undefined, "2026-09-04T13:49:55-03:00");

  it.each(["XML", "chave", "DPS"])("permite inclusão manual por %s e registra a exceção", async modo => {
    mocks.nota.findUnique.mockResolvedValue(null);
    if (modo === "DPS") responder(200, { chaveAcesso: chave });
    if (modo !== "XML") responder(200, { nfseXmlGZipB64: gzipSync(xmlAntigo()).toString("base64") });
    const resultado = modo === "XML" ? await importarNfseXml(xmlAntigo(), "ARQUIVO", "Teste")
      : modo === "chave" ? await importarNfsePorChave(chave, "Teste") : await importarNfsePorDps(entrada);
    expect(resultado).toHaveProperty("nova", true);
    expect(mocks.nota.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      importadaManualmente: true, dataEmissao: new Date("2026-09-04T12:00:00Z"), criadoPorNome: "Teste",
    }) });
  });

  it("torna visível uma nota antiga existente sem duplicar ou alterar seus vínculos", async () => {
    expect(await importarNfseXml(xmlAntigo())).toHaveProperty("nova", false);
    expect(mocks.nota.create).not.toHaveBeenCalled();
    expect(mocks.nota.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "existente" }, data: { importadaManualmente: true } });
  });

  it("mantém a verificação do tomador e exige data mesmo na importação manual", async () => {
    expect(await importarNfseXml(xmlAntigo().replace("11222333000181", "99999999000199"))).toHaveProperty("erro", expect.stringContaining("CNPJ configurado"));
    expect(await importarNfseXml(xml(undefined, ""))).toHaveProperty("erro", expect.stringContaining("data de emissão válida"));
    expect(mocks.nota.create).not.toHaveBeenCalled();
    expect(mocks.nota.update).not.toHaveBeenCalled();
  });

  it("ignora notas antigas na busca automática, processa o limite e avança o NSU", async () => {
    mocks.nota.findUnique.mockResolvedValue(null);
    responder(200, { StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: [
      { NSU: "1", ArquivoXml: xmlAntigo() },
      { NSU: "2", ArquivoXml: xml(undefined, "2026-09-10T00:00:00Z") },
    ] });
    expect(await sincronizarNfse("Teste")).toMatchObject({ novas: 1, nsuConsultado: "2" });
    expect(mocks.nota.create).toHaveBeenCalledTimes(1);
    expect(mocks.nota.create.mock.calls[0][0].data).toMatchObject({ dataEmissao: new Date("2026-09-10T12:00:00Z"), nsu: "2" });
    expect(mocks.nota.create.mock.calls[0][0].data).not.toHaveProperty("importadaManualmente", true);
    expect(mocks.estado.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ nsuConsulta: "2" }) }));
  });
});

describe("consulta da DPS na Sefin Nacional", () => {
  it("envia 42 dígitos no GET e aceita o prefixo DPS no XML correspondente", async () => {
    responder(200, { chaveAcesso: chave });
    responder(200, { nfseXmlGZipB64: gzipSync(xml()).toString("base64") });
    const resultado = await importarNfsePorDps(entrada);
    expect(resultado).not.toHaveProperty("erro");
    expect(resultado).toHaveProperty("dados.dpsIdentificador", `DPS${idConsulta}`);
    expect(mocks.request.mock.calls.map(([opcoes]) => [opcoes.method, opcoes.path])).toEqual([
      ["GET", `/sefinnacional/dps/${idConsulta}`],
      ["GET", `/sefinnacional/nfse/${chave}`],
    ]);
    expect(idConsulta).toMatch(/^\d{42}$/);
  });

  it("envia o mesmo ID numérico no HEAD usado após um GET 404", async () => {
    responder(404);
    responder(200);
    expect(await importarNfsePorDps(entrada)).toHaveProperty("erro", expect.stringContaining("não liberou a chave"));
    expect(mocks.request.mock.calls.map(([opcoes]) => [opcoes.method, opcoes.path])).toEqual([
      ["GET", `/sefinnacional/dps/${idConsulta}`],
      ["HEAD", `/sefinnacional/dps/${idConsulta}`],
    ]);
    expect(mocks.nota.findUnique).not.toHaveBeenCalled();
  });

  it("completa o CPF com zeros sem perder as posições do ID consultado", async () => {
    responder(403);
    await importarNfsePorDps({ ...entrada, cpfCnpj: "123.456.789-09" });
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({
      path: "/sefinnacional/dps/355030810001234567890900003000000000000042",
    }), expect.any(Function));
  });

  it("rejeita XML de outra DPS antes de consultar ou gravar o banco", async () => {
    responder(200, { chaveAcesso: chave });
    responder(200, { nfseXmlGZipB64: gzipSync(xml(`DPS${idConsulta.slice(0, -1)}3`)).toString("base64") });
    expect(await importarNfsePorDps(entrada)).toHaveProperty("erro", expect.stringContaining("não corresponde"));
    expect(mocks.nota.findUnique).not.toHaveBeenCalled();
    expect(mocks.nota.create).not.toHaveBeenCalled();
    expect(mocks.nota.update).not.toHaveBeenCalled();
  });

  it("recusa série alfanumérica antes de carregar certificado ou consultar a Sefin", async () => {
    expect(await importarNfsePorDps({ ...entrada, serie: "A1" })).toHaveProperty("erro", expect.stringContaining("somente números"));
    expect(mocks.agente).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

describe("sincronização da distribuição nacional e preservação do cursor", () => {
  it("trata HTTP 404 com ausência explícita como consulta concluída", async () => {
    mocks.estado.findUniqueOrThrow.mockResolvedValue({ nsuConsulta: "246", proximaBuscaEm: null });
    responder(404, { StatusProcessamento: "NENHUM_DOCUMENTO_LOCALIZADO", LoteDFe: null });
    expect(await sincronizarNfse()).toMatchObject({ novas: 0, nsuConsultado: "246", motivo: expect.stringContaining("nenhuma nova") });
    expect(mocks.nota.create).not.toHaveBeenCalled();
    expect(mocks.estado.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      nsuConsulta: "246", ultimoStatus: "NENHUM_DOCUMENTO_LOCALIZADO", emConsulta: false,
      ultimaRespostaJson: expect.objectContaining({ http: 404 }),
    }) }));
  });
  it("não avança o cursor e substitui status antigo quando ocorre falha real", async () => {
    responder(404, {});
    expect(await sincronizarNfse()).toHaveProperty("erro", expect.stringContaining("sem confirmar ausência"));
    const dados = mocks.estado.update.mock.lastCall![0].data;
    expect(dados.ultimoStatus).toBe("FALHA_CONSULTA");
    expect(dados).not.toHaveProperty("nsuConsulta");
    expect(mocks.nota.create).not.toHaveBeenCalled();
  });
  it("não consulta novamente antes do cooldown", async () => {
    mocks.estado.findUniqueOrThrow.mockResolvedValue({ nsuConsulta: "246", proximaBuscaEm: new Date(Date.now() + 60_000) });
    expect(await sincronizarNfse()).toHaveProperty("motivo", expect.stringContaining("Próxima consulta permitida"));
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.estado.update).not.toHaveBeenCalled();
  });
  it("não consulta quando outra execução está sob a trava do CNPJ", async () => {
    mocks.trava.mockResolvedValue([{ obtida: false }]);
    expect(await sincronizarNfse()).toHaveProperty("motivo", expect.stringContaining("em andamento"));
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it.each([
    { NSU: "247", ArquivoXml: null },
    { NSU: "invalido", ArquivoXml: xml() },
    { NSU: Number.MAX_SAFE_INTEGER + 1, ArquivoXml: xml() },
  ])("não perde documentos com NSU ou XML inválido", async documento => {
    responder(200, { StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: [documento] });
    expect(await sincronizarNfse()).toHaveProperty("erro");
    expect(mocks.estado.update.mock.lastCall![0].data).not.toHaveProperty("nsuConsulta");
  });
  it("reconfere a agenda automática sob a trava antes de consultar", async () => {
    mocks.estado.findUniqueOrThrow.mockResolvedValue({ nsuConsulta: "246", proximaBuscaAutomaticaEm: new Date(Date.now() + 60_000) });
    await sincronizarNfse("Busca automática", { automatica: true });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.estado.update).not.toHaveBeenCalled();
  });
  it.each([false, true])("registra execução automática e agenda a próxima madrugada após fim ou falha: %s", async falha => {
    // Agenda explícita vencida deixa este teste independente do horário da máquina.
    mocks.estado.findUniqueOrThrow.mockResolvedValue({ nsuConsulta: "246", proximaBuscaAutomaticaEm: new Date(0) });
    responder(falha ? 503 : 404, { StatusProcessamento: falha ? "REJEICAO" : "NENHUM_DOCUMENTO_LOCALIZADO" });
    await sincronizarNfse("Busca automática", { automatica: true });
    expect(mocks.estado.update.mock.calls[0][0].data.ultimaBuscaAutomaticaEm).toBeInstanceOf(Date);
    const dados = mocks.estado.update.mock.lastCall![0].data;
    expect(dados.resultadoBuscaAutomatica).toBeTruthy();
    expect(dados.proximaBuscaAutomaticaEm).toBeInstanceOf(Date);
    expect(dados.proximaBuscaAutomaticaEm > new Date()).toBe(true);
  });
  it("agenda continuação para processar os documentos além do primeiro lote", async () => {
    mocks.estado.findUniqueOrThrow.mockResolvedValue({ nsuConsulta: "246", proximaBuscaAutomaticaEm: new Date(0) });
    responder(200, { StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: [{ NSU: "247", ArquivoXml: xml() }] });
    await sincronizarNfse("Busca automática", { automatica: true });
    const dados = mocks.estado.update.mock.lastCall![0].data;
    expect(dados.nsuConsulta).toBe("247");
    expect(dados.proximaBuscaAutomaticaEm).toEqual(dados.proximaBuscaEm);
  });
});
