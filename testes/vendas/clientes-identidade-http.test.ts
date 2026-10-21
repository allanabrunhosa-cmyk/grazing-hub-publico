import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { consultarIdentidadeClienteCadastro, consultarIdentidadeClientePedido } from "@/lib/vendas/cliente-identidade-http";
const buscar = vi.fn();
const entrada = { clienteId: "ficticio", email: "pessoa@example.invalid", documento: "12345678909", tipo: "PF" as const };
beforeEach(() => { buscar.mockReset(); vi.stubGlobal("fetch", buscar); });
afterEach(() => vi.unstubAllGlobals());
it.each([[consultarIdentidadeClienteCadastro, "CLIENTES"], [consultarIdentidadeClientePedido, "PEDIDOS"]] as const)("consulta em POST sem identificadores na URL no contexto %s", async (consultar, contexto) => {
  buscar.mockResolvedValue(Response.json({ email: true, documento: false, nome: "Não transportar" }));
  const controle = new AbortController();
  expect(await consultar(entrada, controle.signal)).toEqual({ email: true, documento: false });
  expect(buscar).toHaveBeenCalledExactlyOnceWith("/api/vendas/clientes/identidade", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controle.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contexto, ...entrada }) });
});
it.each([401, 403, 413, 503])("não interpreta HTTP%s como cadastro disponível", async status => {
  buscar.mockResolvedValue(Response.json({ erro: "Falha sintética" }, { status }));
  await expect(consultarIdentidadeClientePedido(entrada)).rejects.toThrow("indisponível");
});
it.each([{}, { email: false }, { email: "false", documento: false }, null])("recusa resposta sem flags válidas: %s", async resposta => {
  buscar.mockResolvedValue(Response.json(resposta));
  await expect(consultarIdentidadeClienteCadastro(entrada)).rejects.toThrow("inválida");
});
it("propaga cancelamento para o hook descartar uma consulta antiga", async () => {
  buscar.mockImplementation((_url, opcoes: RequestInit) => new Promise((_resolve, reject) => opcoes.signal?.addEventListener("abort", () => reject(new DOMException("Cancelada", "AbortError")))));
  const controle = new AbortController(), promessa = consultarIdentidadeClientePedido(entrada, controle.signal);
  controle.abort();
  await expect(promessa).rejects.toHaveProperty("name", "AbortError");
});
