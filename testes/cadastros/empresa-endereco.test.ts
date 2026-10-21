import { describe, expect, it } from "vitest";
import { normalizarEnderecoEmpresa } from "@/lib/configuracao-loja-endereco";
const endereco = { cep: "01001000", logradouro: "Rua sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
describe("IBGE do cadastro da empresa", () => {
  it("resolve cidade/UF existentes sem alterar a entrada", () => { const original = { ...endereco }; expect(normalizarEnderecoEmpresa(original)).toMatchObject({ ...endereco, codigoMunicipio: "3550308" }); expect(original).not.toHaveProperty("codigoMunicipio"); });
  it("aceita variação de acento e caixa", () => { expect(normalizarEnderecoEmpresa({ ...endereco, cidade: "sao paulo", uf: "sp" }).codigoMunicipio).toBe("3550308"); });
  it("preserva o código explícito correto", () => { expect(normalizarEnderecoEmpresa({ ...endereco, codigoMunicipio: "3550308" }).codigoMunicipio).toBe("3550308"); });
  it.each(["3304557", "3509502", "355030", 3550308, "<script>"])("não substitui código explícito incompatível (%s)", codigoMunicipio => { expect(() => normalizarEnderecoEmpresa({ ...endereco, codigoMunicipio })).toThrow(); });
  it("mantém ausência quando o município não está comprovado na tabela", () => { expect(normalizarEnderecoEmpresa({ ...endereco, cidade: "Município sintético inexistente" })).not.toHaveProperty("codigoMunicipio"); });
  it("não resolve endereço estrangeiro pela cidade homônima", () => { expect(normalizarEnderecoEmpresa({ ...endereco, pais: "Argentina", uf: "SP" })).not.toHaveProperty("codigoMunicipio"); });
});
