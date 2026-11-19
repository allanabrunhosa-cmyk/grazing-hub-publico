"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { toast } from "sonner";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusAtivo } from "@/components/status-ativo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { salvarMcpAction } from "./actions";

/** Faixa compacta com o endereço do servidor MCP e o acesso global. A permissão é reconferida na ação de servidor. */
export function FaixaServidorMcp({ endereco, ativo, configurado, editar }: { endereco: string; ativo: boolean; configurado: boolean; editar: boolean }) {
  const router = useRouter(); const trava = useRef(false);
  const [pendente, setPendente] = useState(false); const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState<boolean | null>(null);
  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); toast.success("Endereço copiado."); }
    catch { setErro("Não foi possível copiar. Selecione e copie o endereço exibido."); }
  }
  async function alterar(novo: boolean) {
    if (trava.current) return; trava.current = true; setPendente(true); setErro("");
    try { const r = await salvarMcpAction({ tipo: "global", ativo: novo }); if ("erro" in r) setErro(r.erro); else { setConfirmar(null); toast.success(novo ? "Acesso MCP ativado." : "Acesso MCP suspenso."); router.refresh(); } }
    catch { setErro("Não foi possível confirmar. Atualize a página antes de tentar novamente."); }
    finally { trava.current = false; setPendente(false); }
  }
  return <section aria-label="Servidor MCP do Grazing HUB" className="space-y-2">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--ds-cartao-raio)] border border-border/80 bg-card px-4 py-2.5 shadow-sm">
      <span aria-hidden="true" className="flex shrink-0"><LogoMark className="size-7" /></span>
      <span className="text-sm font-medium">Servidor MCP</span>
      <code title="Endereço do servidor MCP" className="min-w-0 flex-1 basis-56 truncate rounded-[var(--ds-controle-raio)] bg-muted px-2 py-1 font-mono text-xs select-all">{endereco}</code>
      <Button size="sm" variant="outline" onClick={copiar}><Copy className="size-4" />Copiar endereço</Button>
      {!configurado && <Badge variant="warning">Configuração pendente</Badge>}
      <span className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Acesso global</span><StatusAtivo ativo={ativo} nome="Acesso global MCP" disabled={!editar || pendente} onChange={novo => { setErro(""); setConfirmar(novo); }} /></span>
    </div>
    {erro && confirmar === null && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Dialog open={confirmar !== null} onOpenChange={aberto => { if (!aberto && !pendente) setConfirmar(null); }}><DialogContent>
      <DialogHeader><DialogTitle>{confirmar ? "Ativar acesso MCP?" : "Suspender todo o acesso MCP?"}</DialogTitle><DialogDescription>{confirmar ? "As políticas e os consentimentos continuam obrigatórios. Esta ação não autoriza aplicações automaticamente." : "Novas chamadas e emissões de credenciais serão bloqueadas em todas as conexões. A operação normal do HUB continuará disponível."}</DialogDescription></DialogHeader>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <GrupoAcoes><Button variant="outline" disabled={pendente} onClick={() => setConfirmar(null)}>Cancelar</Button><Button variant={confirmar ? "entrada" : "saida"} disabled={pendente} onClick={() => confirmar !== null && alterar(confirmar)}>{pendente ? "Confirmando..." : "Confirmar"}</Button></GrupoAcoes>
    </DialogContent></Dialog>
  </section>;
}
