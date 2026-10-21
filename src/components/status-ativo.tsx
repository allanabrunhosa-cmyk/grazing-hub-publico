"use client";

import { useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

export function StatusAtivo({ ativo, nome, onChange, disabled, salvando, className, motivoBloqueio }: {
  ativo: boolean; nome: string; onChange: (ativo: boolean) => void;
  disabled?: boolean; salvando?: boolean; className?: string; motivoBloqueio?: string;
}) {
  const explicacao = useId();
  const bloqueado = disabled || Boolean(motivoBloqueio);
  return <span className="inline-flex flex-col items-start gap-1"><button type="button" role="switch" aria-checked={ativo} aria-label={`Status de ${nome}`}
    aria-describedby={motivoBloqueio ? explicacao : undefined}
    aria-busy={salvando || undefined} title={motivoBloqueio ?? `${ativo ? "Inativar" : "Ativar"} ${nome}`}
    disabled={bloqueado || salvando}
    onClick={evento => { evento.stopPropagation(); onChange(!ativo); }}
    className={cn("ds-status inline-flex min-w-22 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
      ativo ? "border-success/30 bg-success-bg text-success hover:brightness-95" : "border-border bg-muted/50 text-muted-foreground hover:bg-muted", className)}>
    {salvando ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <span aria-hidden="true" className={cn("size-2 rounded-full", ativo ? "bg-success" : "bg-muted-foreground/60")} />}
    {ativo ? "Ativo" : "Inativo"}
  </button>{motivoBloqueio && <span id={explicacao} className="max-w-60 whitespace-normal text-xs text-muted-foreground">{motivoBloqueio}</span>}</span>;
}

export function StatusAtivoSalvavel({ ativo, nome, salvar, disabled, className, motivoBloqueio }: {
  ativo: boolean; nome: string; salvar: (ativo: boolean) => Promise<{ erro: string } | { ok: true }>;
  disabled?: boolean; className?: string; motivoBloqueio?: string;
}) {
  const trava = useRef(false);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState("");
  // O estado confirmado só avança após resposta positiva. Uma nova prop do servidor prevalece.
  const [confirmado, definirConfirmado] = useState({ origem: ativo, valor: ativo });
  if (confirmado.origem !== ativo) definirConfirmado({ origem: ativo, valor: ativo });
  const valor = confirmado.origem === ativo ? confirmado.valor : ativo;
  async function alterar(proximo: boolean) {
    if (trava.current || disabled || motivoBloqueio) return;
    trava.current = true; definirSalvando(true); definirErro("");
      try {
        const resultado = await salvar(proximo);
        if ("erro" in resultado) { definirErro(resultado.erro); toast.error(resultado.erro); }
        else { definirConfirmado({ origem: ativo, valor: proximo }); toast.success(`${nome}: ${proximo ? "ativo" : "inativo"}.`); }
      } catch { const mensagem = "Não foi possível confirmar a alteração. Atualize a página para conferir o status."; definirErro(mensagem); toast.error(mensagem); }
      finally { trava.current = false; definirSalvando(false); }
  }
  return <span className="inline-flex flex-col gap-1"><StatusAtivo ativo={valor} nome={nome} onChange={alterar} salvando={salvando} disabled={disabled} motivoBloqueio={motivoBloqueio} className={className} />{erro && <span role="alert" className="max-w-64 whitespace-normal text-xs text-destructive">{erro}</span>}</span>;
}

// No formulário o status acompanha os demais campos e só é persistido ao salvar.
export function CampoStatusAtivo({ ativoInicial = true, nome, disabled }: { ativoInicial?: boolean; nome: string; disabled?: boolean }) {
  const [ativo, definirAtivo] = useState(ativoInicial);
  return <div className="flex items-center gap-3 text-sm">
    <span>Status</span><input type="hidden" name="ativo" value={ativo ? "on" : ""} />
    <StatusAtivo ativo={ativo} nome={nome} onChange={definirAtivo} disabled={disabled} />
  </div>;
}
