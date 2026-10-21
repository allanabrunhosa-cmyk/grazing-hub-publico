import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteBrasilNfe, ErroHttpBrasilNfe, obterDetalhesTemporariosErroBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { prepararDiagnosticoServicosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/detalhes-diagnostico";
import { sanitizarMetadadosErroBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";

const TOKEN = "token-sintetico-seguro-empresa", USER_TOKEN = "user-sintetico-seguro-usuario";
const credenciais = { token: TOKEN, userToken: USER_TOKEN };
const envelope = (dados: Record<string, unknown> = {}) => ({ status: 0, erros: [], Servicos: [], avisos: [], ...dados });
function projetar(dados: Record<string, unknown>, chaves = credenciais) { return prepararDiagnosticoServicosBrasilNfe(envelope(dados), chaves, false); }
async function falha(dados: unknown, chaves = credenciais, httpStatus = 200) {
  const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(dados), { status: httpStatus, headers: { "content-type": "application/json" } }));
  const cliente = new ClienteBrasilNfe(chaves, { fetch: chamar });
  try { await cliente.consultarServicos(); }
  catch (erro) { if (erro instanceof ErroHttpBrasilNfe) return { erro, chamar }; throw erro; }
  throw new Error("O envelope sintético deveria ser rejeitado.");
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Motivo transitório restrito de ConsultarServicos", () => {
  it.each([
    "Token inválido", "Permissão de consulta não concedida.", "Conferir vínculo no cadastro.",
    "Usuário não pertence ao grupo da empresa", "Serviço não contratado", "Acesso recusado para consultar serviços.",
  ])("conserva contexto técnico sem interpretar a frase (%#)", (descricao) => {
    const { detalhes } = projetar({ erros: [{ codigo: "E_USER_DISABLED", descricao, correcao: "Conferir vínculo no cadastro." }] });
    expect(detalhes.erros[0]).toEqual({ codigo: { estado: "EXIBIDO", valor: "E_USER_DISABLED" }, descricao: { estado: "EXIBIDO", valor: descricao }, correcao: { estado: "EXIBIDO", valor: "Conferir vínculo no cadastro." } });
  });

  it.each(["INVALID_CREDENTIALS", "E_USER_DISABLED", "PROVIDER_NEW_STATUS", "UNKNOWN_CODE", "PERMISSION_CHECK", "X001", "ABC-92", "E42", 0, 999999, -1])("observa código curto de máquina sem inferir autenticação ou semântica (%#)", (codigo) => {
    const { detalhes, metadados } = projetar({ erros: [{ codigo }] });
    expect(detalhes.erros[0].codigo).toEqual({ estado: "EXIBIDO", valor: codigo });
    expect(metadados).not.toHaveProperty("codigoFornecedor");
  });

  it("extrai motivo em status incompatível sem aceitar envelope nem guardar textos no Error", async () => {
    const { erro, chamar } = await falha(envelope({ status: false, Error: "Token inválido", erros: [{ codigo: "E_USER_DISABLED", descricao: "Usuário não pertence ao grupo da empresa" }] }));
    expect(erro.codigo).toBe("EXTERNO");
    expect(erro.diagnosticoSeguro).toMatchObject({ categoria: "NEGOCIO", statusFornecedor: false, tipoStatusFornecedor: "BOOLEANO", estadoStatusFornecedor: "FALSE",
      indicadores: ["ERROR_PREENCHIDO", "ERROS_PREENCHIDOS", "STATUS_FALSE", "FORMATO_INCOMPATIVEL"] });
    expect(JSON.stringify(erro)).not.toMatch(/Token inválido|E_USER_DISABLED|Usuário não pertence/);
    expect(erro).not.toHaveProperty("cause");
    const detalhes = obterDetalhesTemporariosErroBrasilNfe(erro);
    expect(detalhes?.error).toEqual({ estado: "EXIBIDO", valor: "Token inválido" });
    expect(detalhes?.erros[0].descricao.valor).toBe("Usuário não pertence ao grupo da empresa");
    expect(Object.isFrozen(detalhes)).toBe(true);
    expect(Object.isFrozen(detalhes?.erros[0])).toBe(true);
    expect(obterDetalhesTemporariosErroBrasilNfe(erro)).toBeNull();
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it("expira a projeção após cinco minutos sem retentativa", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const { erro, chamar } = await falha(envelope({ Error: "Serviço não contratado" }));
    vi.setSystemTime(new Date("2026-10-10T12:05:00Z"));
    expect(obterDetalhesTemporariosErroBrasilNfe(erro)).toBeNull();
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404, 429, 500])("resposta HTTP %i não coleta mensagem do corpo", async (status) => {
    const { erro } = await falha({ Error: "Token inválido", status: false, erros: [{ descricao: "Serviço não contratado" }] }, credenciais, status);
    expect(obterDetalhesTemporariosErroBrasilNfe(erro)).toBeNull();
    expect(erro.diagnosticoSeguro).toMatchObject({ categoria: "HTTP", httpStatus: status });
  });

  it.each(["empresa", "nota"])("não coleta textos de %s", async (consulta) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ Error: "Token inválido", status: false, erros: [{ descricao: "Serviço não contratado" }] }), { headers: { "content-type": "application/json" } }));
    const cliente = new ClienteBrasilNfe(credenciais, { fetch: chamar });
    let erro: unknown;
    try { if (consulta === "empresa") await cliente.buscarEmpresa(); else await cliente.consultarNotaFiscal({ documentoId: "documento-sintetico", modelo: 55, ambiente: "HOMOLOGACAO" }); }
    catch (falha) { erro = falha; }
    expect(erro).toBeInstanceOf(ErroHttpBrasilNfe);
    expect(obterDetalhesTemporariosErroBrasilNfe(erro)).toBeNull();
    expect(JSON.stringify(erro)).not.toContain("Token inválido");
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it("getter não aceita entrada arbitrária nem expõe mapa ou credenciais", () => {
    for (const valor of [null, undefined, "erro", 1, false, {}, new Error("sintético")]) expect(obterDetalhesTemporariosErroBrasilNfe(valor)).toBeNull();
  });

  it.each([
    { corpo: "<html>Erro</html>", tipo: "text/html" }, { corpo: "{", tipo: "application/json" },
    { corpo: "null", tipo: "application/json" }, { corpo: "[]", tipo: "application/json" },
  ])("falha antes do objeto JSON não gera detalhe transitório (%#)", async ({ corpo, tipo }) => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(corpo, { headers: { "content-type": tipo } }));
    const cliente = new ClienteBrasilNfe(credenciais, { fetch: chamar });
    let erro: unknown; try { await cliente.consultarServicos(); } catch (falha) { erro = falha; }
    expect(erro).toBeInstanceOf(ErroHttpBrasilNfe);
    expect(obterDetalhesTemporariosErroBrasilNfe(erro)).toBeNull();
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it("consulta de serviços bem sucedida não cria mensagem diagnóstica ou chamada extra", async () => {
    const chamar = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(envelope({ Error: "", Servicos: [{ Nome: "NF-e/NFC-e", Ativo: true }] })), { headers: { "content-type": "application/json" } }));
    const dto = await new ClienteBrasilNfe(credenciais, { fetch: chamar }).consultarServicos();
    expect(dto).toEqual({ servicos: [{ nome: "NF-e/NFC-e", ativo: true }], avisosPresentes: false });
    expect(obterDetalhesTemporariosErroBrasilNfe(dto)).toBeNull(); expect(chamar).toHaveBeenCalledTimes(1);
  });
});

describe("Projeção conservadora: segredos, dados pessoais e limites", () => {
  it.each([
    TOKEN, USER_TOKEN, TOKEN.toUpperCase(), Buffer.from(TOKEN).toString("base64"), Buffer.from(TOKEN).toString("base64url"), Buffer.from(TOKEN).toString("hex"),
    [...TOKEN].join(" "), [...TOKEN].join("\u0000"), [...TOKEN].map((c) => `%${c.charCodeAt(0).toString(16)}`).join(""),
    "admin@example.invalid", "(11) 90000-0000", "000.000.000-00", "00.000.000/0000-00", "https://exemplo.invalid/credencial",
    "<b>Token inválido</b>", "Token &lt;inválido&gt;", "Token\u202e inválido", "Token\ninválido", "senha: valor-externo-desconhecido",
    "Nome: Pessoa Sintética", "PessoaSinteticaDesconhecida", "A".repeat(301),
  ])("suprime integralmente texto sensível, codificado ou sem contexto (%#)", (descricao) => {
    const { detalhes, metadados } = projetar({ Error: descricao, erros: [{ codigo: descricao, descricao, correcao: descricao }] });
    expect(detalhes.error).toEqual({ estado: "SUPRIMIDO", valor: null });
    expect(detalhes.erros[0].descricao).toEqual({ estado: "SUPRIMIDO", valor: null });
    expect(detalhes.erros[0].correcao).toEqual({ estado: "SUPRIMIDO", valor: null });
    expect(JSON.stringify(metadados)).not.toContain(descricao);
    expect(JSON.stringify(detalhes)).not.toContain(descricao);
  });

  it("substitui credencial literal numa frase técnica útil, sem devolver o valor", () => {
    const { detalhes, metadados } = projetar({ Error: `Token ${TOKEN} inválido` });
    expect(detalhes.error).toEqual({ estado: "EXIBIDO", valor: "Token [suprimido] inválido" });
    expect(metadados.camposSuprimidos).toContain("ERROR");
    expect(JSON.stringify(detalhes)).not.toContain(TOKEN);
  });

  it.each([
    { token: "token-sintetico", userToken: "usertoken-sintetico" },
    { token: "usertoken-sintetico", userToken: "token-sintetico" },
  ])("credenciais contidas uma na outra não deixam prefixo na supressão pura (%#)", (chaves) => {
    for (const segredo of [chaves.token, chaves.userToken]) {
      const { detalhes } = projetar({ Error: segredo.toUpperCase(), erros: [{ descricao: segredo, correcao: ` ${segredo} ` }] }, chaves);
      expect(detalhes.error).toEqual({ estado: "SUPRIMIDO", valor: null });
      expect(detalhes.erros[0].descricao).toEqual({ estado: "SUPRIMIDO", valor: null });
      expect(detalhes.erros[0].correcao).toEqual({ estado: "SUPRIMIDO", valor: null });
    }
    const maior = [chaves.token, chaves.userToken].sort((a, b) => b.length - a.length)[0];
    expect(projetar({ Error: `Token ${maior} inválido` }, chaves).detalhes.error).toEqual({ estado: "EXIBIDO", valor: "Token [suprimido] inválido" });
  });

  it("preserva contexto técnico e suprime palavras desconhecidas de frase composta", () => {
    const { detalhes } = projetar({ Error: "Usuário PessoaSinteticaDesconhecida não possui permissão para consultar serviços." });
    expect(detalhes.error).toEqual({ estado: "EXIBIDO", valor: "Usuário [suprimido] não possui permissão para consultar serviços." });
  });

  it.each(["validABCDEFGHIJKLMNOP", "conferSegredoLongo", "valid" + "a".repeat(40)])("prefixo técnico não permite palavra arbitrária ou extensa (%#)", (palavra) => {
    const { detalhes } = projetar({ Error: `Usuário ${palavra} sem permissão para consultar serviços.` });
    expect(detalhes.error.estado).toBe("EXIBIDO");
    expect(detalhes.error.valor).toContain("[suprimido]");
    expect(detalhes.error.valor).not.toContain(palavra);
  });

  it.each(["E_ABCDEFABCDEFABCD", "ABCDEFABCDEFABCD", "E_SECRETLONGWITHUPPERCASE", "eyJhbGciOiJIUzI1NiJ9.eyJzZXNyZXQiOiJmaWN0aWNpbyJ9.assinatura", "U2VncmVkb0V4dGVybm9TaW50ZXRpY28="])("aparência de código opaco não supera proteção do detalhe (%#)", (codigo) => {
    expect(projetar({ erros: [{ codigo }] }).detalhes.erros[0].codigo).toEqual({ estado: "SUPRIMIDO", valor: null });
  });

  it.each(["CLIENTE_ANA_SILVA", "ANA_SILVA", "USER_RANDOMSECRETVALUE", "E_RANDOMSECRET", "PERMISSION_ANA", "UNKNOWN_ABCDEF"])("segmento lexical desconhecido de código não atravessa como nome ou segredo (%#)", (codigo) => {
    expect(projetar({ erros: [{ codigo }] }).detalhes.erros[0].codigo).toEqual({ estado: "SUPRIMIDO", valor: null });
  });

  it.each([
    { segredo: "123456", status: 123456, codigo: 123456 }, { segredo: "0", status: 0, codigo: 0 },
    { segredo: "false", status: false, codigo: "FALSE" }, { segredo: "true", status: true, codigo: "TRUE" },
    { segredo: "123", status: -12345, codigo: "E_1234" },
  ])("suprime reflexão de credencial válida numérica/booleana ou substring (%#)", ({ segredo, status, codigo }) => {
    const { detalhes, metadados } = projetar({ status, erros: [{ codigo, descricao: segredo }] }, { token: segredo, userToken: USER_TOKEN });
    expect(metadados).toMatchObject({ statusFornecedor: null, estadoStatusFornecedor: "SUPRIMIDO_SEGREDO", camposSuprimidos: expect.arrayContaining(["STATUS", "ERROS_CODIGO"]) });
    expect(detalhes.erros[0].codigo).toEqual({ estado: "SUPRIMIDO", valor: null });
    expect(detalhes.erros[0].descricao).toEqual({ estado: "SUPRIMIDO", valor: null });
  });

  it("compara também UserToken numérico e representações codificadas de credenciais curtas", () => {
    const { detalhes, metadados } = projetar({ status: 123456, erros: [{ codigo: "MTIzNDU2", descricao: "MTIzNDU2" }] }, { token: TOKEN, userToken: "123456" });
    expect(metadados.estadoStatusFornecedor).toBe("SUPRIMIDO_SEGREDO");
    expect(detalhes.erros[0].codigo.estado).toBe("SUPRIMIDO");
    expect(detalhes.erros[0].descricao.estado).toBe("SUPRIMIDO");
  });

  it("distingue campos ausentes, vazios e formatos incompatíveis sem impor obrigatoriedade externa", () => {
    const { detalhes, metadados } = projetar({ erros: [{ codigo: "", descricao: "  " }, { codigo: {}, descricao: false, correcao: null }] });
    expect(detalhes.erros[0]).toEqual({ codigo: { estado: "VAZIO", valor: null }, descricao: { estado: "VAZIO", valor: null }, correcao: { estado: "AUSENTE", valor: null } });
    expect(detalhes.erros[1]).toEqual({ codigo: { estado: "FORMATO_INVALIDO", valor: null }, descricao: { estado: "FORMATO_INVALIDO", valor: null }, correcao: { estado: "FORMATO_INVALIDO", valor: null } });
    expect(metadados.camposAusentes).toContain("ERROS_CORRECAO");
    expect(metadados.indicadores).toContain("FORMATO_INCOMPATIVEL");
  });

  it("limita itens e caracteres sem copiar campos extras", () => {
    const { detalhes } = projetar({ erros: Array.from({ length: 8 }, () => ({ codigo: "X".repeat(49), descricao: "Serviço ".repeat(50), correcao: "Conferir cadastro", segredo: TOKEN })) });
    expect(detalhes.erros).toHaveLength(5); expect(detalhes.quantidadeErros).toBe(8);
    expect(detalhes.camposSuprimidos).toContain("ERROS");
    expect(detalhes.erros[0].codigo.estado).toBe("SUPRIMIDO"); expect(detalhes.erros[0].descricao.estado).toBe("SUPRIMIDO");
    expect(JSON.stringify(detalhes)).not.toContain(TOKEN);
  });

  it.each([1000000, -1000000, 1.5, "erro", null])("status fora do limite/tipo nunca vira valor observado aceito (%#)", (status) => {
    const { metadados, detalhes } = projetar({ status, erros: [{ descricao: "Serviço não contratado" }] });
    expect(metadados.statusFornecedor).toBeNull();
    expect(detalhes.erros[0].descricao.valor).toBe("Serviço não contratado");
    expect(metadados.estadoStatusFornecedor).toBe(status === null ? "NULO" : typeof status === "number" && Number.isInteger(status) ? "FORA_LIMITE" : "INCOMPATIVEL");
  });

  it("observa ausência de status separadamente de null e não conserva erro malformado", () => {
    const { metadados, detalhes } = prepararDiagnosticoServicosBrasilNfe({ erros: [false], Error: {} }, credenciais, false);
    expect(metadados).toMatchObject({ statusFornecedor: null, tipoStatusFornecedor: "AUSENTE", estadoStatusFornecedor: "AUSENTE", camposAusentes: expect.arrayContaining(["STATUS", "SERVICOS"]) });
    expect(detalhes.error.estado).toBe("FORMATO_INVALIDO"); expect(detalhes.erros[0].codigo.estado).toBe("FORMATO_INVALIDO");
  });
});

describe("Metadados persistíveis sem texto livre", () => {
  it.each([
    { status: 7, tipo: "NUMERO", estado: "NUMERO_NAO_ZERO" }, { status: 0, tipo: "NUMERO", estado: "ZERO" },
    { status: false, tipo: "BOOLEANO", estado: "FALSE" }, { status: true, tipo: "BOOLEANO", estado: "TRUE" },
  ])("conserva somente valor limitado acompanhado de tipo e estado compatíveis (%#)", ({ status, tipo, estado }) => {
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "NEGOCIO", statusFornecedor: status, tipoStatusFornecedor: tipo, estadoStatusFornecedor: estado, codigoFornecedor: TOKEN, descricao: USER_TOKEN }))
      .toEqual({ categoria: "NEGOCIO", httpStatus: null, etapaContrato: null, statusFornecedor: status, tipoStatusFornecedor: tipo, estadoStatusFornecedor: estado, codigoFornecedor: null });
  });

  it.each(["ZERO", "NUMERO_NAO_ZERO", "FALSE", "TRUE"])("valor ausente não conserva estado de observação %s", (estadoStatusFornecedor) => {
    const seguro = sanitizarMetadadosErroBrasilNfe({ categoria: "NEGOCIO", statusFornecedor: TOKEN, tipoStatusFornecedor: "NUMERO", estadoStatusFornecedor });
    expect(seguro?.statusFornecedor).toBeNull(); expect(seguro?.estadoStatusFornecedor).toBe("INCOMPATIVEL");
  });

  it("filtra enumerações e propriedades extras e conserva a distinção de segredo suprimido", () => {
    const seguro = sanitizarMetadadosErroBrasilNfe({ categoria: "NEGOCIO", statusFornecedor: null, tipoStatusFornecedor: "NUMERO", estadoStatusFornecedor: "SUPRIMIDO_SEGREDO",
      indicadores: ["ERROS_PREENCHIDOS", "ERROS_PREENCHIDOS", TOKEN], camposAusentes: ["ERROR", USER_TOKEN], camposSuprimidos: ["STATUS", TOKEN], Error: TOKEN });
    expect(seguro).toEqual({ categoria: "NEGOCIO", httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null, tipoStatusFornecedor: "NUMERO", estadoStatusFornecedor: "SUPRIMIDO_SEGREDO",
      indicadores: ["ERROS_PREENCHIDOS"], camposAusentes: ["ERROR"], camposSuprimidos: ["STATUS"] });
    expect(JSON.stringify(seguro)).not.toMatch(/token-sintetico|user-sintetico/);
    expect(Object.isFrozen(seguro?.indicadores)).toBe(true);
  });
});
