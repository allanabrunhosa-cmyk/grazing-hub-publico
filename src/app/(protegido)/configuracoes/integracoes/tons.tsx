import type { ReactNode } from "react";
import { cn } from "cn";

/** Tons de destaque das Integrações: somente pares fundo/texto já existentes nos tokens. */
export const TONS = {
  azul: "bg-secondary text-primary",
  verde: "bg-success-bg text-success",
  ambar: "bg-warning-bg text-warning",
  roxo: "bg-[var(--ds-processo-entregue-fundo)] text-[var(--ds-processo-entregue)]",
  vermelho: "bg-destructive/10 text-destructive",
  neutro: "bg-muted text-muted-foreground",
} as const;
export type Tom = keyof typeof TONS;
export const TONS_DESTAQUE: Tom[] = ["azul", "verde", "ambar", "roxo", "vermelho"];
export type VarianteSelo = "success" | "warning" | "muted" | "destructive" | "secondary";

/** Situação de uma conexão MCP: rótulo, selo e tom usados no seletor e no detalhe. */
export const SITUACOES_CONEXAO: Record<string, { rotulo: string; variante: VarianteSelo; tom: Tom }> = {
  ATIVA: { rotulo: "Ativa", variante: "success", tom: "verde" },
  PREPARADA: { rotulo: "Aguardando autorização", variante: "warning", tom: "ambar" },
  SUSPENSA: { rotulo: "Suspensa", variante: "muted", tom: "neutro" },
  REVOGADA: { rotulo: "Revogada", variante: "destructive", tom: "vermelho" },
};
export const situacaoDaConexao = (situacao: string) => SITUACOES_CONEXAO[situacao] ?? { rotulo: situacao, variante: "muted" as const, tom: "neutro" as const };

export function IconeTom({ tom, children, tamanho = "padrao", className }: { tom: Tom; children: ReactNode; tamanho?: "padrao" | "grande" | "pequeno"; className?: string }) {
  return <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-[var(--ds-aba-raio)] [&_svg]:size-5",
    tamanho === "grande" ? "size-12 [&_svg]:size-6" : tamanho === "pequeno" ? "size-7 [&_svg]:size-4" : "size-10", TONS[tom], className)}>{children}</span>;
}
