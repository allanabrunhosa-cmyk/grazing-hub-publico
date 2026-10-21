"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIMITE_NOME_MARCA, normalizarMarca, validarMarcas } from "@/lib/insumos/marcas";

export function MarcasCampo({ marcasIniciais = [], desabilitado = false }: { marcasIniciais?: string[]; desabilitado?: boolean }) {
  const identificador = useId();
  const [marcas, definirMarcas] = useState(marcasIniciais);
  const [rascunho, definirRascunho] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  // Inclui também a última marca digitada ao salvar o formulário, mesmo sem clicar no +.
  const marcasParaSalvar = normalizarMarca(rascunho) ? [...marcas, rascunho] : marcas;

  function adicionarMarca() {
    if (!normalizarMarca(rascunho)) return;
    const resultado = validarMarcas(marcasParaSalvar);
    if ("erro" in resultado) { definirErro(resultado.erro); return; }
    definirMarcas(resultado.marcas);
    definirRascunho("");
    definirErro(null);
  }

  return <div className="min-w-0 space-y-2">
    <Label htmlFor={identificador}>Marcas homologadas</Label>
    <input type="hidden" name="marcasHomologadas" value={JSON.stringify(marcasParaSalvar)} />
    {marcas.length > 0 && <ul aria-label="Marcas homologadas deste insumo" className="flex flex-wrap gap-2">
      {marcas.map((marca) => <li key={marca} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-1 pl-3 pr-1 text-sm text-primary">
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{marca}</span>
        <button type="button" data-dialogo-altera aria-label={`Remover marca ${marca}`} disabled={desabilitado} className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50" onClick={() => { definirMarcas((atuais) => atuais.filter((atual) => atual !== marca)); definirErro(null); }}><X className="size-3.5" /></button>
      </li>)}
    </ul>}
    <div className="flex gap-2">
      <Input id={identificador} value={rascunho} maxLength={LIMITE_NOME_MARCA} disabled={desabilitado} placeholder="Ex.: União" aria-describedby={`${identificador}-ajuda`} aria-invalid={!!erro} onChange={(evento) => { definirRascunho(evento.target.value); definirErro(null); }} onKeyDown={(evento) => {
        if (evento.key === "Enter" && !evento.ctrlKey && !evento.metaKey && !evento.nativeEvent.isComposing) { evento.preventDefault(); adicionarMarca(); }
      }} />
      <Button type="button" variant="outline" size="icon" aria-label="Adicionar marca" disabled={desabilitado || !rascunho.trim()} onClick={adicionarMarca}><Plus className="size-4" /></Button>
    </div>
    <p id={`${identificador}-ajuda`} className="text-xs text-muted-foreground">Digite uma marca e pressione Enter ou +. As alterações são aplicadas ao salvar o insumo.</p>
    {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
  </div>;
}
