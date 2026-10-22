"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import type { PerfilFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { salvarEmpresaFiscalSimplesAction } from "../simples-actions";
export function EmpresaEdicaoSimples({ versao }: { versao: VersaoFiscalDto }) {
  const inicial = versao.dados as PerfilFiscal, router = useRouter();
  const [editar, setEditar] = useState(false), [crt, setCrt] = useState(inicial.crt), [regime, setRegime] = useState(inicial.regime), [ie, setIe] = useState(inicial.inscricaoEstadual), [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  const op = useRef(crypto.randomUUID());
  if (!editar) return <Button type="button" variant="outline" onClick={() => setEditar(true)}>Editar dados fiscais</Button>;
  return <form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (salvando) return; setSalvando(true); setErro(""); try { const r = await salvarEmpresaFiscalSimplesAction({ perfilId: versao.id, crt: crt!, regime, inscricaoEstadual: ie, chaveOperacao: op.current }); if (r.erro) setErro(r.erro); else { setEditar(false); op.current = crypto.randomUUID(); router.refresh(); } } catch { setErro("Não foi possível salvar os dados da empresa."); } finally { setSalvando(false); } }}>
    <fieldset disabled={salvando} className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">Regime<SelecaoFormulario aria-label="Regime da empresa" value={regime} onValueChange={v => setRegime(v as typeof regime)}><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option></SelecaoFormulario></label><label className="grid gap-1.5 text-sm">CRT<SelecaoFormulario aria-label="CRT da empresa" value={String(crt ?? "")} onValueChange={v => setCrt(Number(v) as typeof crt)}><option value="">Selecionar</option><option value="1">1 · Simples Nacional</option><option value="2">2 · Excesso de sublimite</option><option value="3">3 · Regime normal</option><option value="4">4 · MEI</option></SelecaoFormulario></label><label className="grid gap-1.5 text-sm">Inscrição estadual<Input aria-label="Inscrição estadual da empresa" restricao="digitos" maxLength={14} value={ie} onChange={e => setIe(e.target.value)} /></label></fieldset>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={salvando} onClick={() => setEditar(false)}>Cancelar</Button><Button type="submit" variant="entrada" disabled={salvando || !crt}>{salvando ? "Salvando…" : "Salvar"}</Button></div>
  </form>;
}
