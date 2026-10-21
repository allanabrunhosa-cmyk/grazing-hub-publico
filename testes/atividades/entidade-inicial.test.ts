import { expect, it } from "vitest";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";
it("referência inicial aceita só identificador limitado e ignora parâmetros inválidos", () => {
  expect(entidadeInicial("entidade_sintetica-123")).toBe("entidade_sintetica-123");
  for (const valor of [null, undefined, ["id"], "", "x".repeat(161), "../outro", "id?senha=secreto", "id\n", 12]) expect(entidadeInicial(valor)).toBeUndefined();
});
