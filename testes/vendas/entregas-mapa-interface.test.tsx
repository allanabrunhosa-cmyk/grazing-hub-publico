// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MapaEntrega } from "@/components/entregas/mapa-entrega";
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it("aguarda callback do SDK assíncrono antes de desenhar, sem tratar onload como API pronta",async()=>{
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY","chave-publica-sintetica");
  const mapa=vi.fn(function(){return {fitBounds:vi.fn()};}),linha=vi.fn(function(){return {setMap:vi.fn()};});
  render(<MapaEntrega polyline="??AA"/>);
  const script=document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]')!;
  expect(script.src).toContain("callback=grazingEntregasMapaPronto");script.dispatchEvent(new Event("load"));expect(mapa).not.toHaveBeenCalled();
  const alvo=window as unknown as {google:unknown;grazingEntregasMapaPronto:()=>void};
  alvo.google={maps:{Map:mapa,Polyline:linha,LatLngBounds:class{extend=vi.fn();}}};
  await act(async()=>{alvo.grazingEntregasMapaPronto();});
  expect(mapa).toHaveBeenCalledTimes(1);expect(linha).toHaveBeenCalledTimes(1);expect(screen.queryByText("Mapa visual indisponível.")).toBeNull();
  script.remove();delete (window as unknown as {google?:unknown}).google;
});
