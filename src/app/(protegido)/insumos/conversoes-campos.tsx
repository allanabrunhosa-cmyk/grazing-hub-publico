"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { UnidadeMedida } from "@/generated/prisma/browser";
import { unidadeMedidaLabels, unidadeMedidaAbreviada } from "@/lib/labels";
import type { ConversaoInsumo } from "@/lib/insumos/conversoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConversoesCampos({ unidadePrincipal, conversoes = [], desabilitado, onChange }: {
  unidadePrincipal: UnidadeMedida;
  conversoes?: ConversaoInsumo[];
  desabilitado: boolean;
  onChange?: (conversoes: ConversaoInsumo[]) => void;
}) {
  const [linhas, definirLinhas] = useState(() => conversoes.map((conversao) => ({ ...conversao, fator: String(conversao.fator).replace(".", ",") })));
  useEffect(() => {
    onChange?.(linhas.map((linha) => ({ unidade: linha.unidade, fator: Number(linha.fator.replace(",", ".")) })));
  }, [linhas, onChange]);
  const disponiveis = Object.values(UnidadeMedida).filter((unidade) => unidade !== unidadePrincipal && !linhas.some((linha) => linha.unidade === unidade));
  return <div className="space-y-3 rounded-lg bg-muted/40 p-3">
    <input type="hidden" name="conversoes" value={JSON.stringify(linhas)} />
    <p className="text-sm font-medium">Fatores de conversão</p>
    <p className="text-xs text-muted-foreground">Informe quanto cada embalagem representa em {unidadeMedidaAbreviada[unidadePrincipal]}. Usado nos pedidos e como referência na contagem.</p>
    <Button type="button" data-dialogo-altera size="sm" variant="outline" disabled={desabilitado || disponiveis.length === 0} onClick={() => definirLinhas((atuais) => [{ unidade: disponiveis[0], fator: "" }, ...atuais])}><Plus className="size-4" />Adicionar conversão</Button>
    {linhas.map((linha, indice) => <div key={indice} className="flex flex-wrap items-center gap-2">
      <span className="text-sm">1</span>
      <Select value={linha.unidade} disabled={desabilitado} onValueChange={(valor) => {
        if (valor) definirLinhas((atuais) => atuais.map((atual, posicao) => posicao === indice ? { ...atual, unidade: valor as UnidadeMedida } : atual));
      }}>
        <SelectTrigger aria-label={`Unidade da conversão ${indice + 1}`} title={unidadeMedidaLabels[linha.unidade]} className="min-w-0 flex-1"><SelectValue>{(valor: string) => unidadeMedidaAbreviada[valor as UnidadeMedida]}</SelectValue></SelectTrigger>
        <SelectContent>{[linha.unidade, ...disponiveis].map((unidade) => <SelectItem key={unidade} value={unidade}>{unidadeMedidaLabels[unidade]}</SelectItem>)}</SelectContent>
      </Select>
      <span>=</span>
      <Input aria-label={`Fator da conversão ${indice + 1}`} inputMode="decimal" placeholder="Ex.: 10" value={linha.fator} required disabled={desabilitado} className="w-24" onChange={(evento) => definirLinhas((atuais) => atuais.map((atual, posicao) => posicao === indice ? { ...atual, fator: evento.target.value } : atual))} />
      <span className="text-sm">{unidadeMedidaAbreviada[unidadePrincipal]}</span>
      <Button type="button" data-dialogo-altera variant="ghost" size="icon-sm" aria-label={`Remover conversão ${indice + 1}`} disabled={desabilitado} onClick={() => definirLinhas((atuais) => atuais.filter((_, posicao) => posicao !== indice))}><X className="size-4" /></Button>
    </div>)}

  </div>;
}
