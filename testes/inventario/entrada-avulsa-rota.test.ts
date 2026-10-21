import { describe, expect, it } from "vitest";
import { identificadorEntradaNaRota } from "@/lib/inventario/entrada-avulsa-historico";

describe("identificador de entrada na fronteira HTTP", () => {
  it.each(["compra:legado-ficticio", "movimento:legado-ficticio", "registro-ficticio"])("conserva e decodifica uma vez %s", id => {
    expect(identificadorEntradaNaRota(id)).toBe(id);
    expect(identificadorEntradaNaRota(encodeURIComponent(id))).toBe(id);
  });
  it.each(["%", "%253A", "compra%3Aitem%2Foutro", "../outro", "compra:" + "a".repeat(161), "a".repeat(511)])("rejeita formato malformado sem exceção: %s", valor => {
    expect(identificadorEntradaNaRota(valor)).toBeNull();
  });
});
