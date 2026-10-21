"use client";

import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

type CampoBuscaProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (valor: string) => void;
  containerClassName?: string;
  formato?: "padrao" | "arredondado";
};

/** Campo de pesquisa com limpeza rápida, reutilizável nos filtros das listagens. */
export function CampoBusca({ value, onChange, className, containerClassName, formato = "padrao", ...props }: CampoBuscaProps) {
  return (
    <div data-formato={formato} className={cn("campo-busca", containerClassName)}>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className={cn("pl-8", value && "pr-8", formato === "arredondado" && "rounded-[var(--ds-botao-raio)]", className)}
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          title="Limpar busca"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
