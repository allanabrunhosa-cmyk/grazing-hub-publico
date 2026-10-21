import { cn } from "cn";

export type DadosIdentificacaoInsumo = {
  nome: string;
  especificacao?: string | null;
};

export function IdentificacaoInsumo({
  nome,
  especificacao,
  className,
  nomeClassName,
  especificacaoClassName,
}: DadosIdentificacaoInsumo & {
  className?: string;
  nomeClassName?: string;
  especificacaoClassName?: string;
}) {
  return (
    <span className={cn("block min-w-0", className)}>
      <span className={cn("block break-words", nomeClassName)}>{nome}</span>
      {especificacao ? (
        <span className={cn("mt-0.5 block break-words text-xs text-muted-foreground", especificacaoClassName)}>
          {especificacao}
        </span>
      ) : null}
    </span>
  );
}

export function textoIdentificacaoInsumo(insumo: DadosIdentificacaoInsumo) {
  return insumo.especificacao ? `${insumo.nome} ${insumo.especificacao}` : insumo.nome;
}
