"use client";
import { useEffect, useRef, useState } from "react";
import { carregarGoogleMapsVisual, type PontoGoogleVisual as Ponto } from "./google-maps-visual";
function decodificar(s: string): Ponto[] { const pontos: Ponto[] = []; let i = 0, lat = 0, lng = 0; const valor = () => { let n = 0, shift = 0, b; do { if (i >= s.length || shift > 30) throw new Error(); b = s.charCodeAt(i++) - 63; n |= (b & 31) << shift; shift += 5; } while (b >= 32); return n & 1 ? ~(n >> 1) : n >> 1; }; while (i < s.length) { lat += valor(); lng += valor(); pontos.push({lat:lat/1e5,lng:lng/1e5}); } return pontos; }
export function MapaEntrega({ polyline }: { polyline: string }) {
  const ref = useRef<HTMLDivElement>(null), [erro,setErro] = useState(false), chave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  useEffect(() => { if (!chave || !polyline) return; let cancelado = false, linha: { setMap: (m: unknown) => void } | undefined;
    void carregarGoogleMapsVisual(chave).then(g => { if (cancelado || !ref.current) return; const mapa = new g.Map(ref.current,{zoom:12,mapTypeControl:false,streetViewControl:false}); const pontos = decodificar(polyline), limites = new g.LatLngBounds(); pontos.forEach(p => limites.extend(p)); linha = new g.Polyline({path:pontos,map:mapa}); mapa.fitBounds(limites); }).catch(() => { if (!cancelado) setErro(true); });
    return () => { cancelado = true; linha?.setMap(null); };
  },[chave,polyline]);
  if (!chave) return <p className="text-xs text-muted-foreground">Mapa visual pendente de chave de navegador restrita. O cálculo de rota usa a integração privada do servidor.</p>;
  return erro ? <p role="status" className="text-sm text-muted-foreground">Mapa visual indisponível.</p> : <div ref={ref} className="h-80 w-full rounded-[var(--ds-cartao-raio)] border" role="img" aria-label="Percurso de ida calculado por Google Maps" />;
}
