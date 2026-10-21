"use client";

import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import { consultarPorcoesNoCliente } from "@/lib/insumos/consulta-porcoes-cliente";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UnidadeMedida } from "@/generated/prisma/client";
import { CASAS_DECIMAIS_PORCAO, selecionarPorcao, type PorcaoComposicao, type PorcaoInsumoOption } from "@/lib/insumos/porcoes";

type Props = {
  insumoId: string; unidade: UnidadeMedida; referencia?: PorcaoComposicao | null;
  onChange: (porcao: PorcaoComposicao | null) => void;
  ariaLabel: string; disabled?: boolean;
};

/** Porção é um multiplicador livre; descrição e consumo são derivados pelo consumidor. */
export function CampoNumeroPorcoes(props: Props) {
  return <NumeroPorcoes key={`${props.insumoId}:${props.unidade}`} {...props} />;
}

function NumeroPorcoes({ insumoId, unidade, referencia, onChange, ariaLabel, disabled }: Props) {
  const [porcoes, setPorcoes] = useState<PorcaoInsumoOption[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const montado = useRef(false), pendente = useRef(false), concluida = useRef(false);
  const mensagemId = useId();
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const carregar = useCallback(() => {
    if (!insumoId || pendente.current || concluida.current) return;
    pendente.current = true; setCarregando(true); setErro("");
    startTransition(async () => {
      try {
        const resultado = await consultarPorcoesNoCliente(insumoId);
        if (!montado.current) return;
        if ("erro" in resultado) { setErro(resultado.erro); return; }
        setPorcoes(resultado.porcoes.filter(p => p.unidade === unidade));
        concluida.current = true;
      } catch { if (montado.current) setErro("Não foi possível carregar a medida da porção. Tente novamente."); }
      finally { pendente.current = false; if (montado.current) setCarregando(false); }
    });
  }, [insumoId, unidade]);
  const temReferencia = referencia?.unidadeInsumo === unidade;
  useEffect(() => { if (!disabled && !temReferencia) carregar(); }, [carregar, disabled, temReferencia]);
  // Referências de fichas existentes conservam sua base, mesmo após alterações no catálogo.
  const base = referencia?.unidadeInsumo === unidade ? referencia : porcoes[0] ? selecionarPorcao(porcoes[0]) : null;
  return <div className="relative min-w-0">
    <Input value={referencia?.numeroPorcoes.replace(".", ",") ?? ""} onChange={e => {
      if (!e.target.value) { onChange(null); return; }
      if (base) onChange({ ...base, numeroPorcoes: e.target.value });
    }} placeholder="—" aria-label={ariaLabel} aria-describedby={erro ? mensagemId : undefined} aria-busy={carregando}
      title={erro || (base ? "Opcional. Digite o número de porções ou preencha a Qtd. diretamente." : carregando ? "Carregando a medida cadastrada." : "Cadastre a medida de 1 porção na Tabela de Porções ou preencha a Qtd. diretamente.")}
      min="0.000000001" max="999999999.999999999" inputMode="decimal" restricao="decimal" casasDecimais={CASAS_DECIMAIS_PORCAO} maxLength={19}
      disabled={disabled || !insumoId || !base} className={`px-2 tabular-nums ${erro ? "pr-8" : ""}`} />
    {erro && <><span className="sr-only" id={mensagemId} role="alert">{erro}</span><Button type="button" variant="ghost" size="icon-sm" className="absolute right-0 top-0 text-destructive" title={`${erro} Tentar novamente.`} aria-label="Tentar novamente" disabled={disabled || carregando} onClick={carregar}><RotateCw className="size-3" /></Button></>}
  </div>;
}
