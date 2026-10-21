import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GoogleRotas } from "@/lib/vendas/entregas-mapas";
import { textoEndereco } from "@/lib/vendas/entregas-dominio";

const destino = { cep: "01234567", logradouro: "Rua Fictícia", numero: "1", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const origem = "Rua de origem fictícia, 12, São Paulo - SP, Brasil";
const resposta = (valor: unknown, status = 200) => new Response(JSON.stringify(valor), { status });
const rota = { routes: [{ distanceMeters: 1501, duration: "123s", polyline: { encodedPolyline: "teste" } }] };

describe("Google: cálculo direto pelo endereço, sem chamadas reais", () => {
  it.each([["MOTO", "TWO_WHEELER"], ["CARRO", "DRIVE"]] as const)("calcula %s em uma chamada, sem validação ou confirmação intermediária", async (veiculo, perfil) => {
    const requisitar = vi.fn<typeof fetch>().mockResolvedValue(resposta(rota));
    const consumir = vi.fn(async () => {});
    const resultado = await new GoogleRotas("chave-sintetica", requisitar).calcular(origem, destino, veiculo, consumir);
    expect(resultado).toMatchObject({ distanciaMetros: 1501, duracaoSegundos: 123, origem: { descricao: origem }, destino: { descricao: textoEndereco(destino) } });
    expect(requisitar).toHaveBeenCalledTimes(1);
    expect(consumir).toHaveBeenCalledTimes(1);
    expect(requisitar.mock.calls[0][0]).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(requisitar.mock.calls[0][1]?.cache).toBe("no-store");
    expect(JSON.parse(String(requisitar.mock.calls[0][1]?.body))).toEqual({
      origin: { address: origem }, destination: { address: textoEndereco(destino) }, travelMode: perfil,
      routingPreference: "TRAFFIC_UNAWARE", computeAlternativeRoutes: false, languageCode: "pt-BR", regionCode: "BR", units: "METRIC",
    });
  });
  it("utiliza a rota retornada mesmo com correspondência parcial, sem criar candidatos para confirmação", async () => {
    const requisitar = vi.fn<typeof fetch>().mockResolvedValue(resposta({ ...rota, geocodingResults: {
      origin: { placeId: "origem-sintetica", partialMatch: true }, destination: { placeId: "destino-sintetico", partialMatch: true },
    } }));
    const resultado = await new GoogleRotas("sintetica", requisitar).calcular(origem, destino, "CARRO", async () => {});
    expect(resultado.destino.placeId).toBe("destino-sintetico");
    expect(resultado.distanciaMetros).toBe(1501);
    expect(requisitar).toHaveBeenCalledTimes(1);
  });
  it("ausência de rota e respostas inválidas nunca viram distância zero", async () => {
    for (const valor of [{ routes: [] }, { routes: [{ duration: "1s" }] }, { routes: [{ distanceMeters: -1, duration: "1s" }] }]) {
      const requisitar = vi.fn<typeof fetch>().mockResolvedValue(resposta(valor));
      await expect(new GoogleRotas("s", requisitar).calcular(origem, destino, "CARRO", async () => {})).rejects.toHaveProperty("estado", valor.routes.length ? "PROVEDOR_INDISPONIVEL" : "SEM_ROTA");
    }
  });
  it("limita tentativas transitórias e não repete falha permanente", async () => {
    const requisitar = vi.fn<typeof fetch>().mockResolvedValue(resposta({}, 503));
    await expect(new GoogleRotas("s", requisitar).calcular(origem, destino, "CARRO", async () => {})).rejects.toHaveProperty("estado", "PROVEDOR_INDISPONIVEL");
    expect(requisitar).toHaveBeenCalledTimes(2);
    const negado = vi.fn<typeof fetch>().mockResolvedValue(resposta({}, 403));
    await expect(new GoogleRotas("s", negado).calcular(origem, destino, "CARRO", async () => {})).rejects.toHaveProperty("estado", "PROVEDOR_INDISPONIVEL");
    expect(negado).toHaveBeenCalledTimes(1);
  });
  it("interrompe por timeout com apenas duas tentativas", async () => {
    const requisitar = vi.fn<typeof fetch>().mockImplementation((_url, opcoes) => new Promise((_resolve, reject) => opcoes?.signal?.addEventListener("abort", () => reject(new Error("abort")))));
    await expect(new GoogleRotas("s", requisitar, 10).calcular(origem, destino, "CARRO", async () => {})).rejects.toHaveProperty("estado", "PROVEDOR_INDISPONIVEL");
    expect(requisitar).toHaveBeenCalledTimes(2);
  });
  it("credencial ausente não chama a rede", async () => {
    const requisitar = vi.fn<typeof fetch>();
    await expect(new GoogleRotas("", requisitar).calcular(origem, destino, "CARRO", async () => {})).rejects.toHaveProperty("estado", "PROVEDOR_INDISPONIVEL");
    expect(requisitar).not.toHaveBeenCalled();
  });
});