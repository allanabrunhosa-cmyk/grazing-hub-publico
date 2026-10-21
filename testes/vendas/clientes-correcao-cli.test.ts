import { describe, expect, it, vi } from "vitest";

// Este contrato não carrega clientes de banco nem executa a manutenção.
vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));
vi.mock("../../src/lib/vendas/historico-dominio", () => ({}));
vi.mock("../../src/lib/vendas/historico-complemento", () => ({}));
vi.mock("../../src/lib/vendas/clientes-correcao-dominio", () => ({}));
vi.mock("../../src/lib/vendas/clientes-correcao", () => ({}));
vi.mock("../../scripts/clientes-historicos-arquivos", () => ({}));
import { argumentosCorrecao } from "../../scripts/clientes-historicos-corrigir";

const argumentosCompletos = () => [
  "--modo=previa",
  "--pacote=/privado/pacote.json",
  "--fonte=/privado/fonte.xlsx",
  "--complemento=/privado/complemento.json",
  "--manifesto=/privado/manifesto.json",
  "--inventario=/privado/inventario.json",
  "--provas=/privado/provas",
  "--guardas=/privado/guardas.json",
  `--guardas-sha256=${"a".repeat(64)}`,
  "--usuario-id=admin-sintetico",
  "--sessao-versao=0",
  "--lote=correcao-sintetica-2026",
  "--previa=/privado/previa.json",
  "--verificacoes=/privado/verificacoes.json",
  `--revisao=${"b".repeat(40)}`,
  "--publicacao=/privado/publicacao.json",
  "--saida=/privado/saida",
];

describe("argumentos da CLI de correção histórica", () => {
  it.each(["previa", "aplicar", "previa-reversao", "reverter"])("aceita o conjunto completo no modo %s, incluindo guardas-sha256", modo => {
    const valores = argumentosCompletos();
    valores[0] = `--modo=${modo}`;
    const resultado = argumentosCorrecao(valores);
    expect(resultado).toMatchObject({ modo, lote: "correcao-sintetica-2026", usuario: "admin-sintetico", versao: 0 });
    expect([...resultado.args]).toEqual(valores.map(valor => {
      const separador = valor.indexOf("=");
      return [valor.slice(2, separador), valor.slice(separador + 1)];
    }));
    expect(resultado.obrigatorio("guardas-sha256")).toBe("a".repeat(64));
  });

  it.each(["extra", "guardas-sha257", "1modo", "-modo", "MODO", "modo_2"])("recusa a flag não permitida %s", nome => {
    expect(() => argumentosCorrecao([...argumentosCompletos(), `--${nome}=valor`])).toThrow("CORRECAO_CLI_ARGUMENTOS_INVALIDOS");
  });

  it.each(["--modo=aplicar", `--guardas-sha256=${"c".repeat(64)}`, `--guardas-sha256=${"a".repeat(64)}`])("recusa argumento duplicado %s", extra => {
    expect(() => argumentosCorrecao([...argumentosCompletos(), extra])).toThrow("CORRECAO_CLI_ARGUMENTOS_INVALIDOS");
  });

  it.each(["--guardas-sha256=", "--guardas-sha256", "guardas-sha256=valor"])("recusa argumento incompleto %s", extra => {
    const valores = argumentosCompletos().filter(valor => !valor.startsWith("--guardas-sha256="));
    expect(() => argumentosCorrecao([...valores, extra])).toThrow("CORRECAO_CLI_ARGUMENTOS_INVALIDOS");
  });

  it("preserva o valor inteiro depois do primeiro sinal de igualdade", () => {
    const valores = argumentosCompletos().map(valor => valor.startsWith("--saida=") ? "--saida=/privado/saida=restrita" : valor);
    expect(argumentosCorrecao(valores).obrigatorio("saida")).toBe("/privado/saida=restrita");
  });

  it("mantém a validação de ausência e de contexto", () => {
    expect(() => argumentosCorrecao(argumentosCompletos().filter(valor => !valor.startsWith("--usuario-id=")))).toThrow("CORRECAO_CLI_ARGUMENTO_AUSENTE");
    expect(() => argumentosCorrecao(argumentosCompletos().map(valor => valor === "--sessao-versao=0" ? "--sessao-versao=invalida" : valor))).toThrow("CORRECAO_CLI_CONTEXTO_INVALIDO");
    expect(() => argumentosCorrecao(argumentosCompletos()).obrigatorio("inexistente")).toThrow("CORRECAO_CLI_ARGUMENTO_AUSENTE");
  });
});
