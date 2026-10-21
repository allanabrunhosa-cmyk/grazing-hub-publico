"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import type { SimpleOption } from "@/app/(protegido)/fornecedores/types";

export function CreatableCheckboxList({
  name,
  initialOptions,
  selectedIds,
  onCreate,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  disabled,
}: {
  name: string;
  initialOptions: SimpleOption[];
  selectedIds: string[];
  onCreate: (nome: string) => Promise<SimpleOption>;
  placeholder: string;
  searchPlaceholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [newValue, setNewValue] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const nome = newValue.trim();
    if (!nome) return;

    startTransition(async () => {
      try {
        const created = await onCreate(nome);
        setOptions((prev) => (prev.some((o) => o.id === created.id) ? prev : [...prev, created]));
        setSelected((prev) => new Set(prev).add(created.id));
        setNewValue("");
      } catch {
        toast.error("Não foi possível adicionar. Tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <MultiselecaoCombobox
        opcoes={options}
        selecionadosIds={[...selected]}
        aoMudar={(ids) => setSelected(new Set(ids))}
        name={name}
        placeholder={searchPlaceholder}
        ariaLabel={ariaLabel}
        disabled={disabled}
      />

      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={handleAdd} disabled={disabled || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
