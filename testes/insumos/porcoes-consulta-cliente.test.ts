import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { consultarPorcoesNoCliente } from "@/lib/insumos/consulta-porcoes-cliente";
const consulta = vi.fn();
beforeEach(() => { consulta.mockReset(); vi.stubGlobal("fetch", consulta); });
afterEach(() => vi.unstubAllGlobals());
it("consulta URL estável sem ID de Server Action, preservando ausência de porções", async () => {
  consulta.mockResolvedValue(Response.json({ porcoes: [], podeCadastrar: false }));
  expect(await consultarPorcoesNoCliente("embalagem-ficticia")).toEqual({ porcoes: [], podeCadastrar: false });
  expect(consulta).toHaveBeenCalledWith("/api/insumos/embalagem-ficticia/porcoes", { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
});
it("transporta a precisão decimal como string e codifica o identificador", async () => {
  const porcao = { id: "teste", insumoId: "item/teste", quantidade: "0.123456789", unidade: "KG", nome: "8 fatias", quantidadeMedida: "8", unidadeMedida: "fatias", versao: 1 };
  consulta.mockResolvedValue(Response.json({ porcoes: [porcao], podeCadastrar: true }));
  expect(await consultarPorcoesNoCliente("item/teste")).toMatchObject({ porcoes: [porcao] });
  expect(consulta.mock.calls[0][0]).toBe("/api/insumos/item%2Fteste/porcoes");
});
it.each([401, 403])("não confunde acesso negado (%s) com ingrediente sem porção", async status => {
  consulta.mockResolvedValue(new Response(null, { status }));
  expect(await consultarPorcoesNoCliente("teste")).toHaveProperty("erro");
});
it("sessão redirecionada não tenta ler HTML como catálogo", async () => {
  consulta.mockResolvedValue({ redirected: true, status: 200 });
  expect(await consultarPorcoesNoCliente("teste")).toEqual({ erro: "Sua sessão expirou. Entre novamente." });
});
it.each([new Response("indisponível", { status: 503 }), Response.json({ porcoes: null, podeCadastrar: false })])("rejeita transporte/DTO inválido sem fabricar catálogo vazio", async resposta => {
  consulta.mockResolvedValue(resposta);
  await expect(consultarPorcoesNoCliente("teste")).rejects.toThrow("Resposta de porções inválida.");
});
it("mantém falha de rede explícita para permitir nova tentativa", async () => {
  consulta.mockRejectedValue(new TypeError("offline"));
  await expect(consultarPorcoesNoCliente("teste")).rejects.toThrow("offline");
});
