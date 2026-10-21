import type { TipoEstoque } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { tipoEstoqueLabels } from "@/lib/labels";

const coresTipoEstoque: Record<TipoEstoque, string> = {
  CONGELADO: "bg-[#4169E1] text-white",
  REFRIGERADO: "bg-[#DBEAFE] text-[#1E40AF]",
  SECO: "bg-[#DCFCE7] text-[#166534]",
};

export function TipoEstoqueBadge({ tipo }: { tipo: TipoEstoque }) {
  return (
    <Badge variant="outline" className={`border-transparent ${coresTipoEstoque[tipo]}`}>
      {tipoEstoqueLabels[tipo]}
    </Badge>
  );
}
