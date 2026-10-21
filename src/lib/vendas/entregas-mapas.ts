import "server-only";
import type { EnderecoEntrega } from "./entregas-dominio";
import { textoEndereco } from "./entregas-dominio";
export type LocalReconhecido = { placeId: string; descricao: string; precisao: string };
export type RotaEntrega = { provedor: "GOOGLE_MAPS"; distanciaMetros: number; duracaoSegundos: number; origem: LocalReconhecido; destino: LocalReconhecido; polyline: string };
export class FalhaMapas extends Error {
  constructor(public estado: "PROVEDOR_INDISPONIVEL" | "SEM_ROTA" | "ENDERECO_PENDENTE") { super(estado); }
}
export interface ProvedorRotas { calcular(origem: string, destino: EnderecoEntrega, veiculo: "CARRO" | "MOTO", consumir: () => Promise<void>): Promise<RotaEntrega> }
export function integracaoMapasPronta() { return !!process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_ENTREGAS_ATIVADO === "1"; }
/** Nunca registra URL, payload, endereço ou resposta do provedor em logs. Sem cache de conteúdo. */
export class GoogleRotas implements ProvedorRotas {
  constructor(private chave = process.env.GOOGLE_MAPS_API_KEY ?? "", private requisitar: typeof fetch = fetch, private timeoutMs = 6000) {}
  private async request(url: string, consumir: () => Promise<void>, init: RequestInit = {}) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      await consumir();
      const abortar = new AbortController(), timer = setTimeout(() => abortar.abort(), this.timeoutMs);
      try {
        const r = await this.requisitar(url, { ...init, cache: "no-store", signal: abortar.signal });
        if ((r.status === 429 || r.status >= 500) && tentativa === 0) continue;
        if (!r.ok) throw new FalhaMapas("PROVEDOR_INDISPONIVEL");
        return await r.json() as Record<string, unknown>;
      } catch (erro) { if (erro instanceof FalhaMapas || tentativa === 1) throw new FalhaMapas("PROVEDOR_INDISPONIVEL"); }
      finally { clearTimeout(timer); }
    }
    throw new FalhaMapas("PROVEDOR_INDISPONIVEL");
  }
  async calcular(origem: string, destino: EnderecoEntrega, veiculo: "CARRO" | "MOTO", consumir: () => Promise<void>): Promise<RotaEntrega> {
    if (!this.chave) throw new FalhaMapas("PROVEDOR_INDISPONIVEL");
    const enderecoDestino = textoEndereco(destino);
    // Routes resolve os endereços na própria chamada; não há desafio de confirmação de localização.
    const r = await this.request("https://routes.googleapis.com/directions/v2:computeRoutes", consumir, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.chave, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,geocodingResults.origin.placeId,geocodingResults.destination.placeId" }, body: JSON.stringify({ origin: { address: origem }, destination: { address: enderecoDestino }, travelMode: veiculo === "MOTO" ? "TWO_WHEELER" : "DRIVE", routingPreference: "TRAFFIC_UNAWARE", computeAlternativeRoutes: false, languageCode: "pt-BR", regionCode: "BR", units: "METRIC" }) });
    if (!Array.isArray(r.routes) || !r.routes.length) throw new FalhaMapas("SEM_ROTA");
    const rota = r.routes[0] as { distanceMeters: number; duration: string; polyline?: { encodedPolyline?: string } };
    const segundos = /^\d+(?:\.\d+)?s$/.test(rota.duration) ? Number(rota.duration.slice(0, -1)) : NaN;
    if (!Number.isSafeInteger(rota.distanceMeters) || rota.distanceMeters < 0 || !Number.isFinite(segundos) || segundos < 0) throw new FalhaMapas("PROVEDOR_INDISPONIVEL");
    const locais = r.geocodingResults as { origin?: { placeId?: string }; destination?: { placeId?: string } } | undefined;
    return { provedor: "GOOGLE_MAPS", distanciaMetros: rota.distanceMeters, duracaoSegundos: segundos,
      origem: { placeId: locais?.origin?.placeId ?? "", descricao: origem, precisao: "ENDERECO_INFORMADO" },
      destino: { placeId: locais?.destination?.placeId ?? "", descricao: enderecoDestino, precisao: "ENDERECO_INFORMADO" }, polyline: rota.polyline?.encodedPolyline ?? "" };
  }
}
