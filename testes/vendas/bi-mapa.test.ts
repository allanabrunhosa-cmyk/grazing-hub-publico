import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/vendas/entregas", () => ({ consumirChamadaMapasEntrega: vi.fn() }));
import { consultarMapaBi } from "@/lib/vendas/bi-mapa-consultas";
import type { GrupoMapaBi } from "@/lib/vendas/bi-mapa-types";

const grupo = (n = 1): GrupoMapaBi => ({ chave: `Bairro sintético ${n} · Cidade sintética / SP`, consulta: `Bairro sintético ${n}, Cidade sintética - SP, Brasil`, pedidos: n, precisao: "bairro" });
const contexto = { usuarioId: "usuario-sintetico", totalEntregas: 1 };
function retorno(n = 1, extras: Record<string, unknown> = {}) {
  return { status: "OK", results: [{ types: ["neighborhood", "political"], address_components: [
    { long_name: `Bairro sintético ${n}`, types: ["neighborhood"] }, { long_name: "Cidade sintética", types: ["administrative_area_level_2"] },
    { short_name: "SP", types: ["administrative_area_level_1"] }, { short_name: "BR", types: ["country"] },
  ], geometry: { location: { lat: -23.55, lng: -46.63 } }, ...extras }] };
}
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const deps = () => ({ pronta: () => true, chave: "chave-sintetica", consumir: vi.fn(async () => {}), requisitar: vi.fn<typeof fetch>(async () => resposta(retorno())), agora: () => new Date("2026-10-15T12:00:00Z") });
describe("BI: mapa regional transitório", () => {
  it("usa só o grupo, cota compartilhada e precisão aproximada; não retorna dados brutos Google", async () => {
    const d = deps(), r = await consultarMapaBi([grupo()], contexto, d);
    expect(r).toMatchObject({ estado: "pronto", totalEntregas: 1, entregasLocalizadas: 1, gruposConsultados: 1, validoAte: "2026-10-15T12:10:00.000Z", pontos: [{ latitude: -23.55, longitude: -46.63, pedidos: 1, precisao: "bairro", origem: "GOOGLE_MAPS" }] });
    expect(d.consumir).toHaveBeenCalledWith("usuario-sintetico");
    const url = new URL(String(d.requisitar.mock.calls[0][0])); expect(url.searchParams.get("address")).toBe(grupo().consulta);
    expect(d.requisitar.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(JSON.stringify(r)).not.toContain("address_components"); expect(JSON.stringify(r)).not.toContain("chave-sintetica");
  });
  it.each([false, true])("sem grupos/credencial não chama mapas ou contador: %s", semGrupos => {
    const d = deps(); d.pronta = () => false;
    return consultarMapaBi(semGrupos ? [] : [grupo()], contexto, d).then(r => { expect(r.estado).toBe(semGrupos ? "sem-dados" : "indisponivel"); expect(d.requisitar).not.toHaveBeenCalled(); expect(d.consumir).not.toHaveBeenCalled(); });
  });
  it.each([
    { partial_match: true }, { geometry: { location: { lat: 91, lng: -46 } } },
    { types: ["street_address"] }, { address_components: [{ short_name: "US", types: ["country"] }] },
    { address_components: [{ short_name: "BR", types: ["country"] }, { short_name: "RJ", types: ["administrative_area_level_1"] }] },
  ])("não inventa ponto para retorno ambíguo, parcial ou incompatível: %j", async extra => {
    const d = deps(); d.requisitar.mockResolvedValueOnce(resposta(retorno(1, extra)));
    const r = await consultarMapaBi([grupo()], contexto, d); expect(r.pontos).toEqual([]); expect(r.estado).toBe("indisponivel");
  });
  it("consulta CEP completo como componente, sem usar rua ou um CEP arbitrário do prefixo", async () => {
    const d = deps(); d.requisitar.mockResolvedValueOnce(resposta({ status: "OK", results: [{ types: ["postal_code"], address_components: [{ long_name: "12345-678", types: ["postal_code"] }, { short_name: "BR", types: ["country"] }], geometry: { location: { lat: -23, lng: -46 } } }] }));
    const r = await consultarMapaBi([{ chave: "CEP 12345-678", consulta: "CEP 12345-678, Brasil", pedidos: 4, precisao: "cep" }], { ...contexto, totalEntregas: 4 }, d);
    expect(r.pontos[0]).toMatchObject({ pedidos: 4, precisao: "cep" });
    const url = new URL(String(d.requisitar.mock.calls[0][0])); expect(url.searchParams.get("components")).toBe("country:BR|postal_code:12345678"); expect(url.searchParams.has("address")).toBe(false);
  });
  it("recusa CEP diferente e bairro homônimo de outro município", async () => {
    const d = deps(); d.requisitar.mockResolvedValueOnce(resposta(retorno(1, { address_components: [{ long_name: "Bairro sintético 1", types: ["neighborhood"] }, { long_name: "Outra cidade", types: ["administrative_area_level_2"] }, { short_name: "SP", types: ["administrative_area_level_1"] }, { short_name: "BR", types: ["country"] }] })));
    expect((await consultarMapaBi([grupo()], contexto, d)).pontos).toEqual([]);
    d.requisitar.mockResolvedValueOnce(resposta({ status: "OK", results: [{ types: ["postal_code"], address_components: [{ long_name: "12345-679", types: ["postal_code"] }, { short_name: "BR", types: ["country"] }], geometry: { location: { lat: -23, lng: -46 } } }] }));
    expect((await consultarMapaBi([{ chave: "CEP 12345-678", consulta: "CEP 12345-678, Brasil", pedidos: 1, precisao: "cep" }], contexto, d)).pontos).toEqual([]);
  });
  it("limita dez grupos e duas chamadas simultâneas, preservando a cobertura parcial", async () => {
    const d = deps(); let ativas = 0, maximas = 0;
    d.requisitar.mockImplementation(async url => {
      ativas++; maximas = Math.max(maximas, ativas); await Promise.resolve();
      const numero = Number(new URL(String(url)).searchParams.get("address")?.match(/sintético (\d+)/u)?.[1]); ativas--; return resposta(retorno(numero));
    });
    const r = await consultarMapaBi(Array.from({ length: 12 }, (_, n) => grupo(n + 1)), { ...contexto, totalEntregas: 78 }, d);
    expect(d.requisitar).toHaveBeenCalledTimes(10); expect(maximas).toBeLessThanOrEqual(2); expect(r).toMatchObject({ estado: "parcial", gruposConsultados: 10, totalGrupos: 12, limiteGrupos: 10, entregasLocalizadas: 75 });
  });
  it.each(["REQUEST_DENIED", "OVER_QUERY_LIMIT"])("trata %s sem ativar ou insistir na API", async status => {
    const d = deps(); d.requisitar.mockResolvedValue(resposta({ status }));
    const r = await consultarMapaBi([grupo()], contexto, d); expect(r.estado).toBe("indisponivel"); expect(d.requisitar).toHaveBeenCalledTimes(1);
  });
  it("não envia requisição se a cota compartilhada recusa; retries também consomem cota", async () => {
    const d = deps(); d.consumir.mockRejectedValueOnce(new Error("limite"));
    expect((await consultarMapaBi([grupo()], contexto, d)).estado).toBe("indisponivel"); expect(d.requisitar).not.toHaveBeenCalled();
    d.consumir.mockResolvedValue(undefined); d.requisitar.mockRejectedValueOnce(new Error("rede"));
    expect((await consultarMapaBi([grupo()], contexto, d)).pontos).toHaveLength(1); expect(d.consumir).toHaveBeenCalledTimes(3); expect(d.requisitar).toHaveBeenCalledTimes(2);
  });
});
