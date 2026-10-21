import { Badge } from "@/components/ui/badge";
import type { CategoriaEntrada } from "@/lib/vendas/dominio";
const variantes = { azul: "default", verde: "success", amarelo: "warning", vermelho: "destructive" } as const;
export function TagCategoriaComplemento({ categoria }: { categoria: Pick<CategoriaEntrada, "nome" | "cor" | "ativo"> }) {
  return <Badge variant={variantes[categoria.cor ?? "azul"]} className="whitespace-normal break-words">{categoria.nome}{categoria.ativo ? "" : " (inativa)"}</Badge>;
}
