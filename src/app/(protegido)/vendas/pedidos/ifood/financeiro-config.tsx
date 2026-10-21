"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import { METODOS_FINANCEIROS_IFOOD, type FinanceiroConfigIfood } from "@/lib/ifood/financeiro-config-dominio";
import { salvarFinanceiroConfigIfoodAction } from "./actions";
const nomes: Record<string,string> = { IFOOD_ONLINE: "Recebível on-line iFood", SUBSIDIO_IFOOD: "Subsídio iFood", CREDIT: "Crédito", DEBIT: "Débito", PIX: "Pix", CASH: "Dinheiro", MEAL_VOUCHER: "Vale-refeição", FOOD_VOUCHER: "Vale-alimentação" };
export function FinanceiroConfigIfood({ lojaId, versao, inicial, formas }: { lojaId: string; versao: number; inicial?: FinanceiroConfigIfood | null; formas: { id: string; nome: string }[] }) {
  const router = useRouter(), [valor, setValor] = useState<FinanceiroConfigIfood>(inicial ?? { prazoDias: 0, contagem: "CORRIDOS", formas: {} }), [mensagem, setMensagem] = useState(""), [ocupado, iniciar] = useTransition(), trava = useRef(false), tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  function salvar() {
    if (trava.current) return; trava.current = true;
    const assinatura = JSON.stringify(valor); if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    iniciar(async () => { try { const r = await salvarFinanceiroConfigIfoodAction(lojaId, versao, valor, tentativa.current!.chave); setMensagem("erro" in r ? r.erro : "Configuração financeira salva. Recepção e liberação da integração preservadas."); if (!("erro" in r)) router.refresh(); } catch { setMensagem("Resultado não confirmado. Confira antes de repetir."); } finally { trava.current = false; } });
  }
  return <details><summary className="cursor-pointer text-sm font-medium">Parametrização financeira da loja</summary><fieldset disabled={ocupado} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2"><p className="text-sm text-muted-foreground sm:col-span-2">Novos títulos usam estes vínculos e o prazo previsto contado da confirmação. Não presume recebimento, comissão, reembolso ou repasse. Dias úteis excluem sábados e domingos; feriados não são inferidos.</p>{METODOS_FINANCEIROS_IFOOD.map(m => <Label key={m} className="grid gap-2">{nomes[m]}<SelecaoFormulario aria-label={`Forma financeira ${nomes[m]}`} value={valor.formas[m] ?? ""} onValueChange={v => setValor(a => { const formas = { ...a.formas }; if (v) formas[m] = v; else delete formas[m]; return { ...a, formas }; })}><option value="">Não configurada</option>{formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</SelecaoFormulario></Label>)}<Label className="grid gap-2">Prazo previsto (dias)<Input inputMode="numeric" casasDecimais={0} min={0} max={3650} maxLength={4} value={String(valor.prazoDias)} onChange={e => setValor(a => ({ ...a, prazoDias: Number(e.target.value) }))} /></Label><Label className="grid gap-2">Contagem<SelecaoFormulario aria-label="Contagem do prazo iFood" value={valor.contagem} onValueChange={v => setValor(a => ({ ...a, contagem: v as "CORRIDOS" | "UTEIS" }))}><option value="CORRIDOS">Dias corridos</option><option value="UTEIS">Dias úteis</option></SelecaoFormulario></Label><Button onClick={salvar}>Salvar parâmetros financeiros</Button>{mensagem && <p role="status" className="text-sm sm:col-span-2">{mensagem}</p>}</fieldset></details>;
}
