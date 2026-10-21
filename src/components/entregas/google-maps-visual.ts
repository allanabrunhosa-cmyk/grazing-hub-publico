"use client";

export type PontoGoogleVisual = { lat: number; lng: number };
export type GoogleVisual = {
  Map: new (elemento: HTMLElement, opcoes: object) => {
    fitBounds: (limites: unknown, espaco?: number | { top: number; right: number; bottom: number; left: number }) => void;
  };
  LatLngBounds: new () => { extend: (ponto: PontoGoogleVisual) => void };
  Polyline: new (opcoes: object) => { setMap: (mapa: unknown) => void };
  Circle: new (opcoes: object) => { setMap: (mapa: unknown) => void };
};

let carregamento: Promise<GoogleVisual> | null = null;

export function carregarGoogleMapsVisual(chave: string): Promise<GoogleVisual> {
  const alvo = window as unknown as {
    google?: { maps: GoogleVisual };
    grazingEntregasMapaPronto?: () => void;
  };
  if (!carregamento && alvo.google?.maps.Map) carregamento = Promise.resolve(alvo.google.maps);
  return carregamento ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let concluido = false;
    const concluir = (erro = false) => {
      if (concluido) return;
      concluido = true;
      clearTimeout(timer);
      delete alvo.grazingEntregasMapaPronto;
      if (!erro && alvo.google?.maps.Map) resolve(alvo.google.maps);
      else {
        carregamento = null;
        script.remove();
        reject(new Error("Mapa visual indisponível"));
      }
    };
    const timer = setTimeout(() => concluir(true), 10000);
    alvo.grazingEntregasMapaPronto = () => concluir();
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(chave)}&loading=async&callback=grazingEntregasMapaPronto&language=pt-BR`;
    script.async = true;
    script.onerror = () => concluir(true);
    document.head.appendChild(script);
  });
}
