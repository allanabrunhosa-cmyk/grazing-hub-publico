"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { diaEntradaEstoque } from "@/lib/notas-fiscais/data-entrada";
import { validarTratamentoLocalNota, type EntradaTratamentoLocalNota } from "@/lib/notas-fiscais/tratamento-local";
import { mostrarErroPaginaDesatualizada } from "@/lib/erro-acao-cliente";
import { tratarOutraOperacaoNotaAction } from "./tratamento-local-actions";
import type { NotaFiscalRow } from "./types";

const CONFIRMACOES = {
  DEVOLUCAO: "Confirmar devolução/retorno",
  IGNORAR: "Confirmar nota ignorada",
  REABRIR: "Confirmar reabertura",
} as const;

export function TratamentoOutraOperacaoNota({ nota, bloqueado, onOcupado, onConcluido }: {
  nota: NotaFiscalRow;
  bloqueado?: boolean;
  onOcupado: (ocupado: boolean) => void;
  onConcluido: () => void;
}) {
  const id = useId();
  const [acao, setAcao] = useState<EntradaTratamentoLocalNota["acao"] | null>(null);
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const ocupado = bloqueado || pendente;

  function confirmar() {
    if (!acao || ocupado) return;
    const entrada: EntradaTratamentoLocalNota = {
      notaFiscalId: nota.id, versao: nota.tratamentoLocalVersao ?? 0,
      acao, motivo, ...(acao === "DEVOLUCAO" ? { dataDevolucao } : {}),
    };
    const validacao = validarTratamentoLocalNota(entrada);
    if ("erro" in validacao) { setErro(validacao.erro); return; }
    setErro("");
    onOcupado(true);
    iniciar(async () => {
      try {
        const resultado = await tratarOutraOperacaoNotaAction(entrada);
        if ("erro" in resultado) { setErro(resultado.erro); return; }
        toast.success(acao === "REABRIR" ? "Controle da nota reaberto." : acao === "IGNORAR" ? "Nota ignorada no controle interno." : "Devolução/retorno registrado.");
        onConcluido();
      } catch (falha) {
        if (!mostrarErroPaginaDesatualizada(falha)) setErro("Não foi possível concluir. Confira a situação da nota antes de tentar novamente.");
      } finally { onOcupado(false); }
    });
  }

  return <section aria-label="Outras operações da nota" className="space-y-4 rounded-lg border bg-muted/20 p-3">
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Outras operações</h3>
      <p className="text-sm text-muted-foreground">Use este fluxo para devolução ou retorno já realizado, ou para retirar uma nota das pendências internas. Não gera despesas, parcelas ou movimentações de estoque.</p>
    </div>

    {nota.tratamentoLocal && <div className="space-y-1 text-sm">
      <p className="font-medium">{nota.tratamentoLocal === "IGNORADA" ? "Nota ignorada no controle interno." : "Devolução/retorno registrado."}</p>
      {nota.dataDevolucao && <p>Devolução realizada em {new Date(`${nota.dataDevolucao.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}.</p>}
      <p className="whitespace-pre-wrap break-words">Motivo: {nota.motivoTratamentoLocal}</p>
      <p className="text-xs text-muted-foreground">O XML e o histórico fiscal permanecem disponíveis.</p>
    </div>}

    {!acao ? <GrupoAcoes className="flex-wrap">
      {nota.tratamentoLocal ? <Button type="button" variant="outline" disabled={ocupado} onClick={() => setAcao("REABRIR")}>Reabrir controle da nota</Button> : <>
        <Button type="button" variant="outline" disabled={ocupado} onClick={() => setAcao("DEVOLUCAO")}>Registrar devolução/retorno</Button>
        <Button type="button" variant="outline" disabled={ocupado} onClick={() => setAcao("IGNORAR")}>Ignorar nota</Button>
      </>}
    </GrupoAcoes> : <div className="space-y-3">
      <p className="text-sm">{acao === "DEVOLUCAO"
        ? "Ao confirmar, o sistema registra a Confirmação da Operação na SEFAZ. A data informa quando a devolução ocorreu e fica no controle interno."
        : acao === "IGNORAR"
          ? "A nota sairá das pendências internas. Esta ação não envia manifestação à SEFAZ, não recusa nem cancela a nota."
          : "O controle interno será reaberto. As manifestações já registradas na SEFAZ serão preservadas."}</p>
      {acao === "DEVOLUCAO" && <div className="space-y-1.5">
        <Label htmlFor={`${id}-data`}>Data da devolução</Label>
        <Input id={`${id}-data`} type="date" required max={diaEntradaEstoque()} value={dataDevolucao} onChange={e => { setDataDevolucao(e.target.value); setErro(""); }} disabled={ocupado} />
        <p className="text-xs text-muted-foreground">Informe somente uma devolução já realizada. Datas futuras não são aceitas.</p>
      </div>}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-motivo`}>Motivo do tratamento (15 a 500 caracteres)</Label>
        <Textarea id={`${id}-motivo`} value={motivo} maxLength={500} rows={3} disabled={ocupado}
          onChange={e => { setMotivo(e.target.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")); setErro(""); }} />
        <p className="text-xs text-muted-foreground">{motivo.trim().length}/500 caracteres</p>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <GrupoAcoes className="flex-wrap">
        <Button type="button" variant="outline" disabled={ocupado} onClick={() => { setAcao(null); setErro(""); }}>Voltar</Button>
        <Button type="button" variant="entrada" disabled={ocupado} onClick={confirmar}>
          {pendente && <Loader2 className="size-4 animate-spin" />}{CONFIRMACOES[acao]}
        </Button>
      </GrupoAcoes>
    </div>}
  </section>;
}
