"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoEntrega, EscolhaEntrega } from "./campos-entrega";
import { salvarTipoEmbalagemAction } from "@/app/(protegido)/vendas/produtos/embalagens-actions";
import type { TipoEmbalagem } from "@/lib/vendas/embalagens";

export function TipoEmbalagemCampo({ valor, alterar, tipos, podeCriar = false, padraoProduto = false, nome = "Tipo de embalagem", aoCriar }: { valor?: string | null; alterar: (v: string | null | undefined) => void; tipos: TipoEmbalagem[]; podeCriar?: boolean; padraoProduto?: boolean; nome?: string; aoCriar?: (v: TipoEmbalagem) => void }) {
  const [locais, setLocais] = useState<TipoEmbalagem[]>([]), [novo, setNovo] = useState(false), [texto, setTexto] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false), trava = useRef(false);
  const lista = [...new Map([...tipos, ...locais].map(v => [v.id, v])).values()];
  async function criar() {
    if (trava.current) return; trava.current = true; setOcupado(true); setErro("");
    try { const r = await salvarTipoEmbalagemAction({ id: "", nome: texto, ativo: true, versao: 0 }); if ("erro" in r) setErro(r.erro ?? "Não foi possível salvar."); else { setLocais(a => [...a, r.embalagem]); alterar(r.embalagem.id); aoCriar?.(r.embalagem); setNovo(false); setTexto(""); } }
    catch { setErro("Não foi possível salvar. Seu preenchimento foi mantido."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <div className="space-y-2"><EscolhaEntrega nome={nome} valor={valor === undefined && padraoProduto ? "PADRAO" : valor ?? "SEM"} opcoes={[...(padraoProduto ? [{ value: "PADRAO", label: "Usar embalagem do produto" }] : []), { value: "SEM", label: "Não informada" }, ...lista.filter(v => v.ativo || v.id === valor).map(v => ({ value: v.id, label: `${v.nome}${v.ativo ? "" : " (inativa)"}` }))]} alterar={v => alterar(v === "PADRAO" ? undefined : v === "SEM" ? null : v)} />
    {podeCriar && !novo && <Button variant="outline" size="sm" onClick={() => setNovo(true)}>Criar tipo de embalagem</Button>}
    {novo && <div className="space-y-2 rounded-xl border p-3"><CampoEntrega nome="Nome do novo tipo de embalagem"><Input value={texto} maxLength={80} onChange={e => setTexto(e.target.value)} disabled={ocupado} /></CampoEntrega><div className="flex flex-wrap gap-2"><Button size="sm" disabled={ocupado || !texto.trim()} onClick={() => void criar()}>Salvar tipo de embalagem</Button><Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setNovo(false); setErro(""); }}>Cancelar</Button></div>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}</div>}
  </div>;
}
