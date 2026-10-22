import { expect, it } from "vitest";
import { argumentosSimulacaoFiscal, compararFontesFiscais } from "../../scripts/fiscal-unificado-simular.mjs";
it("simulação não oferece aplicação e rejeita schema/data inválidos", () => {
  expect(argumentosSimulacaoFiscal([]).schema).toBe("public");
  for (const arg of ["--aplicar", "--schema=public;DROP", "--dia=2026-02-31"]) expect(() => argumentosSimulacaoFiscal([arg])).toThrow();
});
it("expõe divergências sem escolher NCM nem parâmetros e preserva as fontes", () => {
  const dados = { produtos: [{ id: "p-ficticio", nome: "Produto fictício", grupoFiscalId: "grupo-usuario", fiscal: { ncm: "19059090" } }], grupos: [{ id: "grupo-usuario", nome: "Grupo do usuário" }], versoes: [{ id: "v-ficticia", tipo: "CLASSIFICACAO", chave: "p-ficticio", versao: 1, status: "ATIVO", vigenciaInicio: "2026-01-01", dados: { grupo: "GF05", ncm: "08061000", origem: "0", unidade: "UN" } }] };
  const antes = structuredClone(dados), r = compararFontesFiscais(dados, "2026-10-21");
  expect(r[0]).toMatchObject({ grupoCadastro: "Grupo do usuário", grupoMotor: "GF05", diferencas: [{ campo: "ncm", cadastrado: "19059090", vigente: "08061000" }] });
  expect(dados).toEqual(antes);
});
