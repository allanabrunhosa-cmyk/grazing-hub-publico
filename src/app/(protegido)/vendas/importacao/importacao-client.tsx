"use client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Upload, FileCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabecalhoVendas, Check } from "../componentes";
import type { previaImportacao } from "@/lib/vendas/importacao";
import { prepararImportacaoVendaAction, aplicarImportacaoVendaAction } from "./actions";

type Previa = Awaited<ReturnType<typeof previaImportacao>>;
const nomes = { NOVO: "Novo", ATUALIZAR: "Atualizar", MANTER: "Sem alteração", CONFLITO: "Revisar conflito" };
const entidades = { CATEGORIA: "Categoria", GRUPO: "Complementos", PRODUTO: "Produto" };
export function ImportacaoCatalogo({ aplicar }: { aplicar: boolean }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, iniciar] = useTransition();
  function conferir() {
    setErro(""); setResultado(""); setPrevia(null); setConfirmado(false);
    if (!arquivo || arquivo.size > 2_000_000) { setErro("Escolha um pacote JSON de catálogo de até 2 MB."); return; }
    iniciar(async () => {
      try {
        const texto = await arquivo.text();
        const resposta = await prepararImportacaoVendaAction(texto);
        if (resposta.erro) setErro(resposta.erro);
        else if (resposta.previa) { setConteudo(texto); setPrevia(resposta.previa); }
      } catch { setErro("Não foi possível conferir o pacote. Nenhum cadastro foi alterado."); }
    });
  }
  function importar() {
    if (!previa || !confirmado) return;
    iniciar(async () => {
      try {
        const resposta = await aplicarImportacaoVendaAction(conteudo, previa.token);
        if (resposta.erro) { setErro(resposta.erro); setConfirmado(false); }
        else if (resposta.resultado) {
          const r = resposta.resultado;
          setResultado(`${r.aplicados} registro(s) aplicado(s); ${r.manter} sem alteração; ${r.conflitos} conflito(s) preservado(s) para revisão. Produtos novos estão inativos, com fiscal e composição pendentes.`);
          setPrevia(null); setConfirmado(false); setErro("");
        }
      } catch { setErro("Não foi possível confirmar o resultado. Gere a prévia novamente: identidades já importadas não serão duplicadas."); setConfirmado(false); }
    });
  }
  return <div className="space-y-5">
    <CabecalhoVendas titulo="Importação do catálogo" descricao="Confira a origem, preserve edições locais e importe sem duplicar identidades." />
    <div className="rounded-2xl border bg-card p-5 text-sm leading-relaxed">
      Use um pacote JSON normalizado do HUB, preparado a partir de dados conferidos do iFood ou da Takeat. Exportações de outros formatos precisam de adaptação; esta tela não acessa nem altera essas plataformas.
      <p className="mt-2 text-muted-foreground">Nomes e códigos PDV repetidos não unem produtos automaticamente. Fotos, receitas e classificações fiscais não são presumidas. Extras é normalizado para opcional e ilimitado.</p>
    </div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5">
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">Pacote de catálogo (.json)
        <input type="file" accept=".json,application/json" disabled={ocupado} className="max-w-full text-sm" onChange={e => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); setConfirmado(false); setResultado(""); setErro(""); }} />
      </label>
      <Button onClick={conferir} disabled={ocupado || !arquivo}><FileCheck className="size-4" />{ocupado ? "Processando…" : "Gerar prévia"}</Button>
    </div>
    {erro && <p role="alert" className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{erro}</p>}
    {resultado && <div role="status" className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><p>{resultado}</p><Link className="underline" href="/vendas/produtos?situacao=inativos">Conferir produtos importados</Link></div>}
    {previa && <>
      <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">{previa.pacote.origem} · {previa.pacote.loja}</h2><p className="mt-1 break-words text-xs text-muted-foreground">{previa.pacote.referencia}</p><p className="mt-3 text-sm">{previa.contagens.novos} novos · {previa.contagens.atualizar} para atualizar · {previa.contagens.manter} sem alteração · {previa.contagens.conflitos} conflitos</p></div>
      <div className="max-h-[55vh] overflow-auto rounded-2xl border bg-card"><Table className="w-full text-left text-sm"><TableHeader className="sticky top-0 bg-muted"><TableRow><TableHead className="p-3">Cadastro</TableHead><TableHead className="p-3">Situação</TableHead><TableHead className="p-3">Conferência</TableHead></TableRow></TableHeader><TableBody>{previa.linhas.map(l => <TableRow key={`${l.entidade}:${l.chave}`} className="border-t align-top"><TableCell className="p-3"><span className="font-medium">{l.nome}</span><small className="mt-1 block text-muted-foreground">{entidades[l.entidade]}</small></TableCell><TableCell className={`p-3 ${l.situacao === "CONFLITO" ? "font-semibold text-destructive" : "text-primary"}`}>{nomes[l.situacao]}</TableCell><TableCell className="min-w-52 p-3 text-muted-foreground">{l.motivo}</TableCell></TableRow>)}</TableBody></Table></div>
      <div className="space-y-4 rounded-2xl border bg-card p-5"><Check disabled={ocupado || !aplicar} checked={confirmado} onChange={e => setConfirmado(e.target.checked)}>Conferi a prévia. Importar somente registros sem conflito e manter produtos novos inativos para revisão.</Check>
        <div className="flex flex-wrap gap-2"><Button disabled={ocupado || !aplicar || !confirmado || !(previa.contagens.novos + previa.contagens.atualizar)} onClick={importar}><Upload className="size-4" />{ocupado ? "Importando…" : "Aplicar registros sem conflito"}</Button><Button variant="outline" disabled={ocupado} onClick={conferir}><RefreshCw className="size-4" />Atualizar prévia</Button></div>
        {!aplicar && <p className="text-xs text-muted-foreground">Para aplicar, é necessário adicionar e editar produtos/catálogo, além da permissão de importação.</p>}
      </div>
    </>}
  </div>;
}
