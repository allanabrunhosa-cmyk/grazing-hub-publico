"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SimpleOption } from "@/app/(protegido)/insumos/types";

const NENHUM = "__nenhum__";

export function CreatableSelect({
  name,
  initialOptions,
  selectedId,
  onCreate,
  placeholder,
  emptyLabel = "Nenhuma",
  addLabel,
  disabled,
}: {
  name: string;
  initialOptions: SimpleOption[];
  selectedId: string | null;
  onCreate: (nome: string) => Promise<SimpleOption>;
  placeholder: string;
  emptyLabel?: string;
  addLabel: string;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [value, setValue] = useState(selectedId ?? NENHUM);
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const nome = newValue.trim();
    if (!nome) return;
    startTransition(async () => {
      try {
        const created = await onCreate(nome);
        setOptions((prev) => (prev.some((o) => o.id === created.id) ? prev : [...prev, created]));
        setValue(created.id);
        setNewValue("");
        setAdding(false);
      } catch {
        toast.error("Não foi possível adicionar. Tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <Select name={name} value={value} onValueChange={(v) => setValue(String(v))} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {(v: string) => (v === NENHUM || !v ? emptyLabel : (options.find((o) => o.id === v)?.nome ?? emptyLabel))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUM}>{emptyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={addLabel}
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setNewValue("");
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" onClick={handleAdd} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}
