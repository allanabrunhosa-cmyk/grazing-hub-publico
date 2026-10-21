"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepararAcompanhamentoIfoodAction } from "./actions";

export function AcompanhamentoConfigIfood({ lojaId, ativa }: { lojaId: string; ativa: boolean }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), trava = useRef(false);
  const [principal, setPrincipal] = useState(""), [enquadramento, setEnquadramento] = useState(""), [presenca, setPresenca] = useState(""), [minutos, setMinutos] = useState(""), [mensagem, setMensagem] = useState("");
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  function salvar() {
    if (trava.current) return;
    const prazo = Number(minutos);
    if (!Number.isSafeInteger(prazo) || prazo < 1 || prazo > 120) { setMensagem("Informe uma janela de 1 a 120 minutos."); return; }
    const assinatura = JSON.stringify({ principal, enquadramento, presenca, minutos });
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    trava.current = true;
    iniciar(async () => { try {
      const r = await prepararAcompanhamentoIfoodAction(lojaId, { principalClientId: principal, enquadramento, presenca, minutos: prazo, chave: tentativa.current!.chave });
      setMensagem("erro" in r ? r.erro : "Acompanhamento preparado e pausado. Ativação exige liberação separada no servidor.");
      if (!("erro" in r)) { tentativa.current = null; router.refresh(); }
    } catch { setMensagem("Resultado não confirmado. Confira a configuração antes de repetir."); } finally { trava.current = false; } });
  }
  const referencia = (v: string) => v.replace(/[^A-Za-z0-9._:/ -]/g, "").slice(0, 80);
  return <details><summary className="cursor-pointer text-sm font-medium">Preparar acompanhamento temporário</summary><fieldset disabled={ocupado || ativa} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
    <p className="text-sm text-muted-foreground sm:col-span-2">Takeat permanece responsável pelos pedidos. Preencha somente após orientação oficial sobre o enquadramento e a presença. Preparar não ativa recepção. Pause a loja antes de alterar; vínculos com operação anterior não podem ser convertidos.</p>
    <Label className="grid min-w-0 gap-2">Client ID do sistema principal (identificador público)<Input maxLength={36} autoComplete="off" value={principal} onChange={e => setPrincipal(e.target.value.replace(/[^a-fA-F0-9-]/g, "").slice(0, 36))} /></Label>
    <Label className="grid min-w-0 gap-2">Referência da orientação sobre enquadramento<Input maxLength={80} value={enquadramento} onChange={e => setEnquadramento(referencia(e.target.value))} /></Label>
    <Label className="grid min-w-0 gap-2">Referência da orientação sobre presença<Input maxLength={80} value={presenca} onChange={e => setPresenca(referencia(e.target.value))} /></Label>
    <Label className="grid min-w-0 gap-2">Janela do piloto (minutos)<Input inputMode="numeric" casasDecimais={0} min={1} max={120} maxLength={3} value={minutos} onChange={e => setMinutos(e.target.value)} /></Label>
    <Button disabled={!principal || !enquadramento || !presenca || !minutos} onClick={salvar}>Preparar acompanhamento pausado</Button>
    {mensagem && <p role="status" className="text-sm sm:col-span-2">{mensagem}</p>}
  </fieldset></details>;
}
