import { afterEach, expect, it, vi } from "vitest";
import { consultarCnpjVenda } from "@/lib/vendas/cnpj";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
const empresa = { cnpj: "11222333000181", razao_social: "Empresa Sintética Ltda", uf: "SP", cep: "01001000", descricao_tipo_de_logradouro: "RUA", logradouro: "Sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", municipio: "São Paulo", codigo_municipio_ibge: 3550308 };

it("consulta CNPJ formatado sem cache e retorna só os campos usados pelo cadastro", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...empresa, email: "nao-retornar@example.invalid", qsa: [{ nome_socio: "Dado fora do contrato" }] })));
  vi.stubGlobal("fetch", fetch);
  const resposta = await consultarCnpjVenda("11.222.333/0001-81");
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://brasilapi.com.br/api/cnpj/v1/11222333000181", expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
  expect(resposta.cadastro).toEqual({ razaoSocial: "Empresa Sintética Ltda", endereco: { pais: "Brasil", cep: "01001000", logradouro: "RUA Sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } });
  expect(resposta.fonte).toBe("BRASILAPI_CNPJ_V1");
});

it("aproveita razão social e dados postais disponíveis quando o provedor omite parte do endereço", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ cnpj: empresa.cnpj, razao_social: empresa.razao_social, cep: "01001-000", logradouro: "Sintética", uf: null, numero: null, complemento: null }))));
  const resposta = await consultarCnpjVenda(empresa.cnpj);
  expect(resposta.cadastro).toEqual({ razaoSocial: empresa.razao_social, endereco: { pais: "Brasil", cep: "01001000", logradouro: "Sintética", numero: "", complemento: "", bairro: "", cidade: "", uf: "" } });
  expect(resposta).toHaveProperty("aviso", expect.stringMatching(/incompleto/));
  expect(resposta.erro).toBeUndefined();
});

it("não reutiliza CEP/UF inválidos nem código municipal de outro estado no retorno parcial", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...empresa, cep: "indisponível", uf: "XX", codigo_municipio_ibge: 3304557 }))));
  const resposta = await consultarCnpjVenda(empresa.cnpj);
  expect(resposta.cadastro?.endereco).toMatchObject({ cep: "", uf: "" });
  expect(resposta.cadastro?.endereco).not.toHaveProperty("codigoMunicipio");
  expect(resposta).toHaveProperty("aviso", expect.stringMatching(/incompleto/));
});

it.each([null, [], { ...empresa, cnpj: "99999999999999" }, { ...empresa, razao_social: null }])("recusa payload que não comprova a empresa/razão social (%j)", async payload => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
  vi.stubGlobal("fetch", fetch);
  const resposta = await consultarCnpjVenda(empresa.cnpj);
  expect(resposta).toHaveProperty("erro");
  expect(resposta.cadastro).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("trata indisponibilidade de rede sem expor detalhes nem devolver cadastro fictício", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("mensagem interna do provedor")));
  expect(await consultarCnpjVenda(empresa.cnpj)).toEqual({ erro: "Consulta do CNPJ indisponível. Tente novamente." });
});

it.each([403, 429, 500, 502, 503])("recupera HTTP%d pela Minha Receita e registra a fonte real", async status => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("Bloqueio ou indisponibilidade", { status })).mockResolvedValueOnce(new Response(JSON.stringify({ ...empresa, email: "nao-retornar@example.invalid", qsa: [{ nome_socio: "Fora do contrato" }] })));
  vi.stubGlobal("fetch", fetch);
  const resposta = await consultarCnpjVenda("11.222.333/0001-81");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenNthCalledWith(2, "https://minhareceita.org/11222333000181", expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
  expect(resposta).toEqual({ fonte: "MINHA_RECEITA_CNPJ_V1", cadastro: { razaoSocial: empresa.razao_social, endereco: { pais: "Brasil", cep: empresa.cep, logradouro: "RUA Sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } } });
});

it("recupera HTML comHTTP200 sem misturar campos entre as fontes", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("<!DOCTYPE html><title>Bloqueio</title>", { headers: { "Content-Type": "text/html" } })).mockResolvedValueOnce(new Response(JSON.stringify({ ...empresa, numero: null })));
  vi.stubGlobal("fetch", fetch);
  const resposta = await consultarCnpjVenda(empresa.cnpj);
  expect(resposta).toMatchObject({ fonte: "MINHA_RECEITA_CNPJ_V1", cadastro: { endereco: { numero: "" } }, aviso: expect.stringMatching(/incompleto/) });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("recupera falha de conexão sem expor os detalhes internos", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("endereço interno do provedor")).mockResolvedValueOnce(new Response(JSON.stringify(empresa)));
  vi.stubGlobal("fetch", fetch);
  expect(await consultarCnpjVenda(empresa.cnpj)).toMatchObject({ fonte: "MINHA_RECEITA_CNPJ_V1", cadastro: { razaoSocial: empresa.razao_social } });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([400, 401, 404, 422])("encerra HTTP%d sem acionar a fonte alternativa", async status => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("Resposta recusada", { status }));
  vi.stubGlobal("fetch", fetch);
  expect(await consultarCnpjVenda(empresa.cnpj)).toEqual({ erro: status === 404 ? "CNPJ não encontrado. Confira o número." : "Consulta do CNPJ indisponível. Tente novamente." });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("preserva não encontrado quando a fonte alternativa responde404", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("Indisponível", { status: 503 })).mockResolvedValueOnce(new Response("Não encontrado", { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  expect(await consultarCnpjVenda(empresa.cnpj)).toEqual({ erro: "CNPJ não encontrado. Confira o número." });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([null, [], { ...empresa, cnpj: "11444777000161" }, { ...empresa, cnpj: `cnpj:${empresa.cnpj}` }, { ...empresa, razao_social: "" }])("recusa inconsistência JSON também na fonte alternativa (%j)", async payload => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("<!DOCTYPE html>")).mockResolvedValueOnce(new Response(JSON.stringify(payload)));
  vi.stubGlobal("fetch", fetch);
  const resposta = await consultarCnpjVenda(empresa.cnpj);
  expect(resposta).toHaveProperty("erro"); expect(resposta.cadastro).toBeUndefined(); expect(resposta.fonte).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("limita cada fonte a8s e toda a consulta a16s inclusive corpo que nunca termina", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockImplementation(async () => ({ ok: true, json: () => new Promise(() => {}) }));
  vi.stubGlobal("fetch", fetch);
  const inicio = Date.now(), resultado = consultarCnpjVenda(empresa.cnpj);
  await vi.advanceTimersByTimeAsync(7999); expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(8000);
  expect(await resultado).toEqual({ erro: "Consulta do CNPJ indisponível. Tente novamente." });
  expect(Date.now() - inicio).toBe(16000); expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("rejeita CNPJ inválido antes de qualquer requisição", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await consultarCnpjVenda("00000000000000")).toHaveProperty("erro");
  expect(await consultarCnpjVenda(`https://outro.invalid/${empresa.cnpj}`)).toHaveProperty("erro");
  expect(fetch).not.toHaveBeenCalled();
});
