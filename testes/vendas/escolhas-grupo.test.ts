import { expect, it } from "vitest";
import { limiteQuantidadeEscolha } from "@/lib/vendas/escolhas-grupo";
import { simularConfiguracao } from "@/lib/vendas/dominio";

const opcoes = [{ id: "damasco", nome: "Damasco", preco: "0", ativo: true }, { id: "tamara", nome: "Tâmara", preco: "0", ativo: true }];
it("uma escolha esgota o grupo inteiro com máximo um; remover devolve a vaga", () => {
  expect(limiteQuantidadeEscolha(opcoes, { damasco: 1 }, "tamara", 1, false)).toBe(0);
  expect(limiteQuantidadeEscolha(opcoes, { damasco: 0 }, "tamara", 1, false)).toBe(1);
  expect(limiteQuantidadeEscolha(opcoes, { damasco: 1 }, "damasco", 1, false)).toBe(1);
});
it("repetir continua consumindo o saldo do grupo; sem repetição cada opção limita a um", () => {
  expect(limiteQuantidadeEscolha(opcoes, { damasco: 2 }, "tamara", 3, true)).toBe(1);
  expect(limiteQuantidadeEscolha(opcoes, {}, "damasco", 3, false)).toBe(1);
  expect(limiteQuantidadeEscolha(opcoes, {}, "damasco", null, true)).toBe(1000);
});
it("o domínio rejeita a soma acima do máximo e a repetição proibida", () => {
  const grupo = { id: "antepasto", nome: "Antepasto", tipo: "COMPOSICAO", ativo: true, minimo: 1, maximo: 1, repetir: false, opcoes, vinculo: { grupoId: "antepasto", usarPadrao: true, minimo: 0, maximo: null } };
  expect(simularConfiguracao("10", [grupo], { damasco: 1 }).valido).toBe(true);
  expect(simularConfiguracao("10", [grupo], { damasco: 1, tamara: 1 }).valido).toBe(false);
  expect(simularConfiguracao("10", [{ ...grupo, maximo: 3 }], { damasco: 2 }).erros).toContain("Antepasto: escolha cada opção no máximo uma vez.");
});
