"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { periodoDoMes, periodoMesAteHoje } from "@/lib/financeiro/periodos";

type Resultado = { erro: string } | { ok: true; fechadoAte: string | null };
export type FechamentoCaixaProps = {
  fechadoAte: string | null;
  podeGerir: boolean;
  historico: { id: string; mes: string; fechadoEm: string; fechadoPorNome: string; reabertoEm: string | null; reabertoPorNome: string | null; motivoReabertura: string | null }[];
  fechar: (mes: string) => Promise<Resultado>;
  reabrir: (motivo: string) => Promise<Resultado>;
};

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const nomeMes = (mes: string) => new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function mesAnterior(): string {
  const [ano, mes] = periodoMesAteHoje().de.split("-").map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

export function FechamentoCaixaControle({ fechadoAte, podeGerir, historico, fechar, reabrir }: FechamentoCaixaProps) {
  const [dialogo, setDialogo] = useState<"fechar" | "reabrir" | null>(null);
  const [mes, setMes] = useState(mesAnterior);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  const limite = mesAnterior();
  const mesValido = /^\d{4}-\d{2}$/.test(mes) && !!periodoDoMes(mes) && mes <= limite && (!fechadoAte || mes > fechadoAte.slice(0, 7));
  const motivoValido = motivo.trim().length >= 5;

  function concluir(resultado: Resultado, mensagem: string) {
    if ("erro" in resultado) { toast.error(resultado.erro); return; }
    toast.success(mensagem);
    setDialogo(null);
    setMotivo("");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm" data-testid="fechamento-caixa">
      <p className="flex min-w-0 items-center gap-2">
        {fechadoAte ? <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <LockOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span>{fechadoAte
          ? <>Fluxo de caixa <strong className="font-semibold">fechado até {dataBr(fechadoAte)}</strong>. Baixas, estornos e pagamentos com data nesse período estão bloqueados.</>
          : "Nenhum mês fechado. Fechar um mês bloqueia baixas, estornos e pagamentos com data nele e nos meses anteriores."}</span>
      </p>
      {podeGerir && <GrupoAcoes nome="Fechamento do mês">
        {fechadoAte && <Button type="button" size="sm" variant="outline" onClick={() => setDialogo("reabrir")}>Reabrir mês</Button>}
        <Button type="button" size="sm" variant="outline" onClick={() => setDialogo("fechar")}>Fechar mês</Button>
      </GrupoAcoes>}

      <Dialog open={dialogo === "fechar"} onOpenChange={aberto => !aberto && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar mês do fluxo de caixa</DialogTitle>
            <DialogDescription>
              O mês escolhido e todos os anteriores ficam bloqueados para baixas, estornos e pagamentos. Só um administrador reabre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fechamento-mes">Mês a fechar</Label>
            <Input id="fechamento-mes" type="month" min="2000-01" max={limite} value={mes} onChange={e => setMes(e.target.value)} />
            {!mesValido && <p className="text-xs text-destructive">Escolha um mês já encerrado e posterior ao último fechamento.</p>}
          </div>
          {historico.length > 0 && <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Histórico recente</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {historico.map(h => <li key={h.id} className="break-words">
                {nomeMes(h.mes)}: fechado por {h.fechadoPorNome} em {dataBr(h.fechadoEm)}
                {h.reabertoEm && <> · reaberto por {h.reabertoPorNome} em {dataBr(h.reabertoEm)} ({h.motivoReabertura})</>}
              </li>)}
            </ul>
          </div>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Cancelar</DialogClose>
            <Button type="button" variant="entrada" disabled={pendente || !mesValido}
              onClick={() => iniciar(async () => concluir(await fechar(mes), `Fluxo de caixa fechado até o fim de ${nomeMes(mes)}.`))}>
              {pendente && <Loader2 className="size-4 animate-spin" />}Fechar mês
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === "reabrir"} onOpenChange={aberto => !aberto && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir {fechadoAte ? nomeMes(fechadoAte.slice(0, 7)) : "mês"}?</DialogTitle>
            <DialogDescription>
              O último mês fechado volta a aceitar baixas, estornos e pagamentos. Os meses anteriores continuam fechados. O motivo fica no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fechamento-motivo">Motivo da reabertura</Label>
            <Textarea id="fechamento-motivo" value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Cancelar</DialogClose>
            <Button type="button" variant="saida" disabled={pendente || !motivoValido}
              onClick={() => iniciar(async () => concluir(await reabrir(motivo), "Mês reaberto."))}>
              {pendente && <Loader2 className="size-4 animate-spin" />}Reabrir mês
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
