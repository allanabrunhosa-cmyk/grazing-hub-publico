"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DecisaoFciFiscal } from "@/lib/tributacao/tipos";

const ufs = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
const numeroFci = "[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}";
const novaDecisao = (): DecisaoFciFiscal => ({ situacao: "PENDENTE", numero: null, periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, justificativa: "", fontes: [], evidencias: [] });
function CampoLinhas({ nome, valores, mudar }: { nome: string; valores: string[]; mudar: (v: string[]) => void }) {
  const [texto, setTexto] = useState(valores.join("\n"));
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{nome}<Textarea maxLength={5000} value={texto} onChange={e => {
    const novo = e.target.value, itens = novo.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    if (itens.length > 50 || itens.some(v => v.length > 2000 || /[\p{C}<>]/u.test(v))) return;
    setTexto(novo); mudar(itens);
  }} /></label>;
}

function CampoDecimal({ nome, valor, mudar, percentual = false }: { nome: string; valor: string | null; mudar: (v: string | null) => void; percentual?: boolean }) {
  const casas = percentual ? 4 : 8;
  function aceita(v: string) { return new RegExp(`^\\d{0,${percentual ? 3 : 12}}(?:[.,]\\d{0,${casas}})?$`).test(v) && (!percentual || !v || Number(v.replace(",", ".")) <= 100); }
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{nome}<Input inputMode="decimal" restricao="decimal" casasDecimais={casas} min={0} max={percentual ? 100 : undefined} maxLength={percentual ? 8 : 21} pattern={percentual ? "[0-9]{1,3}([.][0-9]{1,4})?" : "[0-9]{1,12}([.][0-9]{1,8})?"} value={valor ?? ""}
    onKeyDown={e => { const campo = e.currentTarget, proposta = campo.value.slice(0, campo.selectionStart ?? 0) + e.key + campo.value.slice(campo.selectionEnd ?? campo.value.length); if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !aceita(proposta)) e.preventDefault(); }}
    onPaste={e => { const campo = e.currentTarget, proposta = campo.value.slice(0, campo.selectionStart ?? 0) + e.clipboardData.getData("text") + campo.value.slice(campo.selectionEnd ?? campo.value.length); if (!aceita(proposta)) e.preventDefault(); }}
    onChange={e => { if (aceita(e.target.value)) mudar(e.target.value ? e.target.value.replace(",", ".") : null); else e.target.value = valor ?? ""; }} /></label>;
}

function DeclaracaoFciResponsavel({ valor }: { valor: DecisaoFciFiscal }) {
  const declaracao = valor.declaracaoResponsavel, registro = declaracao?.registro;
  return <Card role="region" aria-label="Declaração administrativa de origem e FCI">
    <CardHeader><CardTitle>Declaração administrativa de origem e FCI</CardTitle><CardDescription>Declarado pelo responsável, sem apuração CI/FCI comprovada. A leitura não aprova parâmetros fiscais nem amplia o alcance da declaração.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <Badge variant="outline">Declaração do responsável</Badge>
      {declaracao ? <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Origem ICMS declarada</dt><dd>{declaracao.origem}</dd></div>
        <div><dt className="text-muted-foreground">GTIN declarado</dt><dd>{declaracao.gtin}</dd></div>
        <div><dt className="text-muted-foreground">Alcance da operação</dt><dd>{declaracao.ufEmitente} → {declaracao.ufDestino} · Modelo {declaracao.modelos.join(", ")}</dd></div>
        <div><dt className="text-muted-foreground">Vigência inicial</dt><dd>{declaracao.vigenciaInicio}</dd></div>
        <div><dt className="text-muted-foreground">Responsável declarado</dt><dd>{registro?.responsavel.nome ?? "Registro de autoria ainda não selado"}</dd></div>
        <div><dt className="text-muted-foreground">Registro executado por</dt><dd>{registro ? `${registro.executor.nome} · ${registro.executor.identificacao}` : "Registro ainda não selado"}</dd></div>
        {registro && <div><dt className="text-muted-foreground">Registrada em</dt><dd>{new Date(registro.registradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)</dd></div>}
      </dl> : <p role="status" className="text-sm text-muted-foreground">O registro da declaração não está disponível. Esta leitura não comprova uma dispensa.</p>}
      <p className="text-xs text-muted-foreground">A declaração não se estende a outros produtos, destinos ou modelos. A NFC-e 65 exige homologação própria. Alterações materiais exigem nova revisão no fluxo autorizado.</p>
      <details><summary className="cursor-pointer text-xs text-muted-foreground">Registro e justificativa da declaração</summary><p className="mt-2 text-xs text-muted-foreground">{valor.justificativa}</p>{declaracao && <p className="mt-2 text-xs text-muted-foreground">{declaracao.referenciaInstrucao}</p>}{registro && <p className="mt-2 break-all text-xs text-muted-foreground">Versão {registro.versaoId} · Revisão {registro.versao} · Hash {registro.hashConteudo}</p>}</details>
    </CardContent>
  </Card>;
}

/** Rascunho da classificação canônica. Não calcula CI, gera FCI ou aprova regras. */
export function FciClassificacaoForm({ origem, valor, mudar }: { origem: string | null; valor: DecisaoFciFiscal | undefined; mudar: (v: DecisaoFciFiscal | undefined) => void }) {
  const [rascunho, setRascunho] = useState(valor);
  const [numeroAnterior, setNumeroAnterior] = useState(valor?.numero ?? null);
  const [dispensaAnterior, setDispensaAnterior] = useState(valor?.dispensa);
  if (valor?.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL") return <DeclaracaoFciResponsavel valor={valor} />;
  if (valor?.repasseFornecedor) return <Card role="region" aria-label="FCI recebida do fornecedor">
    <CardHeader><CardTitle>FCI recebida do fornecedor</CardTitle><CardDescription>Controle transcrito das notas de entrada. O servidor confere a origem e os documentos vinculados ao salvar e ativar esta classificação.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <Badge variant="outline">Repasse sem nova industrialização</Badge>
      <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted-foreground">Número de controle da FCI</dt><dd className="break-all">{valor.numero}</dd></div>
        <div><dt className="text-muted-foreground">Entradas conferidas</dt><dd>{valor.repasseFornecedor.registro?.documentos.length ?? "Aguardando conferência no servidor"}</dd></div>
        <div><dt className="text-muted-foreground">Modelos compatíveis</dt><dd>NF-e 55 e NFC-e 65</dd></div>
        <div><dt className="text-muted-foreground">Origem da mercadoria</dt><dd>{origem}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Não há apuração própria de conteúdo de importação neste registro. Mudanças no produto ou nas entradas exigem nova conferência.</p>
      <Button variant="outline" onClick={() => mudar({ ...novaDecisao(), justificativa: valor.justificativa, fontes: valor.fontes, evidencias: valor.evidencias })}>Revisar decisão de FCI</Button>
    </CardContent>
  </Card>;
  if (!valor && !["0", "3", "5", "8"].includes(origem ?? "")) return null;
  function alterar(parcial: Partial<DecisaoFciFiscal>) { if (valor) mudar({ ...valor, ...parcial, apuracaoCompleta: false }); }
  const fonteOficial = valor?.fontes.some(f => { try { const u = new URL(f); return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "gov.br" || u.hostname.endsWith(".gov.br")); } catch { return false; } });
  const baseDocumentada = Boolean(valor?.periodoApuracao && valor.conteudoImportacao !== null && valor.valorParcelaImportada !== null && valor.valorSaidaReferencia !== null && fonteOficial && valor.evidencias.length);
  return <details className="space-y-3 rounded-[var(--ds-cartao-raio)] border p-4"><summary className="cursor-pointer text-sm font-medium">Avançado: Conteúdo de Importação e FCI</summary>
    <p className="text-xs text-muted-foreground">Origens 3, 5 e 8 exigem decisão documentada sobre conteúdo de importação e FCI. O custo da receita e o preço do pedido não substituem a apuração normativa. Registrar este rascunho não autoriza emissão.</p>
    {origem === "0" && <p className="text-xs text-muted-foreground">Produção nacional não comprova ausência de insumos importados ou dispensa de FCI. Registre a decisão quando essa análise for aplicável. Este campo é opcional; não cria FCI para todo produto nacional.</p>}
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(valor)} onCheckedChange={checked => { if (checked) mudar(rascunho ?? novaDecisao()); else { setRascunho(valor); mudar(undefined); } }} />{origem === "0" ? "Há insumos importados ou decisão FCI para este item" : "Registrar decisão de FCI deste item"}</label>
    {valor && <div className="space-y-4">
      <label className="grid gap-1.5 text-sm font-medium">Situação da decisão de FCI<SelecaoFormulario aria-label="Situação da decisão de FCI" value={valor.situacao} onValueChange={v => {
        const situacao = v as DecisaoFciFiscal["situacao"];
        if (valor.numero) setNumeroAnterior(valor.numero);
        if (valor.dispensa) setDispensaAnterior(valor.dispensa);
        alterar({ situacao, numero: situacao === "EXIGIDA" ? valor.numero ?? numeroAnterior : null, dispensa: situacao === "DISPENSADA_COM_FUNDAMENTO" ? valor.dispensa ?? dispensaAnterior ?? { ufEmitente: "", ufDestino: "", modelos: [] } : undefined });
      }}><option value="PENDENTE">Pendente de apuração ou fundamento</option><option value="EXIGIDA">FCI exigida nesta operação</option><option value="DISPENSADA_COM_FUNDAMENTO">Dispensa delimitada e fundamentada</option></SelecaoFormulario></label>
      {valor.situacao === "EXIGIDA" && <label className="grid gap-1.5 text-sm font-medium">Número de controle da FCI<Input aria-label="Número de controle da FCI" maxLength={36} pattern={numeroFci} autoCapitalize="characters" autoComplete="off" spellCheck={false} value={valor.numero ?? ""}
        onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !/^[A-Fa-f0-9-]$/.test(e.key)) e.preventDefault(); }}
        onPaste={e => { const campo = e.currentTarget, proposta = campo.value.slice(0, campo.selectionStart ?? 0) + e.clipboardData.getData("text") + campo.value.slice(campo.selectionEnd ?? campo.value.length); if (proposta.length > 36 || !/^[A-Fa-f0-9-]*$/.test(proposta)) e.preventDefault(); }}
        onChange={e => { if (/^[A-Fa-f0-9-]*$/.test(e.target.value)) alterar({ numero: e.target.value.toUpperCase() || null }); }} /><span className="text-xs font-normal text-muted-foreground">Informe somente o controle recebido no canal oficial, com sua evidência. O HUB não gera este número.</span></label>}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">Período da apuração de CI<Input type="month" min="2000-01" maxLength={7} value={valor.periodoApuracao ?? ""} onChange={e => alterar({ periodoApuracao: e.target.value || null })} /></label>
        <CampoDecimal nome="Conteúdo de importação (%)" percentual valor={valor.conteudoImportacao} mudar={v => alterar({ conteudoImportacao: v })} />
        <CampoDecimal nome="Valor normativo da parcela importada (R$)" valor={valor.valorParcelaImportada} mudar={v => alterar({ valorParcelaImportada: v })} />
        <CampoDecimal nome="Valor de saída de referência normativa (R$)" valor={valor.valorSaidaReferencia} mudar={v => alterar({ valorSaidaReferencia: v })} />
      </div>
      {valor.situacao === "DISPENSADA_COM_FUNDAMENTO" && valor.dispensa && <div className="space-y-3"><p className="text-sm font-medium">Alcance comprovado da dispensa</p><div className="grid gap-4 sm:grid-cols-2">{(["ufEmitente", "ufDestino"] as const).map(campo => <label key={campo} className="grid gap-1.5 text-sm font-medium">{campo === "ufEmitente" ? "UF do emitente na dispensa" : "UF do destinatário na dispensa"}<SelecaoFormulario aria-label={campo === "ufEmitente" ? "UF do emitente na dispensa" : "UF do destinatário na dispensa"} value={valor.dispensa![campo]} onValueChange={v => alterar({ dispensa: { ...valor.dispensa!, [campo]: v } })}><option value="">Selecione a UF comprovada</option>{ufs.map(uf => <option key={uf} value={uf}>{uf}</option>)}</SelecaoFormulario></label>)}</div>
        <div className="flex flex-wrap gap-4">{(["55", "65"] as const).map(modelo => <label key={modelo} className="flex items-center gap-2 text-sm"><Checkbox checked={valor.dispensa!.modelos.includes(modelo)} onCheckedChange={checked => alterar({ dispensa: { ...valor.dispensa!, modelos: checked ? [...valor.dispensa!.modelos, modelo] : valor.dispensa!.modelos.filter(v => v !== modelo) } })} />{modelo === "55" ? "Dispensa para NF-e 55" : "Dispensa para NFC-e 65"}</label>)}</div><p className="text-xs text-muted-foreground">A dispensa não se estende automaticamente a outra UF, modelo ou operação.</p></div>}
      <label className="grid gap-1.5 text-sm font-medium">Fundamentação da decisão de FCI<Textarea required maxLength={2000} value={valor.justificativa} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} onPaste={e => { if (/[\p{C}<>]/u.test(e.clipboardData.getData("text"))) e.preventDefault(); }} onChange={e => { if (!/[\p{C}<>]/u.test(e.target.value)) alterar({ justificativa: e.target.value }); else e.target.value = valor.justificativa; }} /></label>
      <p className="text-xs text-muted-foreground">Use um parágrafo, sem HTML. A decisão concluída exige fonte oficial HTTPS gov.br. Registre referências dos comprovantes nas evidências, sem colar documentos ou segredos.</p>
      <CampoLinhas nome="Fontes da decisão de FCI (uma por linha)" valores={valor.fontes} mudar={v => alterar({ fontes: v })} />
      <CampoLinhas nome="Evidências da apuração e do controle FCI (uma por linha)" valores={valor.evidencias} mudar={v => alterar({ evidencias: v })} />
      <label className="flex items-center gap-2 text-sm"><Checkbox disabled={!baseDocumentada && !valor.apuracaoCompleta} checked={valor.apuracaoCompleta} onCheckedChange={checked => mudar({ ...valor, apuracaoCompleta: checked })} />Apuração normativa completa e documentada</label>
      <p className="text-xs text-muted-foreground">Informe valores normativos comprovados. A validação confere formato, período, proporção do CI e alcance da dispensa. Alterar os dados exige nova conferência. Salvar conserva a versão anterior; aprovação interna ocorre no fluxo de revisão.</p>
    </div>}
  </details>;
}
