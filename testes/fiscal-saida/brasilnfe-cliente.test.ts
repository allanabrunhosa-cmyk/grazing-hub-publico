import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteBrasilNfe, ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { CATEGORIAS_DIAGNOSTICO_BRASILNFE, ETAPAS_CONTRATO_BRASILNFE, sanitizarMetadadosErroBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";
import type { RequisicaoConsultaBrasilNfe, RequisicaoConsultaBrasilNfeHttp } from "@/lib/fiscal-saida/brasilnfe/tipos-http";

const TOKEN = "token-empresa-sintetico-nao-utilizavel";
const USER_TOKEN = "token-usuario-sintetico-nao-utilizavel";
const CNPJ = "00000000000000";
const DOCUMENTO = "documento-sintetico-m1";
const CHAVE = "00000000000000000000550010000000011000000000";
describe("Mensagens seguras da integração fiscal", () => {
  it("explica acesso recusado e campo do contrato usando somente metadados locais", () => {
    expect(new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "HTTP", httpStatus: 403 }).message).toContain("HTTP 403: o emissor recusou o acesso");
    expect(new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", "EMPRESA_CRT").message).toContain("CRT da empresa");
    expect(new ErroHttpBrasilNfe("PRODUCAO_BLOQUEADA").message).toContain("ambiente da operação");
  });
  it("timeout manda consultar o documento e não instrui uma nova emissão", () => {
    expect(new ErroHttpBrasilNfe("TIMEOUT").message).toContain("Consulte o documento para confirmar o resultado antes de repetir a operação");
  });
});
const requisicao: RequisicaoConsultaBrasilNfe = { documentoId: DOCUMENTO, modelo: 55, ambiente: "HOMOLOGACAO" };
function resposta(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function empresa() {
  return { CNPJ, RzSocial: "EMITENTE SINTETICO", NmFantasia: "FICTICIO", IE: "000000000", CRT: 1,
    Endereco: { Cep: "00000000", Logradouro: "Rua de Teste", Numero: "0", Bairro: "Bairro", CodMunicipio: "0000000", Municipio: "Cidade", Uf: "SP" },
    Token: TOKEN, UserToken: USER_TOKEN, Configuracao: {
      NFSe: { TokenProcurador: TOKEN, SenhaWebService: USER_TOKEN },
      NFCe: { IdCSCHomologacao: "000001", CSCHomologacao: "csc-sintetico-privado", CSCProducao: "producao-sintetica-privada" },
    } };
}
function nota(overrides: Record<string, unknown> = {}) {
  return { ModeloDocumento: 55, IdentificadorInterno: DOCUMENTO, CodTipoAmbiente: 2,
    Status: 1, Emitida: true, Chave: CHAVE, Numero: 1, Serie: "001", NumeroProtocolo: "135260000000000000123",
    CodStatusResposta: 100, DtEmissao: "2026-10-10T10:00:00-03:00", DtRecebimento: "2026-10-10T10:00:02-03:00",
    Base64Xml: TOKEN, Base64File: USER_TOKEN, NomeDestinatario: "Pessoa ficticia", ...overrides };
}
function envelope(overrides: Record<string, unknown> = {}) {
  return { Encontrada: true, Nota: nota(), Historico: [], erros: [], avisos: [], status: 0, ...overrides };
}
function cliente(mock: typeof fetch, userToken: string | undefined = USER_TOKEN, timeoutMs?: number) {
  return new ClienteBrasilNfe({ token: TOKEN, userToken }, { fetch: mock, timeoutMs });
}
async function capturarErro(consulta: Promise<unknown>): Promise<ErroHttpBrasilNfe> {
  try { await consulta; }
  catch (erro) { if (erro instanceof ErroHttpBrasilNfe) return erro; throw erro; }
  throw new Error("A consulta sintética deveria falhar explicitamente.");
}
function conferirErroSemSegredos(erro: ErroHttpBrasilNfe) {
  for (const segredo of [TOKEN, USER_TOKEN]) {
    expect(JSON.stringify(erro)).not.toContain(segredo);
    expect(String(erro)).not.toContain(segredo);
    expect(erro.message).not.toContain(segredo);
    expect(erro.stack).not.toContain(segredo);
  }
  expect(erro).not.toHaveProperty("cause");
  expect(erro).not.toHaveProperty("headers");
  expect(erro).not.toHaveProperty("body");
  expect(erro).not.toHaveProperty("rawBody");
  expect(Object.isFrozen(erro.diagnosticoSeguro)).toBe(true);
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Cliente Brasil NFe: consultas públicas contratadas, sem transmissão", () => {
  it.each(["00.000-000", "00000-000", "00000000"])("normaliza somente máscaras completas do CEP cadastral: %s", async Cep => {
    const dados = empresa(); dados.Endereco.Cep = Cep;
    const dto = await cliente(vi.fn<typeof fetch>().mockResolvedValue(resposta(dados))).buscarEmpresa();
    expect(dto.endereco.cep).toBe("00000000"); expect(JSON.stringify(dto)).not.toContain(TOKEN);
  });
  it.each(["00.00-000", "00000000X", "00000/000", "token-sintetico", "00000-000\n"])("não limpa conteúdo arbitrário no CEP", async Cep => {
    const dados = empresa(); dados.Endereco.Cep = Cep;
    const erro = await capturarErro(cliente(vi.fn<typeof fetch>().mockResolvedValue(resposta(dados))).buscarEmpresa());
    expect(erro.etapaContrato).toBe("EMPRESA_CEP"); conferirErroSemSegredos(erro);
  });
  it("busca somente a empresa do Token, com UserToken separado e sem expor segredos", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(empresa()));
    const api = cliente(chamar);
    const dto = await api.buscarEmpresa();
    expect(dto).toMatchObject({ cnpj: CNPJ, crt: 1, endereco: { uf: "SP" }, nfceHomologacao: { idCscConfigurado: true, cscConfigurado: true } });
    expect(JSON.stringify(dto)).not.toMatch(/token-empresa|token-usuario|csc-sintetico|producao-sintetica|SenhaWebService/);
    expect(JSON.stringify(api)).toBe("{}");
    expect(chamar).toHaveBeenCalledExactlyOnceWith("https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa", expect.objectContaining({
      method: "POST", redirect: "error", cache: "no-store", body: undefined,
      headers: { Accept: "application/json", "Content-Type": "application/json", Token: TOKEN, UserToken: USER_TOKEN },
      signal: expect.any(AbortSignal),
    }));
  });

  it.each([
    { mascarado: "00.000.000/0000-00", simples: "00000000000000" },
    { mascarado: "00.000.000/0000-01", simples: "00000000000001" },
  ])("normaliza somente a máscara completa do CNPJ preservando zeros e consulta (%#)", async ({ mascarado, simples }) => {
    const chamarSimples = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), CNPJ: simples }));
    const chamarMascarado = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), CNPJ: mascarado }));
    const dtoSimples = await cliente(chamarSimples).buscarEmpresa();
    const dtoMascarado = await cliente(chamarMascarado).buscarEmpresa();
    expect(dtoMascarado).toEqual(dtoSimples);
    expect(dtoMascarado.cnpj).toBe(simples);
    expect(dtoMascarado.cnpj).toHaveLength(14);
    expect(JSON.stringify(dtoMascarado)).not.toMatch(/token-empresa|token-usuario|csc-sintetico|producao-sintetica/);
    expect(chamarMascarado).toHaveBeenCalledExactlyOnceWith("https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa", expect.objectContaining({
      method: "POST", body: undefined,
      headers: { Accept: "application/json", "Content-Type": "application/json", Token: TOKEN, UserToken: USER_TOKEN },
    }));
    expect(chamarSimples).toHaveBeenCalledTimes(1);
    expect(chamarSimples.mock.calls[0][0]).toBe(chamarMascarado.mock.calls[0][0]);
    expect(chamarSimples.mock.calls[0][1]?.headers).toEqual(chamarMascarado.mock.calls[0][1]?.headers);
    expect(chamarSimples.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("a consulta de serviços informa somente catálogo e situação, sem avisos ou erros brutos", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ Servicos: [{ Nome: "NF-e", Ativo: true }, { Nome: "NFC-e", Ativo: false }],
      erros: [], avisos: [TOKEN], status: 0, Token: TOKEN }));
    const dto = await cliente(chamar).consultarServicos();
    expect(dto).toEqual({ servicos: [{ nome: "NF-e", ativo: true }, { nome: "NFC-e", ativo: false }], avisosPresentes: true });
    expect(chamar.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/empresa/ConsultarServicos");
  });

  it("UserToken ausente torna exatamente as consultas de Empresas indisponíveis, sem HTTP", async () => {
    const chamar = vi.fn<typeof fetch>();
    const api = new ClienteBrasilNfe({ token: TOKEN }, { fetch: chamar });
    await expect(api.buscarEmpresa()).rejects.toMatchObject({ codigo: "CONFIGURACAO_INCOMPLETA" });
    await expect(api.consultarServicos()).rejects.toMatchObject({ codigo: "CONFIGURACAO_INCOMPLETA" });
    expect(chamar).not.toHaveBeenCalled();
  });

  it.each(["", "x\r\nUserToken: invasao", "x ", "x".repeat(2049)])("rejeita credencial incompleta/inválida antes do transporte (%#)", (token) => {
    expect(() => new ClienteBrasilNfe({ token })).toThrow(ErroHttpBrasilNfe);
  });

  it("HTTP 401 é diferente de 403 e nenhum deles expõe o body externo", async () => {
    for (const status of [401, 403]) {
      const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ Error: `${TOKEN} ${USER_TOKEN}` }, status));
      await expect(cliente(chamar).buscarEmpresa()).rejects.toMatchObject({ codigo: status === 401 ? "CREDENCIAL_INVALIDA" : "EXTERNO" });
      const erro = await capturarErro(cliente(chamar).buscarEmpresa());
      expect(erro.message).not.toContain(TOKEN);
      expect(erro.cause).toBeUndefined();
      expect(erro.diagnosticoSeguro).toEqual({ categoria: "HTTP", httpStatus: status, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null });
    }
  });

  it("mensagem livre sobre token no HTTP 200 é negócio JSON, sem comprovar credencial inválida", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ status: false, Error: `Token da empresa inválido ${TOKEN}` }));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro).toMatchObject({ codigo: "EXTERNO", diagnosticoSeguro: { categoria: "NEGOCIO", httpStatus: 200, etapaContrato: "EMPRESA_ENVELOPE", statusFornecedor: null } });
    conferirErroSemSegredos(erro);
  });

  it.each([
    { CNPJ: 0 }, { CNPJ: "0" }, { CNPJ, CRT: "1" }, { CNPJ, Endereco: { Uf: "BRA" } },
    { CNPJ, Configuracao: { NFCe: { CSCHomologacao: { segredo: TOKEN } } } },
  ])("rejeita cadastro fora do contrato sem inventar emitente (%#)", async (dados) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(dados));
    await expect(cliente(chamar).buscarEmpresa()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });

  it("não devolve credencial refletida em um campo aparentemente permitido", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), RzSocial: TOKEN }));
    await expect(cliente(chamar).buscarEmpresa()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });

  it("cadastro com dados e erro simultâneos não confirma acesso", async () => {
    const comErro = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), erros: [{ descricao: TOKEN }] }));
    await expect(cliente(comErro).buscarEmpresa()).rejects.toMatchObject({ codigo: "EXTERNO" });
    const parcial = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), status: 2 }));
    await expect(cliente(parcial).buscarEmpresa()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });

  it.each([
    { etapa: "EMPRESA_ENVELOPE", dados: () => ({ ...empresa(), Error: { descricao: TOKEN } }) },
    { etapa: "EMPRESA_ENVELOPE", dados: () => ({ ...empresa(), erros: TOKEN }) },
    { etapa: "EMPRESA_STATUS", dados: () => ({ ...empresa(), status: 2 }) },
    { etapa: "EMPRESA_STATUS", dados: () => ({ ...empresa(), status: "true" }) },
    { etapa: "EMPRESA_CNPJ_AUSENTE", dados: () => { const dados: Record<string, unknown> = empresa(); delete dados.CNPJ; return dados; } },
    { etapa: "EMPRESA_CNPJ_NULO", dados: () => ({ ...empresa(), CNPJ: null }) },
    { etapa: "EMPRESA_CNPJ_NUMERICO", dados: () => ({ ...empresa(), CNPJ: 0 }) },
    { etapa: "EMPRESA_CNPJ_NUMERICO", dados: () => ({ ...empresa(), CNPJ: 10000000000001 }) },
    { etapa: "EMPRESA_CNPJ_TIPO", dados: () => ({ ...empresa(), CNPJ: { segredo: TOKEN } }) },
    { etapa: "EMPRESA_CNPJ_TIPO", dados: () => ({ ...empresa(), CNPJ: [USER_TOKEN] }) },
    { etapa: "EMPRESA_CNPJ_TIPO", dados: () => ({ ...empresa(), CNPJ: true }) },
    { etapa: "EMPRESA_CNPJ_CPF", dados: () => ({ ...empresa(), CNPJ: "00000000000" }) },
    { etapa: "EMPRESA_CNPJ_FORMATO", dados: () => ({ ...empresa(), CNPJ: "0" }) },
    { etapa: "EMPRESA_CNPJ_FORMATO", dados: () => ({ ...empresa(), CNPJ: "texto-invalido" }) },
    { etapa: "EMPRESA_CNPJ_FORMATO", dados: () => ({ ...empresa(), CNPJ: ` ${CNPJ} ` }) },
    { etapa: "EMPRESA_CNPJ_FORMATO", dados: () => ({ ...empresa(), CNPJ: TOKEN }) },
    { etapa: "EMPRESA_CRT", dados: () => ({ ...empresa(), CRT: "1" }) },
    { etapa: "EMPRESA_CRT", dados: () => ({ ...empresa(), CRT: 2.5 }) },
    { etapa: "EMPRESA_CRT", dados: () => ({ ...empresa(), CRT: 5 }) },
    { etapa: "EMPRESA_ENDERECO", dados: () => ({ ...empresa(), Endereco: [TOKEN] }) },
    { etapa: "EMPRESA_CONFIGURACAO", dados: () => ({ ...empresa(), Configuracao: TOKEN }) },
    { etapa: "EMPRESA_NFCE", dados: () => ({ ...empresa(), Configuracao: { NFCe: [USER_TOKEN] } }) },
    { etapa: "EMPRESA_UF", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, Uf: "BRA" } }) },
    { etapa: "EMPRESA_RAZAO_SOCIAL", dados: () => ({ ...empresa(), RzSocial: { segredo: TOKEN } }) },
    { etapa: "EMPRESA_NOME_FANTASIA", dados: () => ({ ...empresa(), NmFantasia: [USER_TOKEN] }) },
    { etapa: "EMPRESA_IE", dados: () => ({ ...empresa(), IE: { segredo: TOKEN } }) },
    { etapa: "EMPRESA_CEP", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, Cep: "0000000" } }) },
    { etapa: "EMPRESA_LOGRADOURO", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, Logradouro: { segredo: TOKEN } } }) },
    { etapa: "EMPRESA_NUMERO", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, Numero: [USER_TOKEN] } }) },
    { etapa: "EMPRESA_BAIRRO", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, Bairro: { segredo: TOKEN } } }) },
    { etapa: "EMPRESA_COD_MUNICIPIO", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, CodMunicipio: "000000" } }) },
    { etapa: "EMPRESA_MUNICIPIO", dados: () => ({ ...empresa(), Endereco: { ...empresa().Endereco, Municipio: [USER_TOKEN] } }) },
    { etapa: "EMPRESA_ID_CSC", dados: () => ({ ...empresa(), Configuracao: { NFCe: { IdCSCHomologacao: { segredo: TOKEN } } } }) },
    { etapa: "EMPRESA_CSC", dados: () => ({ ...empresa(), Configuracao: { NFCe: { CSCHomologacao: [USER_TOKEN] } } }) },
  ])("informa somente a etapa fixa $etapa sem aceitar campo inválido (%#)", async ({ etapa, dados }) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(dados()));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: etapa });
    expect(erro.diagnosticoSeguro).toEqual({ categoria: "CONTRATO", httpStatus: 200, etapaContrato: etapa, statusFornecedor: null, codigoFornecedor: null });
    conferirErroSemSegredos(erro);
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it.each([
    "00.000.000/0000-0", "00.000.000/0000-000", "00.000.000/0000-00extra",
    " 00.000.000/0000-00", "00.000.000/0000-00 ", "00.000.000/0000 -00",
    "00.000.000/0000-00\n", "00.000.000/0000-00\r\n",
    "00-000.000/0000-00", "00.000/000.0000-00", "00.000.000.0000-00",
  ])("rejeita máscara próxima incompleta/extra/espaçada/com pontuação incorreta (%#)", async (cnpj) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), CNPJ: cnpj }));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: "EMPRESA_CNPJ_FORMATO" });
    conferirErroSemSegredos(erro);
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it.each([1, 2, 3, 4] as const)("CRT válido %i continua estritamente numérico", async (crt) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), CRT: crt, status: true }));
    await expect(cliente(chamar).buscarEmpresa()).resolves.toMatchObject({ cnpj: CNPJ, crt });
  });

  it.each([TOKEN, USER_TOKEN, `prefixo ${TOKEN} sufixo`])("credencial refletida informa somente SEGREDO_REFLETIDO (%#)", async (segredo) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), RzSocial: segredo }));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: "SEGREDO_REFLETIDO" });
    conferirErroSemSegredos(erro);
  });

  it.each([
    { etapa: "CONTENT_TYPE", retorno: () => new Response(`<html>${TOKEN} ${USER_TOKEN}</html>`, { headers: { "content-type": "text/html" } }) },
    { etapa: "UTF8", retorno: () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { "content-type": "application/json" } }) },
    { etapa: "JSON", retorno: () => new Response(`{malformado ${TOKEN} ${USER_TOKEN}`, { headers: { "content-type": "application/json" } }) },
    { etapa: "OBJETO_JSON", retorno: () => resposta([TOKEN, USER_TOKEN]) },
    { etapa: "OBJETO_JSON", retorno: () => resposta(null) },
    { etapa: "OBJETO_JSON", retorno: () => resposta(TOKEN) },
  ])("diagnóstico de formato $etapa não conserva conteúdo externo (%#)", async ({ etapa, retorno }) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(retorno());
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: etapa });
    expect(erro.diagnosticoSeguro).toEqual({ categoria: etapa === "CONTENT_TYPE" ? "NAO_JSON" : etapa === "JSON" || etapa === "UTF8" ? "JSON_INVALIDO" : "CONTRATO", httpStatus: 200, etapaContrato: etapa, statusFornecedor: null, codigoFornecedor: null });
    conferirErroSemSegredos(erro);
  });

  it.each([
    "CONTENT_TYPE", "UTF8", "JSON", "OBJETO_JSON", "EMPRESA_ENVELOPE", "EMPRESA_STATUS", "EMPRESA_CNPJ",
    "EMPRESA_CNPJ_AUSENTE", "EMPRESA_CNPJ_NULO", "EMPRESA_CNPJ_NUMERICO", "EMPRESA_CNPJ_TIPO",
    "EMPRESA_CNPJ_MASCARADO", "EMPRESA_CNPJ_CPF", "EMPRESA_CNPJ_FORMATO",
    "EMPRESA_CRT", "EMPRESA_ENDERECO", "EMPRESA_CONFIGURACAO", "EMPRESA_NFCE", "EMPRESA_UF",
    "EMPRESA_RAZAO_SOCIAL", "EMPRESA_NOME_FANTASIA", "EMPRESA_IE", "EMPRESA_CEP", "EMPRESA_LOGRADOURO",
    "EMPRESA_NUMERO", "EMPRESA_BAIRRO", "EMPRESA_COD_MUNICIPIO", "EMPRESA_MUNICIPIO", "EMPRESA_ID_CSC",
    "EMPRESA_CSC", "SEGREDO_REFLETIDO",
  ])("constructor conserva a etapa conhecida %s somente em RESPOSTA_INVALIDA", (etapa) => {
    const erro = Reflect.construct(ErroHttpBrasilNfe, ["RESPOSTA_INVALIDA", etapa]) as ErroHttpBrasilNfe;
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: etapa });
    conferirErroSemSegredos(erro);
    const erroExterno = Reflect.construct(ErroHttpBrasilNfe, ["EXTERNO", etapa]) as ErroHttpBrasilNfe;
    expect(Reflect.get(erroExterno, "etapaContrato")).toBeUndefined();
    expect(JSON.stringify(erroExterno)).not.toContain(etapa);
    conferirErroSemSegredos(erroExterno);
  });

  it.each([
    TOKEN, USER_TOKEN, `EMPRESA_CRT ${TOKEN}`, "empresa_crt", "__proto__", "constructor", "",
    { segredo: TOKEN }, ["EMPRESA_CRT", USER_TOKEN], 1, true, null, undefined,
  ])("constructor descarta qualquer etapa fora da enum sem conservar dados arbitrários (%#)", (etapa) => {
    const erro = Reflect.construct(ErroHttpBrasilNfe, ["RESPOSTA_INVALIDA", etapa]) as ErroHttpBrasilNfe;
    expect(Reflect.get(erro, "etapaContrato")).toBeUndefined();
    expect(JSON.parse(JSON.stringify(erro))).toEqual({ codigo: "RESPOSTA_INVALIDA", name: "ErroHttpBrasilNfe", diagnosticoSeguro: { categoria: "CONTRATO", httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null } });
    conferirErroSemSegredos(erro);
  });

  it.each([401, 403, 404, 429, 500, 502, 503])("transporte HTTP %i não recebe etapa de resposta inválida nem mensagens externas", async (status) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ Error: `${TOKEN} ${USER_TOKEN}` }, status));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro.codigo).toBe(status === 401 ? "CREDENCIAL_INVALIDA" : "EXTERNO");
    expect(erro.diagnosticoSeguro).toEqual({ categoria: "HTTP", httpStatus: status, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null });
    expect(Reflect.get(erro, "etapaContrato")).toBeUndefined();
    conferirErroSemSegredos(erro);
  });

  it("erro de rede com causa sensível não recebe etapa nem conserva a causa", async () => {
    const chamar = vi.fn<typeof fetch>().mockRejectedValue(new Error(`rede ${TOKEN}`, { cause: { UserToken: USER_TOKEN } }));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro.codigo).toBe("EXTERNO");
    expect(erro.diagnosticoSeguro).toEqual({ categoria: "TRANSPORTE", httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null });
    expect(Reflect.get(erro, "etapaContrato")).toBeUndefined();
    conferirErroSemSegredos(erro);
  });

  it.each([
    new Response("<html>autenticação</html>", { headers: { "content-type": "text/html" } }),
    new Response("{malformado", { headers: { "content-type": "application/json" } }),
    resposta([]), new Response("{}", { status: 202, headers: { "content-type": "application/json" } }),
  ])("rejeita HTML/JSON malformado/envelope/aceite parcial (%#)", async (retorno) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(retorno);
    await expect(cliente(chamar).buscarEmpresa()).rejects.toBeInstanceOf(ErroHttpBrasilNfe);
  });

  it("o timeout limita também um transporte que ignora abort, sem retentar", async () => {
    vi.useFakeTimers();
    const chamar = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const resultado = cliente(chamar, USER_TOKEN, 10).buscarEmpresa();
    const verificacao = expect(resultado).rejects.toMatchObject({ codigo: "TIMEOUT", diagnosticoSeguro: { categoria: "TIMEOUT", httpStatus: null } });
    await vi.advanceTimersByTimeAsync(11);
    await verificacao;
    expect(chamar).toHaveBeenCalledTimes(1);
    expect(chamar.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("o timeout abrange leitura lenta do corpo e cancela o stream", async () => {
    vi.useFakeTimers();
    const cancelamento = vi.fn();
    const corpo = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode("{")); }, cancel: cancelamento });
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(corpo, { headers: { "content-type": "application/json" } }));
    const resultado = cliente(chamar, USER_TOKEN, 10).buscarEmpresa();
    const verificacao = expect(resultado).rejects.toMatchObject({ codigo: "TIMEOUT", diagnosticoSeguro: { categoria: "TIMEOUT", httpStatus: 200 } });
    await vi.advanceTimersByTimeAsync(11);
    await verificacao;
    expect(cancelamento).toHaveBeenCalledTimes(1);
  });

  it("impõe 1 MiB pelo header e pela contagem real do stream", async () => {
    const respostas = [
      new Response("{}", { headers: { "content-type": "application/json", "content-length": String(1024 * 1024 + 1) } }),
      new Response('"' + "x".repeat(1024 * 1024) + '"', { headers: { "content-type": "application/json", "content-length": "2" } }),
    ];
    for (const retorno of respostas) {
      const chamar = vi.fn<typeof fetch>().mockResolvedValue(retorno);
      await expect(cliente(chamar).buscarEmpresa()).rejects.toMatchObject({ codigo: "LIMITE_RESPOSTA", diagnosticoSeguro: { categoria: "LIMITE", httpStatus: 200 } });
    }
  });

  it("erros de rede/redirect/limite HTTP não carregam causas ou mensagens brutas", async () => {
    const chamar = vi.fn<typeof fetch>().mockRejectedValue(new Error(`redirect ${TOKEN}`));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro.codigo).toBe("EXTERNO");
    expect(erro).not.toHaveProperty("cause");
    expect(erro.message).not.toContain(TOKEN);
    const limite = vi.fn<typeof fetch>().mockResolvedValue(resposta({ Error: TOKEN }, 429));
    await expect(cliente(limite).buscarEmpresa()).rejects.toMatchObject({ codigo: "EXTERNO" });
  });

  it.each([55, 65] as const)("consulta modelo %i em homologação, sem UserToken nem efeitos de emissão", async (modelo) => {
    const chave = CHAVE.slice(0, 20) + String(modelo) + CHAVE.slice(22);
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope({ Nota: nota({ ModeloDocumento: modelo, Chave: chave }), Historico: [nota({ ModeloDocumento: modelo, Chave: chave, Status: 3, Emitida: false, CodStatusResposta: 225, NumeroProtocolo: null })] })));
    const dto = await new ClienteBrasilNfe({ token: TOKEN }, { fetch: chamar }).consultarNotaFiscal({ ...requisicao, modelo });
    expect(dto.Nota?.NumeroProtocolo).toBe("135260000000000000123");
    expect(dto.Historico).toHaveLength(1);
    expect(JSON.stringify(dto)).not.toMatch(/Base64|token-empresa|token-usuario|NomeDestinatario/);
    expect(chamar).toHaveBeenCalledExactlyOnceWith("https://api.brasilnfe.com.br/services/fiscal/ConsultarNotaFiscal", expect.objectContaining({
      method: "POST", body: JSON.stringify({ IdentificadorInterno: DOCUMENTO, ModeloDocumento: modelo, TipoAmbiente: 2, RetornarArquivos: false }),
      headers: { Accept: "application/json", "Content-Type": "application/json", Token: TOKEN },
    }));
  });

  it("preserva inteiro int64 recebido como literal JSON e zeros de protocolos textuais", async () => {
    // Preserva int64 do contrato genérico sem afirmar autorização de uma NF-e
    // cujo número não cabe na chave fiscal. Protocolos permanecem textuais.
    const bruto = JSON.stringify(envelope({ Nota: nota({ Status: 0, Emitida: false, CodStatusResposta: null, Chave: null, Numero: "__int64__", NumeroProtocolo: "000135260000000000123" }) })).replace('"__int64__"', "9223372036854775807");
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(bruto, { headers: { "content-type": "application/json" } }));
    const dto = await cliente(chamar).consultarNotaFiscal(requisicao);
    expect(dto.Nota?.Numero).toBe("9223372036854775807");
    expect(dto.Nota?.NumeroProtocolo).toBe("000135260000000000123");
  });

  it("JSON numérico em expoente que já perderia precisão falha explicitamente", async () => {
    const bruto = JSON.stringify(envelope({ Nota: nota({ Numero: "__int64__" }) })).replace('"__int64__"', "9223372036854775807e0");
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(bruto, { headers: { "content-type": "application/json" } }));
    await expect(cliente(chamar).consultarNotaFiscal(requisicao)).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });

  it("a consulta wire descarta propriedades extras antes de transmitir", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope()));
    const entrada = { IdentificadorInterno: DOCUMENTO, ModeloDocumento: 55, TipoAmbiente: 2, RetornarArquivos: false,
      EnviarEmail: true, endpoint: "/EnviarNotaFiscal" } as RequisicaoConsultaBrasilNfeHttp;
    await cliente(chamar).consultarNotaFiscal(entrada);
    expect(chamar.mock.calls[0][1]?.body).toBe(JSON.stringify({ IdentificadorInterno: DOCUMENTO, ModeloDocumento: 55, TipoAmbiente: 2, RetornarArquivos: false }));
  });

  it.each([
    { ...requisicao, ambiente: "PRODUCAO" },
    { IdentificadorInterno: DOCUMENTO, ModeloDocumento: 55, TipoAmbiente: 1, RetornarArquivos: false },
  ])("produção é bloqueada antes de qualquer request (%#)", async (entrada) => {
    const chamar = vi.fn<typeof fetch>();
    await expect(cliente(chamar).consultarNotaFiscal(entrada as RequisicaoConsultaBrasilNfe)).rejects.toMatchObject({ codigo: "PRODUCAO_BLOQUEADA" });
    expect(chamar).not.toHaveBeenCalled();
  });

  it.each([
    { Nota: nota({ ModeloDocumento: 65 }) }, { Nota: nota({ CodTipoAmbiente: 1 }) },
    { Nota: nota({ IdentificadorInterno: "outro-documento" }) },
    { Historico: [nota({ CodTipoAmbiente: 1 })] }, { Historico: [nota({ IdentificadorInterno: "outra-tentativa" })] },
    { Encontrada: false }, { Encontrada: true, Nota: null }, { Nota: nota({ NumeroProtocolo: 1.5 }) },
  ])("resposta incerta/divergente não vira ausência (%#)", async (alteracao) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope(alteracao)));
    await expect(cliente(chamar).consultarNotaFiscal(requisicao)).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });

  it("ausência válida continua sendo evidência externa, sem autorizar reenvio", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope({ Encontrada: false, Nota: null })));
    await expect(cliente(chamar).consultarNotaFiscal(requisicao)).resolves.toMatchObject({ Encontrada: false, Nota: null, Historico: [], status: 0 });
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it.each([{ status: 2 }, { erros: [{ codigo: "erro", descricao: TOKEN }] }, { erros: undefined }, { Historico: undefined }])("falha ou contrato parcial não vira ausência (%#)", async (alteracao) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope({ Encontrada: false, Nota: null, ...alteracao })));
    await expect(cliente(chamar).consultarNotaFiscal(requisicao)).rejects.toBeInstanceOf(ErroHttpBrasilNfe);
  });

  it("não permite injetar transporte/prazo fora dos testes nem ampliar o timeout", () => {
    expect(() => new ClienteBrasilNfe({ token: TOKEN }, { timeoutMs: 120000 })).toThrow(ErroHttpBrasilNfe);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => new ClienteBrasilNfe({ token: TOKEN }, { fetch: vi.fn() })).toThrow(ErroHttpBrasilNfe);
    expect(() => new ClienteBrasilNfe({ token: TOKEN }, { timeoutMs: 1 })).toThrow(ErroHttpBrasilNfe);
  });
});

describe("Diagnóstico seguro Brasil NFe: HTTP, contrato e negócio permanecem distintos", () => {
  it("404 na consulta de nota própria permanece erro HTTP, sem prova de ausência nem retentativa", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope({ Encontrada: false, Nota: null }), 404));
    const erro = await capturarErro(cliente(chamar).consultarNotaFiscal(requisicao));
    expect(erro).toMatchObject({ codigo: "EXTERNO", diagnosticoSeguro: { categoria: "HTTP", httpStatus: 404, statusFornecedor: null } });
    conferirErroSemSegredos(erro);
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1, -1, 999, TOKEN])("erros de negócio não preservam código fornecedor sem enum publicada (%#)", async (codigo) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ status: 0, Servicos: [], avisos: [USER_TOKEN],
      erros: [{ codigo, descricao: TOKEN, correcao: USER_TOKEN }] }));
    const erro = await capturarErro(cliente(chamar).consultarServicos());
    expect(erro.codigo).toBe("EXTERNO");
    expect(erro.diagnosticoSeguro).toMatchObject({ categoria: "NEGOCIO", httpStatus: 200, etapaContrato: "SERVICOS_ENVELOPE", statusFornecedor: 0, codigoFornecedor: null, indicadores: ["ERROS_PREENCHIDOS"] });
    conferirErroSemSegredos(erro);
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it.each([1, 2, -1, 99, 999999])("status fornecedor não publicado é observado sem inferir semântica ou sucesso (%#)", async (status) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ status, Servicos: [], erros: [], avisos: [] }));
    const erro = await capturarErro(cliente(chamar).consultarServicos());
    expect(erro.diagnosticoSeguro).toMatchObject({ categoria: "NEGOCIO", httpStatus: 200, etapaContrato: "SERVICOS_ENVELOPE", statusFornecedor: status, codigoFornecedor: null,
      tipoStatusFornecedor: "NUMERO", estadoStatusFornecedor: "NUMERO_NAO_ZERO", indicadores: ["STATUS_NUMERICO_NAO_ZERO"] });
    expect(erro.codigo).toBe("EXTERNO");
    conferirErroSemSegredos(erro);
  });

  it.each([TOKEN, null, { codigo: TOKEN }, [TOKEN], [null], [false], [[]]])("conteúdo inválido de erros é contrato, não negócio (%#)", async (erros) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ status: 0, Servicos: [], erros, avisos: [] }));
    const erro = await capturarErro(cliente(chamar).consultarServicos());
    expect(erro.codigo).toBe("RESPOSTA_INVALIDA");
    expect(erro.diagnosticoSeguro).toMatchObject({ categoria: "CONTRATO", httpStatus: 200, etapaContrato: "SERVICOS_ENVELOPE", statusFornecedor: 0, codigoFornecedor: null,
      indicadores: expect.arrayContaining(["FORMATO_INCOMPATIVEL"]) });
    conferirErroSemSegredos(erro);
  });

  it.each([
    { etapa: "SERVICOS_LISTA", dados: { Servicos: { segredo: TOKEN } } },
    { etapa: "SERVICOS_ITEM", dados: { Servicos: [TOKEN] } },
    { etapa: "SERVICOS_NOME", dados: { Servicos: [{ Nome: { segredo: TOKEN }, Ativo: true }] } },
    { etapa: "SERVICOS_NOME", dados: { Servicos: [{ Nome: "", Ativo: true }] } },
    { etapa: "SERVICOS_ATIVO", dados: { Servicos: [{ Nome: "NF-e", Ativo: USER_TOKEN }] } },
    { etapa: "SERVICOS_AVISOS", dados: { avisos: { segredo: USER_TOKEN } } },
  ])("campo de serviço $etapa inválido conserva apenas sua etapa fixa e HTTP 200", async ({ etapa, dados }) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ status: 0, erros: [], avisos: [], Servicos: [], ...dados }));
    const erro = await capturarErro(cliente(chamar).consultarServicos());
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", diagnosticoSeguro: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: etapa, statusFornecedor: 0, codigoFornecedor: null } });
    conferirErroSemSegredos(erro);
  });

  it("não confunde status do documento com status do processamento nem aceita identidade divergente", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta(envelope({ Nota: nota({ IdentificadorInterno: "outra-nota-sintetica", Status: 999 }) })));
    const erro = await capturarErro(cliente(chamar).consultarNotaFiscal(requisicao));
    expect(erro).toMatchObject({ codigo: "RESPOSTA_INVALIDA", diagnosticoSeguro: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NOTA_CAMPOS", statusFornecedor: 0, codigoFornecedor: null } });
    conferirErroSemSegredos(erro);
  });

  it("falha booleana extra na empresa é negócio sem status fornecedor documentado", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...empresa(), status: false }));
    const erro = await capturarErro(cliente(chamar).buscarEmpresa());
    expect(erro.diagnosticoSeguro).toEqual({ categoria: "NEGOCIO", httpStatus: 200, etapaContrato: "EMPRESA_ENVELOPE", statusFornecedor: null, codigoFornecedor: null });
    conferirErroSemSegredos(erro);
  });

  it("terceiro argumento parcial preserva a assinatura legada e descarta detalhes livres", () => {
    const metadados = { categoria: "HTTP", httpStatus: 403, body: TOKEN, headers: { UserToken: USER_TOKEN },
      cause: TOKEN, message: USER_TOKEN, codigoFornecedor: TOKEN, statusFornecedor: 987 };
    const erro = Reflect.construct(ErroHttpBrasilNfe, ["EXTERNO", undefined, metadados]) as ErroHttpBrasilNfe;
    expect(erro.diagnosticoSeguro).toEqual({ categoria: "HTTP", httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null });
    expect(erro.codigo).toBe("EXTERNO");
    conferirErroSemSegredos(erro);
    const legado = new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", "EMPRESA_CRT");
    expect(legado.etapaContrato).toBe("EMPRESA_CRT");
    expect(legado.diagnosticoSeguro.etapaContrato).toBe("EMPRESA_CRT");
  });

  it.each([TOKEN, USER_TOKEN, "__proto__", { segredo: TOKEN }])("código local arbitrário não é serializado pelo construtor (%#)", (codigo) => {
    const erro = Reflect.construct(ErroHttpBrasilNfe, [codigo]) as ErroHttpBrasilNfe;
    expect(erro.codigo).toBe("EXTERNO");
    conferirErroSemSegredos(erro);
  });

  it("sanitizador de JSON persistido conserva somente campos da lista permitida", () => {
    const seguro = sanitizarMetadadosErroBrasilNfe({ categoria: "CONTRATO", httpStatus: 200, etapaContrato: "SERVICOS_ENVELOPE", statusFornecedor: 0,
      codigoFornecedor: TOKEN, message: TOKEN, headers: { UserToken: USER_TOKEN }, body: TOKEN, cause: USER_TOKEN, payload: empresa() });
    expect(seguro).toEqual({ categoria: "CONTRATO", httpStatus: 200, etapaContrato: "SERVICOS_ENVELOPE", statusFornecedor: 0, codigoFornecedor: null });
    expect(JSON.stringify(seguro)).not.toContain(TOKEN);
    expect(JSON.stringify(seguro)).not.toContain(USER_TOKEN);
    expect(Object.isFrozen(seguro)).toBe(true);
  });

  it.each([null, [], {}, TOKEN, { categoria: TOKEN }, { categoria: "__proto__" }, { categoria: "constructor" }, { categoria: "http" }])("sanitizador descarta categoria desconhecida ou valor que não é objeto (%#)", (entrada) => {
    expect(sanitizarMetadadosErroBrasilNfe(entrada)).toBeNull();
  });

  it.each([99, 600, -1, 401.5, Number.NaN, Number.POSITIVE_INFINITY, "401", TOKEN])("status HTTP fora do contrato não é convertido nem retido (%#)", (httpStatus) => {
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "HTTP", httpStatus, etapaContrato: TOKEN, statusFornecedor: USER_TOKEN, codigoFornecedor: TOKEN }))
      .toEqual({ categoria: "HTTP", httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null });
  });

  it.each([100, 200, 401, 403, 404, 429, 500, 599])("status HTTP numérico válido %i permanece numérico", (httpStatus) => {
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "HTTP", httpStatus })?.httpStatus).toBe(httpStatus);
  });

  it.each([false, 1, -1, "0", TOKEN])("status fornecedor desconhecido não é normalizado como sucesso (%#)", (statusFornecedor) => {
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "NEGOCIO", statusFornecedor })?.statusFornecedor).toBeNull();
  });

  it("mapas compartilhados não permitem categorias/etapas herdadas ou novas em runtime", () => {
    expect(Object.isFrozen(CATEGORIAS_DIAGNOSTICO_BRASILNFE)).toBe(true);
    expect(Object.isFrozen(ETAPAS_CONTRATO_BRASILNFE)).toBe(true);
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "CONTRATO", etapaContrato: "__proto__" })?.etapaContrato).toBeNull();
  });
});
