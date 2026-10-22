"use client";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { ClassificacaoForm, ComplementoForm, ContextoCatalogoFiscal, PerfilForm, RegraForm, TabelaForm } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import type { ClassificacaoFiscal, ComportamentoFiscal, DadosVersaoFiscal, PainelFiscal, PerfilFiscal, RegraFiscal, TabelaFiscal, TipoVersaoFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import { aplicarManutencaoFiscalAction, revisarManutencaoFiscalAction, salvarManutencaoFiscalAction } from "./manutencao-actions";

type Revisao = Extract<Awaited<ReturnType<typeof revisarManutencaoFiscalAction>>, { ok: true }>;
export function EdicaoFiscalVersionada({ titulo, tipo, chave, inicial, painel, versao, fechar, atualizado }: {
  titulo: string; tipo: TipoVersaoFiscal; chave: string; inicial: DadosVersaoFiscal; painel: PainelFiscal; versao?: VersaoFiscalDto; fechar: () => void; atualizado: () => void;
}) {
  const [dados, setDados] = useState(() => structuredClone(inicial));
  const [vigencia, setVigencia] = useState(() => { const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()); return versao && versao.vigenciaInicio > hoje ? versao.vigenciaInicio : hoje; });
  const [motivo, setMotivo] = useState(versao?.status === "RASCUNHO" ? versao.justificativa : "");
  const [fontes, setFontes] = useState(versao?.fontes.join("\n") ?? "");
  const [ids, setIds] = useState<string[]>(versao?.status === "RASCUNHO" && versao.vigenciaInicio === vigencia ? [versao.id] : []);
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(""), [mensagem, setMensagem] = useState("");
  const trava = useRef(false), operacao = useRef({ assinatura: "", chave: "" });
  const [versaoBase, setVersaoBase] = useState(() => Math.max(0, ...painel.versoes.filter(v => v.tipo === tipo && v.chave === chave).map(v => v.versao)));
  const perfil = tipo === "PERFIL" ? dados as PerfilFiscal : versoesVigentes(painel.versoes, vigencia).find(v => v.tipo === "PERFIL" && v.chave === "singleton")?.dados as PerfilFiscal | undefined;
  function alterar(v: DadosVersaoFiscal) { setDados(v); setIds([]); setRevisao(null); setMensagem(""); }
  async function executar(tarefa: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro("");
    try { await tarefa(); } catch { setErro("Resultado não confirmado. Consulte o histórico antes de repetir. Seu preenchimento foi mantido."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function salvar() {
    const entrada = { tipo, chave, versaoBase, vigenciaInicio: vigencia, dados, justificativa: motivo, fontes: fontes.split(/\r?\n/).map(s => s.trim()).filter(Boolean) };
    const assinatura = JSON.stringify(entrada);
    if (assinatura !== operacao.current.assinatura) operacao.current = { assinatura, chave: crypto.randomUUID() };
    const r = await salvarManutencaoFiscalAction([{ ...entrada, chaveOperacao: operacao.current.chave }]);
    if ("erro" in r) { setErro(r.erro ?? "A operação fiscal não foi concluída."); return; }
    setIds(r.ids); setVersaoBase(v => v + 1); setRevisao(null); setMensagem("Rascunho salvo. A emissão continua usando a configuração vigente até aplicar.");
  }
  return <Card className="vidro-painel"><CardHeader><CardTitle>{titulo}</CardTitle></CardHeader><CardContent className="space-y-5">
    {tipo === "REGRA" && <p className="text-sm text-muted-foreground">Operação: {(dados as RegraFiscal).ufDestino} · {(dados as RegraFiscal).destinatario === "CONTRIBUINTE" ? "Contribuinte ICMS" : "Consumo final"} · {(dados as RegraFiscal).modelo ? `modelo ${(dados as RegraFiscal).modelo}` : "NF-e e NFC-e"}. Confira o alcance nos detalhes abaixo.</p>}
    <fieldset disabled={ocupado} className="min-w-0 space-y-4" onChange={() => { setRevisao(null); setMensagem(""); }}>
      <label className="grid gap-1.5 text-sm">Início da vigência<Input type="date" maxLength={10} value={vigencia} onChange={e => { setVigencia(e.target.value); setIds([]); }} /></label>
      <ContextoCatalogoFiscal.Provider value={{ dia: vigencia, uf: tipo === "REGRA" ? (dados as RegraFiscal).ufDestino : perfil?.uf, crt: perfil?.crt ?? null, ...(tipo === "REGRA" ? { modelo: (dados as RegraFiscal).modelo ? Number((dados as RegraFiscal).modelo) as 55 | 65 : undefined } : {}) }}>
        {tipo === "CLASSIFICACAO" && <ClassificacaoForm identidadeFixa d={dados as ClassificacaoFiscal} mudar={alterar} painel={painel} />}
        {tipo === "REGRA" && <RegraForm d={dados as RegraFiscal} mudar={alterar} painel={painel} />}
        {tipo === "PERFIL" && <PerfilForm d={dados as PerfilFiscal} mudar={alterar} />}
        {tipo === "COMPLEMENTO" && <ComplementoForm d={dados as ComportamentoFiscal} mudar={alterar} painel={painel} />}
        {tipo === "TABELA" && <TabelaForm d={dados as TabelaFiscal} mudar={alterar} />}
      </ContextoCatalogoFiscal.Provider>
      <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">Fundamento e referências</summary>
        <label className="grid gap-1.5 text-sm">Motivo da alteração<Textarea minLength={15} maxLength={4000} value={motivo} onChange={e => { setMotivo(e.target.value); setIds([]); }} /></label>
        <label className="grid gap-1.5 text-sm">Fontes e referências, uma por linha<Textarea maxLength={5000} value={fontes} onChange={e => { setFontes(e.target.value); setIds([]); }} /></label>
      </details>
    </fieldset>
    {mensagem && <p role="status" className="text-sm text-muted-foreground">{mensagem}</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {revisao && <section aria-label="Revisão de impacto" className="space-y-2 rounded-xl border p-4"><h3 className="font-medium">Confira antes de aplicar</h3>{revisao.impactos.flatMap(i => i.resumo).map((s, i) => <p key={i} className="text-sm">{s}</p>)}<p className="text-sm">A prévia de uma futura emissão será recalculada com os valores aplicados.</p></section>}
    <GrupoAcoes className="flex-wrap">
      <Button type="button" variant="outline" disabled={ocupado} onClick={fechar}>Fechar edição</Button>
      <Button type="button" variant="entrada-outline" disabled={ocupado || motivo.trim().length < 15 || ids.length > 0} onClick={() => void executar(salvar)}>{ids.length ? "Rascunho salvo" : "Salvar rascunho"}</Button>
      {ids.length > 0 && <Button type="button" variant="outline" disabled={ocupado} onClick={() => void executar(async () => { const r = await revisarManutencaoFiscalAction(ids); if ("erro" in r) setErro(r.erro ?? "A operação fiscal não foi concluída."); else setRevisao(r); })}>Revisar impacto</Button>}
      {revisao && <Button type="button" variant="entrada" disabled={ocupado} onClick={() => void executar(async () => { const r = await aplicarManutencaoFiscalAction(ids, revisao.hash); if ("erro" in r) { setErro(r.erro ?? "A operação fiscal não foi concluída."); setRevisao(null); } else { atualizado(); fechar(); } })}>Aplicar configuração</Button>}
    </GrupoAcoes>
    {!ids.length && motivo.trim().length < 15 && <p className="text-xs text-muted-foreground">Registre o motivo em Fundamento e referências para salvar. Mínimo de 15 caracteres.</p>}
  </CardContent></Card>;
}
