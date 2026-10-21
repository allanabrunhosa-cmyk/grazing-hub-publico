import { expect, it } from "vitest";
import { contextoDoHost } from "@/lib/hosts";
import { destinoHubFiscalPedido, origemHubFiscalPedido } from "@/app/(protegido)/vendas/pedidos/fiscal-navegacao";

it.each([
  ["pedidos.grazinghub.com.br", true, "https://grazinghub.com.br"],
  ["pedidos.localhost:3452", false, "http://127.0.0.1:3452"],
  ["pedidos.localhost", false, "http://127.0.0.1"],
  ["127.0.0.1:3452", false, null],
  ["grazinghub.com.br", true, null],
  ["validades.grazinghub.com.br", true, null],
] as const)("origem fiscal usa contexto validado %s sem repetir o host dedicado no destino", (host, producao, esperado) => {
  expect(origemHubFiscalPedido(contextoDoHost(new Headers({ host }), producao))).toBe(esperado);
});
it("host desconhecido, encaminhado divergente e porta inválida não fornecem origem fiscal", () => {
  expect(origemHubFiscalPedido(contextoDoHost(new Headers({ host: "injetado.example" }), false))).toBeNull();
  expect(origemHubFiscalPedido(contextoDoHost(new Headers({ host: "pedidos.localhost:3452", "x-forwarded-host": "injetado.example" }), false))).toBeNull();
  expect(origemHubFiscalPedido(contextoDoHost(new Headers({ host: "pedidos.localhost:65536" }), false))).toBeNull();
  expect(origemHubFiscalPedido(contextoDoHost(new Headers({ host: "pedidos.localhost:0" }), false))).toBeNull();
});
it.each(["/financeiro/fiscal/cobertura?aba=regras", "/configuracoes/integracoes/brasilnfe", "/vendas/clientes"])("atalho %s aponta para HUB confiável e preserva o caminho", caminho => {
  expect(destinoHubFiscalPedido(caminho, "https://grazinghub.com.br")).toBe(`https://grazinghub.com.br${caminho}`);
  expect(destinoHubFiscalPedido(caminho, "http://127.0.0.1:3452")).toBe(`http://127.0.0.1:3452${caminho}`);
  expect(destinoHubFiscalPedido(caminho, "http://localhost:3452")).toBe(`http://localhost:3452${caminho}`);
});
it.each([undefined, "https://injetado.example", "https://grazinghub.com.br.injetado.example", "http://localhost:65536", "http://127.0.0.1:0"])("origem ausente ou não permitida %s não vira redirecionamento externo", origem => {
  expect(destinoHubFiscalPedido("/financeiro/fiscal", origem)).toBe("/financeiro/fiscal");
});
it.each(["https://injetado.example", "//injetado.example", "/\\injetado.example", "/financeiro\n/fiscal", "/financeiro/<script>", `/${"a".repeat(501)}`])("caminho inseguro é rejeitado sem usar origem %s", caminho => {
  expect(destinoHubFiscalPedido(caminho, "https://grazinghub.com.br")).toBeNull();
});
