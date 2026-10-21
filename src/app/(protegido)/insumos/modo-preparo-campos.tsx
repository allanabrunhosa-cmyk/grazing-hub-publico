"use client";

import { Plus } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { ListaOrdenavel } from "@/components/lista-ordenavel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAXIMO_PASSOS_PREPARO } from "@/lib/insumos/limites-preparacao";

export function ModoPreparoCampos({ passos, onChange, disabled }: {
  passos: string[];
  onChange: (passos: string[]) => void;
  disabled?: boolean;
}) {
  function atualizar(indice: number, texto: string) {
    onChange(passos.map((passo, atual) => atual === indice ? texto : passo));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="modoPreparo" value={JSON.stringify(passos)} />
      <p className="text-sm text-muted-foreground">Até {MAXIMO_PASSOS_PREPARO} passos, para que a ficha técnica caiba em uma página.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange(["", ...passos])} disabled={disabled || passos.length >= MAXIMO_PASSOS_PREPARO}>
        <Plus /> Adicionar passo
      </Button>
    {passos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhum passo cadastrado.
        </p>
      ) : (
        <div role="list" aria-label="Passos do modo de preparo">
          <ListaOrdenavel itens={passos.map((texto, indice) => ({ id: String(indice), texto }))} chave={passo => passo.id} nome={passo => `Passo ${Number(passo.id) + 1}`} mudar={itens => onChange(itens.map(item => item.texto))} disabled={disabled}>
          {(item, indice, alca) => (
            <div role="listitem" className="grid grid-cols-[2.25rem_2rem_minmax(0,1fr)_2.25rem] items-start gap-2 rounded-lg border bg-muted/20 p-2">
              {alca}
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                {indice + 1}
              </span>
              <Textarea
                value={item.texto}
                onChange={(evento) => atualizar(indice, evento.target.value)}
                rows={2}
                maxLength={1000}
                disabled={disabled}
                aria-label={`Passo ${indice + 1}`}
                placeholder="Descreva esta etapa do preparo"
              />
              <GrupoAcoes nome={`Ações do passo ${indice + 1}`}>
                <Button type="button" variant="excluir" size="icon-sm" onClick={() => onChange(passos.filter((_, atual) => atual !== indice))} disabled={disabled} aria-label={`Excluir passo ${indice + 1}`} />
              </GrupoAcoes>
            </div>
          )}
          </ListaOrdenavel>
        </div>
      )}

    </div>
  );
}
