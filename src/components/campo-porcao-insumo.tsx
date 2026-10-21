"use client";

import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import { consultarPorcoesNoCliente } from "@/lib/insumos/consulta-porcoes-cliente";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import type { UnidadeMedida } from "@/generated/prisma/client";
import { MAXIMO_NOME_PORCAO, type PorcaoInsumoOption } from "@/lib/insumos/porcoes";
import { unidadeMedidaAbreviada } from "@/lib/labels";

type Props = {
  insumoId: string; unidade: UnidadeMedida; value: string;
  onChange: (nome: string) => void; onSelecionar: (porcao: PorcaoInsumoOption) => void;
  descricao?: string; ariaLabel: string; disabled?: boolean; carregarAoMontar?: boolean;
};
const SEM_PORCAO = "Sem porção";

/** Seleção do catálogo; novos cadastros pertencem exclusivamente à Tabela de Porções. */
export function CampoPorcaoInsumo(props: Props) {
  return <CampoPorcao key={`${props.insumoId}:${props.unidade}`} {...props} />;
}

function CampoPorcao({ insumoId, unidade, value, onChange, onSelecionar, ariaLabel, descricao, disabled, carregarAoMontar }: Props) {
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
      } catch { if (montado.current) setErro("Não foi possível carregar as porções. Tente novamente."); }
      finally { pendente.current = false; if (montado.current) setCarregando(false); }
    });
  }, [insumoId, unidade]);
  useEffect(() => { if (carregarAoMontar) carregar(); }, [carregar, carregarAoMontar]);

  return <div className="min-w-0 space-y-1">
    <Combobox items={[SEM_PORCAO, ...porcoes.map(p => p.nome)]} value={value || null} itemToStringLabel={nome => nome === value && descricao ? descricao : nome}
      disabled={disabled || !insumoId} onOpenChange={aberto => { if (aberto) carregar(); }}
      onValueChange={(nome, detalhes) => {
        if (!nome || detalhes.reason === "escape-key") return;
        if (nome === SEM_PORCAO) { onChange(""); return; }
        const porcao = porcoes.find(p => p.nome === nome);
        if (porcao) onSelecionar(porcao);
      }}>
      <ComboboxInputGroup><ComboboxInput aria-label={ariaLabel} aria-describedby={erro ? mensagemId : undefined} aria-busy={carregando} maxLength={MAXIMO_NOME_PORCAO} placeholder="Escolha a descrição" onFocus={carregar} /></ComboboxInputGroup>
      <ComboboxContent emptyLabel={carregando ? "Carregando porções..." : erro ? "Porções indisponíveis." : "Cadastre as medidas na Tabela de Porções."}>
        {(nome: string) => {
          const porcao = porcoes.find(p => p.nome === nome);
          return <ComboboxItem key={porcao?.id ?? SEM_PORCAO} value={nome}><span className="min-w-0 flex-1 break-words">{nome}</span>{porcao && <span className="shrink-0 text-xs text-muted-foreground">{porcao.quantidade.replace(".", ",")} {unidadeMedidaAbreviada[porcao.unidade]}</span>}</ComboboxItem>;
        }}
      </ComboboxContent>
    </Combobox>
    {erro && <div className="text-xs text-destructive" id={mensagemId} role="alert">{erro}<Button type="button" variant="link" size="sm" disabled={disabled || carregando} onClick={carregar}>Tentar novamente</Button></div>}
  </div>;
}
