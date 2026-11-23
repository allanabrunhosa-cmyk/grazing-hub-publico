"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";

export type RevisaoNcmPainel = { versaoId: string; produtoId: string; nome: string; ncms: string[]; mudancas: string[]; assinatura: string };
type Manter = (entrada: { versaoId: string; assinatura: string; chaveOperacao: string }) => Promise<{ ok: true } | { erro: string }>;

/** Consumidor de referência: "Notas autorizadas com arquivos a recuperar", no mesmo painel. */
export function RevisaoNcmPendentePainel({ revisoes, podeDecidir, manter }: { revisoes: RevisaoNcmPainel[]; podeDecidir: boolean; manter: Manter }) {
  const router = useRouter(), trava = useRef(false);
  const [confirmando, definirConfirmando] = useState<RevisaoNcmPainel | null>(null);
  const [ocupado, definirOcupado] = useState(false), [erro, definirErro] = useState<string | null>(null);
  const [chave, definirChave] = useState("");
  if (!revisoes.length) return null;
  function abrir(r: RevisaoNcmPainel) { definirErro(null); definirChave(crypto.randomUUID()); definirConfirmando(r); }
  function fechar() { definirConfirmando(null); definirErro(null); }
  async function confirmar() {
    if (!confirmando || trava.current || !podeDecidir) return;
    trava.current = true; definirOcupado(true); definirErro(null);
    try {
      const r = await manter({ versaoId: confirmando.versaoId, assinatura: confirmando.assinatura, chaveOperacao: chave });
      if ("erro" in r) definirErro(r.erro || "Não foi possível manter o NCM.");
      else { definirConfirmando(null); router.refresh(); }
    } catch { definirErro("A conexão foi interrompida. Atualize a página para conferir se o NCM foi mantido."); }
    finally { trava.current = false; definirOcupado(false); }
  }
  const ncm = (r: RevisaoNcmPainel) => r.ncms.length ? r.ncms.join(", ") : "não definido";
  return <section id="revisao-ncm" aria-label="Revisão de NCM pendente" className="scroll-mt-4 space-y-3 rounded-[var(--ds-cartao-raio)] border border-warning/30 bg-warning/5 p-3">
    <p className="text-sm font-medium">Revisão de NCM pendente · {revisoes.length} {revisoes.length === 1 ? "produto" : "produtos"}</p>
    <p className="text-xs text-muted-foreground">A composição destes produtos mudou depois da análise fiscal. As notas continuam saindo com o NCM atual; ele só muda com a sua decisão.</p>
    <ul className="space-y-3">{revisoes.map(r => <li key={r.versaoId} className="space-y-2 border-t border-warning/20 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{r.nome}</p><p className="text-xs text-muted-foreground">NCM atual: <span className="tabular-nums">{ncm(r)}</span></p></div>
        <GrupoAcoes nome={`Decisão de NCM de ${r.nome}`} className="flex-wrap">
          <Button variant="entrada" size="sm" disabled={!podeDecidir || ocupado} title={podeDecidir ? undefined : "Somente o administrador pode decidir o NCM."} onClick={() => abrir(r)}><Check aria-hidden="true" />Manter NCM</Button>
          <Button variant="outline" size="sm" nativeButton={false} role="link" render={<Link href={`/financeiro/fiscal/vinculos?produto=${encodeURIComponent(r.produtoId)}`} />}>Alterar NCM<ArrowUpRight aria-hidden="true" className="size-3.5" /></Button>
        </GrupoAcoes>
      </div>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{r.mudancas.map(m => <li key={m} className="break-words">{m}</li>)}</ul>
    </li>)}</ul>
    {!podeDecidir && <p className="text-xs text-muted-foreground">Seu acesso permite consultar estas revisões; a decisão sobre o NCM é do administrador.</p>}
    <Dialog open={Boolean(confirmando)} onOpenChange={aberto => { if (!ocupado && !aberto) fechar(); }}>
      <DialogContent showCloseButton={!ocupado}>
        <DialogHeader><DialogTitle>Manter o NCM deste produto?</DialogTitle><DialogDescription>{confirmando ? `${confirmando.nome} continua com o NCM ${ncm(confirmando)} para a composição atual. A decisão fica registrada em seu nome, em uma nova versão da classificação fiscal.` : ""}</DialogDescription></DialogHeader>
        {confirmando && <ul className="list-disc space-y-1 pl-4 text-sm">{confirmando.mudancas.map(m => <li key={m} className="break-words">{m}</li>)}</ul>}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <DialogFooter><Button variant="outline" disabled={ocupado} onClick={fechar}>Cancelar</Button><Button variant="entrada" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void confirmar()}>{ocupado ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}{ocupado ? "Registrando…" : "Manter NCM"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
