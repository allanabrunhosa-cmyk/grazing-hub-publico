"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { StatusAtivo } from "@/components/status-ativo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ConfiguracaoMovimentacaoEstoqueGestor } from "@/lib/vendas/pedidos-operacao-dominio";
import { salvarMovimentacaoEstoqueGestorPedidosAction } from "./gestor-actions";

export function ConfigurarEstoqueGestor({ configuracao }: { configuracao: ConfiguracaoMovimentacaoEstoqueGestor }) {
  const router = useRouter();
  const campoLocal = useId();
  const [aberto, setAberto] = useState(false);
  const [confirmado, setConfirmado] = useState(configuracao);
  const [edicao, setEdicao] = useState({ valor: configuracao.movimentarEstoque, versao: configuracao.versao, localId: configuracao.localMovimentarEstoqueId });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const trava = useRef(false);
  const tentativa = useRef<string | null>(null);
  if (configuracao.versao > confirmado.versao) setConfirmado(configuracao);
  const mudou = edicao.valor !== confirmado.movimentarEstoque || edicao.localId !== confirmado.localMovimentarEstoqueId;
  const localDisponivel = configuracao.locais.some(local => local.id === edicao.localId);
  const localValido = !edicao.valor || localDisponivel;
  const locais = [{ id: "", nome: "Sem local selecionado", indisponivel: false }, ...configuracao.locais.map(local => ({ ...local, indisponivel: false }))];
  if (edicao.localId && !localDisponivel) locais.push({ id: edicao.localId, nome: "Local salvo indisponível", indisponivel: true });

  async function salvar() {
    if (trava.current || !configuracao.podeAlterar || !mudou || !localValido) return;
    trava.current = true;
    setSalvando(true);
    setErro("");
    try {
      const chave = tentativa.current ??= crypto.randomUUID();
      const resultado = await salvarMovimentacaoEstoqueGestorPedidosAction(edicao.valor, edicao.versao, chave, edicao.localId);
      if ("erro" in resultado) { setErro(resultado.erro ?? "Não foi possível confirmar a configuração. Reabra para conferir antes de tentar novamente."); return; }
      setConfirmado({ ...configuracao, movimentarEstoque: resultado.movimentarEstoque, versao: resultado.versao, localMovimentarEstoqueId: resultado.localMovimentarEstoqueId });
      setAberto(false);
      toast.success("Configuração de estoque salva.");
      router.refresh();
    } catch {
      setErro("Não foi possível confirmar a configuração. Tente novamente ou atualize os pedidos para conferir o valor salvo.");
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  return <Dialog open={aberto} alterado={mudou} protegerAlteracoes={!salvando} disablePointerDismissal={salvando} onOpenChange={(proximo, detalhes) => {
    if (trava.current) { detalhes.cancel(); return; }
    if (proximo) {
      setEdicao({ valor: confirmado.movimentarEstoque, versao: confirmado.versao, localId: confirmado.localMovimentarEstoqueId });
      setErro("");
      tentativa.current = null;
    }
    setAberto(proximo);
  }}>
    <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Configurar estoque dos pedidos" title="Configurar estoque dos pedidos" />}><Settings /></DialogTrigger>
    <DialogContent aria-busy={salvando || undefined} showCloseButton={!salvando} onKeyDownCapture={evento => {
      if (trava.current && evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); }
    }}>
      <DialogTitle>Estoque dos pedidos</DialogTitle>
      <DialogDescription>Configure a movimentação de estoque do Gestor de Pedidos. A alteração só é aplicada ao salvar.</DialogDescription>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Movimentar estoque</p>
          <StatusAtivo ativo={edicao.valor} nome="Movimentar estoque" salvando={salvando} disabled={!configuracao.podeAlterar}
            motivoBloqueio={!configuracao.podeAlterar ? "Somente administradores podem alterar esta configuração." : undefined}
            onChange={valor => { tentativa.current = null; setEdicao(atual => ({ ...atual, valor })); setErro(""); }} />
        </div>
        <p className="text-sm text-muted-foreground">{edicao.valor
          ? "Ligado: pedidos de montagem baixam estoque ao marcar Pronto; produtos de revenda, ao marcar Em rota. Saldo negativo é permitido. Não há baixa retroativa das etapas registradas com a chave desligada."
          : "Desligado: as mudanças de status controlam a produção dos pedidos sem criar reservas nem baixas de estoque."}</p>
        <div className="space-y-1.5">
          <Label htmlFor={campoLocal}>Local de estoque</Label>
          <Select value={edicao.localId ?? ""} disabled={salvando || !configuracao.podeAlterar} items={Object.fromEntries(locais.map(local => [local.id, local.nome]))}
            onValueChange={localId => { tentativa.current = null; setEdicao(atual => ({ ...atual, localId: localId || null })); setErro(""); }}>
            <SelectTrigger id={campoLocal} aria-label="Local de estoque" aria-required={edicao.valor || undefined} aria-invalid={!localValido || undefined} aria-describedby={`${campoLocal}-ajuda`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>{locais.map(local => <SelectItem key={local.id} value={local.id} disabled={local.indisponivel} quebrarTexto>{local.nome}</SelectItem>)}</SelectContent>
          </Select>
          <p id={`${campoLocal}-ajuda`} className="text-xs text-muted-foreground">{!localValido
            ? "Selecione um local disponível para ativar a baixa automática."
            : "O local é usado para novas movimentações. Reservas anteriores conservam seu próprio local."}</p>
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={salvando} />}>{configuracao.podeAlterar ? "Cancelar" : "Fechar"}</DialogClose>
        {configuracao.podeAlterar && <Button type="button" className="min-w-24" disabled={salvando || !mudou || !localValido} onClick={() => void salvar()}>
          {salvando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{salvando ? "Salvando…" : "Salvar"}
        </Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
