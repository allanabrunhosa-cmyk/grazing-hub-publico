"use client";

import { useEffect, useRef, useState } from "react";
import { DemonstracaoPadrao } from "./demonstracao-padrao";
import { declaracoesCssTema } from "@/lib/design-system/gerar-css";
import { VALORES_FABRICA } from "@/lib/design-system/registro";
import { PADROES_DESIGN } from "@/lib/design-system/grupos";
import { resolverTema } from "@/lib/design-system/resolver-tema";
import { configuracaoPreviaValida, type ConfiguracaoLaboratorio } from "@/lib/design-system/previa";

export function LaboratorioDesign() {
  const conteudo = useRef<HTMLElement>(null);
  const [configuracao, definir] = useState<ConfiguracaoLaboratorio>({ canal: "grazing-design-lab", tipo: "configurar", identidade: "hub", modo: "claro", estado: "normal", padrao: "status-ativo", aplicado: false, reinicio: 0, valores: VALORES_FABRICA });
  useEffect(() => {
    const receber = (evento: MessageEvent<unknown>) => {
      if (evento.origin !== window.location.origin || evento.source !== window.parent || !configuracaoPreviaValida(evento.data)) return;
      definir({ ...evento.data, valores: resolverTema(evento.data.valores) });
    };
    window.addEventListener("message", receber);
    window.parent.postMessage({ canal: "grazing-design-lab", tipo: "pronto" }, window.location.origin);
    return () => window.removeEventListener("message", receber);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", configuracao.modo === "escuro");
    document.body.dataset.identidade = configuracao.identidade;
    for (const { propriedade, valor } of declaracoesCssTema(configuracao.valores)) document.documentElement.style.setProperty(propriedade, valor);
  }, [configuracao]);
  useEffect(() => {
    const elemento = conteudo.current;
    if (!elemento) return;
    const observar = new ResizeObserver(() => window.parent.postMessage({ canal: "grazing-design-lab", tipo: "altura", altura: Math.ceil(elemento.getBoundingClientRect().height) }, window.location.origin));
    observar.observe(elemento);
    return () => observar.disconnect();
  }, []);
  const padrao = PADROES_DESIGN.find(p => p.id === configuracao.padrao)!;
  return <main ref={conteudo} className="bg-background p-3 text-foreground sm:p-4">
    <p className="mb-4 text-xs text-muted-foreground">{configuracao.identidade === "hub" ? "Grazing HUB" : configuracao.identidade === "pedidos" ? "Pedidos" : "Validades"} · {configuracao.modo} · exemplo independente</p>
    <DemonstracaoPadrao key={`${configuracao.padrao}:${configuracao.estado}:${configuracao.aplicado}:${configuracao.reinicio}`} componente={padrao.componente} estado={configuracao.estado} aplicado={configuracao.aplicado} />
  </main>;
}
