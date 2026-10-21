"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { disponibilidadeEntrega, rotuloHorarioEntrega, valorHorarioEntrega, type HorariosEntrega } from "@/lib/vendas/horarios-entrega-dominio";

export function HorarioEntregaCampo({ configuracao, data, valor, alterar }: { configuracao?: HorariosEntrega | null; data: string; valor: string; alterar: (v: string) => void }) {
  const id = useId();
  const disponivel = disponibilidadeEntrega(configuracao, data);
  const antigo = valor && !disponivel.horarios.some(h => valorHorarioEntrega(h) === valor);
  // Mantém a opção histórica durante a escolha; removê-la naquele render faz o Select perder a seleção.
  const [preservado, setPreservado] = useState(() => ({ data, valor: antigo ? valor : "" }));
  const horarioPreservado = preservado.data === data ? preservado.valor : antigo ? valor : "";
  if (preservado.data !== data || antigo && preservado.valor !== valor) setPreservado({ data, valor: antigo ? valor : "" });
  const preservarOpcao = horarioPreservado && !disponivel.horarios.some(h => valorHorarioEntrega(h) === horarioPreservado);
  const opcoes = [...disponivel.horarios.map(h => ({ value: valorHorarioEntrega(h), label: rotuloHorarioEntrega(h) })), ...(preservarOpcao ? [{ value: horarioPreservado, label: `${horarioPreservado} · Horário anteriormente informado` }] : [])];
  return <div className="grid min-w-0 gap-1.5"><Label className="leading-5" htmlFor={id}>Horário de entrega</Label>
    {disponivel.configurado ? <Select items={opcoes} value={valor || null} onValueChange={v => alterar(v ?? "")} disabled={!data || disponivel.fechado}>
      <SelectTrigger id={id} className="w-full min-w-0" aria-describedby={`${id}-ajuda`}><SelectValue placeholder={data ? "Selecione um horário" : "Escolha a data primeiro"} /></SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>{opcoes.map(o => <SelectItem key={o.value} value={o.value} disabled={Boolean(preservarOpcao && o.value === horarioPreservado)} quebrarTexto>{o.label}</SelectItem>)}</SelectContent>
    </Select> : <Input id={id} value={valor} maxLength={100} placeholder="Ex.: 14:00–16:00 ou manhã" onChange={e => alterar(e.target.value)} />}
    {disponivel.configurado && <p id={`${id}-ajuda`} className="text-xs text-muted-foreground" role="status">{!data ? "Selecione a data para consultar os horários." : disponivel.fechado ? "Sem entregas nesta data. Escolha outra data." : antigo ? "Horário preservado do pedido. Para mudar a agenda, selecione uma opção disponível." : "Horários disponíveis para a data escolhida."}</p>}
  </div>;
}
