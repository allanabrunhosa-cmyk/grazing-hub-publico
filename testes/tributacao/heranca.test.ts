import { expect, it } from "vitest";
import { herdarParametrosFiscais } from "@/lib/tributacao/heranca";
it("grupo sugere operação sem fabricar identidade ou unidade de mercadorias diferentes", () => {
  const modelo = { ncm: "16010000", origem: "0", cest: "1707800", ean: "4006381333931", unidadeTributavel: "KG", cfop: "5102", pis: "99" };
  const individual = { ncm: "19053100", origem: "2", cfop: "5101", pis: "" };
  const r = herdarParametrosFiscais(modelo, individual);
  expect(r).toEqual({ ncm: "19053100", origem: "2", cfop: "5101", pis: "99" });
  expect(r).not.toHaveProperty("ean"); expect(r).not.toHaveProperty("unidadeTributavel");
  expect(individual.pis).toBe("");
});
