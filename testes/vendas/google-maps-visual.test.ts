// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type JanelaMapa = { google?: { maps: object }; grazingEntregasMapaPronto?: () => void };
const alvo = window as unknown as JanelaMapa;
const seletorSdk = 'script[src*="maps.googleapis.com/maps/api/js"]';
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => {
  document.querySelectorAll(seletorSdk).forEach(script => script.remove());
  delete alvo.google;
  delete alvo.grazingEntregasMapaPronto;
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("compartilha o SDK entre consumidores e aguarda o callback assíncrono", async () => {
  const { carregarGoogleMapsVisual } = await import("@/components/entregas/google-maps-visual");
  const primeira = carregarGoogleMapsVisual("chave-publica-sintetica");
  const segunda = carregarGoogleMapsVisual("chave-publica-sintetica");
  expect(primeira).toBe(segunda);
  expect(document.querySelectorAll(seletorSdk)).toHaveLength(1);
  const resolvida = vi.fn();
  void primeira.then(resolvida);
  document.querySelector(seletorSdk)!.dispatchEvent(new Event("load"));
  await Promise.resolve();
  expect(resolvida).not.toHaveBeenCalled();
  const mapas = { Map: vi.fn(), Circle: vi.fn(), Polyline: vi.fn(), LatLngBounds: vi.fn() };
  alvo.google = { maps: mapas };
  alvo.grazingEntregasMapaPronto!();
  await expect(primeira).resolves.toBe(mapas);
  expect(alvo.grazingEntregasMapaPronto).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it("reutiliza o SDK disponível sem inserir outro script", async () => {
  const { carregarGoogleMapsVisual } = await import("@/components/entregas/google-maps-visual");
  const mapas = { Map: vi.fn(), Circle: vi.fn(), Polyline: vi.fn(), LatLngBounds: vi.fn() };
  alvo.google = { maps: mapas };
  const consulta = carregarGoogleMapsVisual("chave-publica-sintetica");
  await expect(consulta).resolves.toBe(mapas);
  expect(carregarGoogleMapsVisual("chave-publica-sintetica")).toBe(consulta);
  expect(document.querySelector(seletorSdk)).toBeNull();
});

it("remove o SDK com erro e permite uma nova tentativa", async () => {
  const { carregarGoogleMapsVisual } = await import("@/components/entregas/google-maps-visual");
  const primeira = carregarGoogleMapsVisual("chave-publica-sintetica");
  const falha = expect(primeira).rejects.toThrow("Mapa visual indisponível");
  document.querySelector(seletorSdk)!.dispatchEvent(new Event("error"));
  await falha;
  expect(document.querySelector(seletorSdk)).toBeNull();
  const segunda = carregarGoogleMapsVisual("chave-publica-sintetica");
  expect(segunda).not.toBe(primeira);
  const mapas = { Map: vi.fn() };
  alvo.google = { maps: mapas };
  alvo.grazingEntregasMapaPronto!();
  await expect(segunda).resolves.toBe(mapas);
});

it("encerra a espera em dez segundos sem deixar callback ou script pendente", async () => {
  const { carregarGoogleMapsVisual } = await import("@/components/entregas/google-maps-visual");
  const consulta = carregarGoogleMapsVisual("chave-publica-sintetica");
  const falha = expect(consulta).rejects.toThrow("Mapa visual indisponível");
  await vi.advanceTimersByTimeAsync(10000);
  await falha;
  expect(document.querySelector(seletorSdk)).toBeNull();
  expect(alvo.grazingEntregasMapaPronto).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
