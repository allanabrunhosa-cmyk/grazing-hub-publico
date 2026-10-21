"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { carregarGoogleMapsVisual } from "@/components/entregas/google-maps-visual";
import type { ResultadoMapaBi } from "@/lib/vendas/bi-mapa-types";
import s from "./bi-vendas.module.css";

/** Coordenadas agregadas e transitórias. Não representa endereços individuais. */
export function MapaCalorEntregas({ parametros, chave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY }: { parametros: string; chave?: string }) {
  const elemento = useRef<HTMLDivElement>(null);
  const requisicao = useRef<AbortController | null>(null);
  const [resultado, definirResultado] = useState<ResultadoMapaBi | null>(null);
  const [carregando, definirCarregando] = useState(false);
  const [mensagem, definirMensagem] = useState("");
  const [erroVisual, definirErroVisual] = useState("");

  useEffect(() => () => requisicao.current?.abort(), []);
  useEffect(() => {
    if (!resultado) return;
    const restante = Date.parse(resultado.validoAte) - Date.now();
    const timer = setTimeout(() => { definirResultado(null); definirMensagem("O mapa expirou. Carregue novamente para consultar a seleção atual."); }, Math.max(0, Math.min(restante, 600000)));
    return () => clearTimeout(timer);
  }, [resultado]);
  useEffect(() => {
    if (!resultado?.pontos.length || !chave) return;
    let cancelado = false;
    const camadas: { setMap: (mapa: null) => void }[] = [];
    void carregarGoogleMapsVisual(chave).then(g => {
      if (cancelado || !elemento.current) return;
      const mapa = new g.Map(elemento.current, { zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "cooperative" });
      const limites = new g.LatLngBounds();
      const tinta = document.createElement("canvas"); tinta.width = 1; tinta.height = 1;
      const pincel = tinta.getContext("2d")!;
      pincel.fillStyle = getComputedStyle(elemento.current).getPropertyValue("--primary").trim(); pincel.fillRect(0, 0, 1, 1);
      const canais = pincel.getImageData(0, 0, 1, 1).data;
      // A API recebe hexadecimal; a cor continua vindo do token oficial.
      const cor = `#${Array.from(canais).slice(0, 3).map(canal => canal.toString(16).padStart(2, "0")).join("")}`;
      const maxima = Math.max(...resultado.pontos.map(p => p.pedidos), 1);
      for (const ponto of resultado.pontos) {
        const centro = { lat: ponto.latitude, lng: ponto.longitude };
        const raioBase = ponto.precisao === "cep" ? 150 : 300;
        const raioMaximo = raioBase * 6;
        const latitude = raioMaximo / 111000;
        const longitude = latitude / Math.max(.1, Math.cos(ponto.latitude * Math.PI / 180));
        // Os limites incluem a área desenhada, mesmo quando há somente um grupo.
        limites.extend({ lat: Math.max(-90, centro.lat - latitude), lng: centro.lng - longitude });
        limites.extend({ lat: Math.min(90, centro.lat + latitude), lng: centro.lng + longitude });
        // Camadas concêntricas aproximam uma densidade gaussiana, sem serviço extra.
        for (let camada = 6; camada >= 1; camada--) {
          const intensidade = .018 + .045 * Math.sqrt(ponto.pedidos / maxima);
          camadas.push(new g.Circle({ map: mapa, center: centro, radius: raioBase * camada, fillColor: cor, fillOpacity: intensidade, strokeOpacity: 0, clickable: false }));
        }
      }
      mapa.fitBounds(limites, 24);
    }).catch(() => { if (!cancelado) definirErroVisual("O mapa visual está indisponível. Consulte a distribuição regional abaixo ou tente novamente."); });
    return () => { cancelado = true; camadas.forEach(camada => camada.setMap(null)); };
  }, [resultado, chave]);

  async function carregar() {
    requisicao.current?.abort();
    const controlador = new AbortController(); requisicao.current = controlador;
    definirCarregando(true); definirMensagem(""); definirErroVisual("");
    try {
      const resposta = await fetch(`/api/vendas/bi/mapa?${parametros}`, { method: "POST", signal: controlador.signal, cache: "no-store", credentials: "same-origin" });
      const dados = await resposta.json() as ResultadoMapaBi | { erro: string };
      if (controlador.signal.aborted) return;
      if (!resposta.ok || "erro" in dados) throw new Error("erro" in dados ? dados.erro : "Não foi possível consultar o mapa.");
      definirResultado(dados);
    } catch (erro) {
      if (!controlador.signal.aborted) definirMensagem(erro instanceof Error ? erro.message : "Não foi possível consultar o mapa. Tente novamente.");
    } finally { if (!controlador.signal.aborted) definirCarregando(false); }
  }

  return <div className={s.mapaConteudo} aria-busy={carregando}>
    <p className={s.legendaRegioes}>Mapa de calor por bairro ou CEP. As posições são aproximadas e não representam destinos exatos.</p>
    {!chave ? <p className={s.legendaRegioes} role="status">Mapa visual indisponível: a chave de navegador autorizada não está configurada.</p> : <>
      <Button formato="campo" variant="outline" size="sm" disabled={carregando} onClick={() => void carregar()}><MapPin aria-hidden="true" />{carregando ? "Carregando mapa…" : resultado ? "Atualizar mapa de calor" : "Carregar mapa de calor"}</Button>
      {resultado && <>
        {resultado.pontos.length > 0 && !erroVisual && <><div ref={elemento} className={s.mapa} role="img" aria-label="Concentração aproximada de entregas por bairro ou CEP. Consulte os valores na distribuição regional." /><div className={s.mapaEscala} aria-hidden="true"><span>Menor concentração</span><i /><span>Maior concentração</span></div></>}
        <p className={s.legendaRegioes} role="status">{resultado.entregasLocalizadas}/{resultado.totalEntregas} entregas representadas · {resultado.gruposConsultados}/{resultado.totalGrupos} grupos consultados. {resultado.estado === "parcial" && "Cobertura parcial. "}{resultado.estado === "sem-dados" && "Nenhuma localização disponível. "}Validade de até dez minutos.</p>
        {resultado.avisos.map(aviso => <p className={s.legendaRegioes} key={aviso}>{aviso}</p>)}
      </>}
      {(mensagem || erroVisual) && <p role="status" className={s.legendaRegioes}>{mensagem || erroVisual}</p>}
    </>}
  </div>;
}
