import { expect, it } from "vitest";
import { getRedirectUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

it.each([
  ["/vendas/fiscal", "/financeiro/fiscal/grupos"],
  ["/vendas/fiscal/cobertura", "/financeiro/fiscal/cobertura"],
  ["/vendas/fiscal/cobertura?aba=produtos", "/financeiro/fiscal/cobertura?aba=produtos"],
  ["/vendas/fiscal?busca=ficticio&pendentes=1", "/financeiro/fiscal/grupos?busca=ficticio&pendentes=1"],
  ["/vendas/fiscal/grupos", "/financeiro/fiscal/grupos"],
  ["/vendas/fiscal/grupos/ficticio?aba=tributos", "/financeiro/fiscal/grupos/ficticio?aba=tributos"],
  ["/vendas/fiscal/vinculos", "/financeiro/fiscal/vinculos"],
  ["/vendas/fiscal/vinculos/ficticio?busca=exemplo", "/financeiro/fiscal/vinculos/ficticio?busca=exemplo"],
  ["/vendas/fiscal/ficticio", "/financeiro/fiscal/grupos/ficticio"],
  ["/vendas/fiscal/regras-brasilnfe", "/financeiro/fiscal/regras-brasilnfe"],
  ["/vendas/fiscal/regras-brasilnfe/ficticio", "/financeiro/fiscal/regras-brasilnfe/ficticio"],
])("preserva o endereço legado %s sem ciclo", async (origem, destino) => {
  const resposta = await unstable_getResponseFromNextConfig({ url: `http://localhost${origem}`, nextConfig });
  expect(resposta.status).toBe(308);
  expect(getRedirectUrl(resposta)).toBe(`http://localhost${destino}`);
  const destinoFinal = await unstable_getResponseFromNextConfig({ url: `http://localhost${destino}`, nextConfig });
  expect(getRedirectUrl(destinoFinal)).toBeNull();
});

it.each(["/financeiro/fiscal", "/vendas/produtos", "/vendas/fiscalidade"])("não redireciona a rota %s fora dos cadastros legados", async rota => {
  const resposta = await unstable_getResponseFromNextConfig({ url: `http://localhost${rota}`, nextConfig });
  expect(getRedirectUrl(resposta)).toBeNull();
});
