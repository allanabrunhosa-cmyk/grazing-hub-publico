"use client";

import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import { imprimirFichaTecnica } from "@/lib/insumos/ficha-tecnica";

export function FichaTecnicaButton({ preparacao }: { preparacao: InsumoRow }) {
  return (
    <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => {
      if (!imprimirFichaTecnica(preparacao)) toast.error("O navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente.");
    }}>
      <Printer className="size-3.5" />
      Imprimir ficha técnica
    </Button>
  );
}
