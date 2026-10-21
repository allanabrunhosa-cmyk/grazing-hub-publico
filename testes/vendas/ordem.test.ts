import { expect, it } from "vitest";
import { conferirOrdem, validarOrdem } from "@/lib/vendas/ordem";
it("ordenação exige identidades únicas e versões inteiras", () => {
  expect(() => validarOrdem(["id"])).toThrow();
  expect(() => validarOrdem([{ id: "a", versao: 1 }, { id: "a", versao: 1 }])).toThrow("repetidos");
  expect(() => validarOrdem([{ id: "a", versao: 1.5 }])).toThrow();
  expect(validarOrdem([{ id: "a", versao: 1 }])).toEqual([{ id: "a", versao: 1 }]);
});
it("conferência aceita outra ordem mas rejeita lista incompleta ou versão antiga", () => {
  const atuais = [{ id: "a", versao: 2 }, { id: "b", versao: 3 }];
  expect(() => conferirOrdem([...atuais].reverse(), atuais)).not.toThrow();
  expect(() => conferirOrdem([{ id: "a", versao: 1 }, atuais[1]], atuais)).toThrow("outra tela");
  expect(() => conferirOrdem([atuais[0]], atuais)).toThrow();
});
