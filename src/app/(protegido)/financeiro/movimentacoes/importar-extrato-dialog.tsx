"use client";
import { SelecaoFormulario } from "@/components/ui/select";
import { useRef, useState, useTransition } from "react";
import { Upload, Loader2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { linhasCsv, LIMITE_ARQUIVO, type MapaCsv } from "@/lib/financeiro/conciliacao/arquivo";
import type { PreviaExtrato } from "@/lib/financeiro/conciliacao/types";
import { prepararExtratoAction, importarExtratoAction } from "./conciliacao-actions";
import { toast } from "sonner";

const mapaVazio: MapaCsv = { cabecalho: 0, data: -1, descricao: -1, valor: -1, identificador: -1, entrada: -1, saida: -1, formatoData: "BR", formatoValor: "BR", modo: "SINAL" };
export function ImportarExtratoDialog({ contaId, contaNome, aoFechar, aoImportar }: { contaId: string; contaNome: string; aoFechar: () => void; aoImportar: (periodo: { de: string; ate: string }) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [csv, setCsv] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<MapaCsv>(mapaVazio);
  const [previa, setPrevia] = useState<PreviaExtrato | null>(null);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [contaConfirmada, setContaConfirmada] = useState(false);
  const [duplicadasConfirmadas, setDuplicadasConfirmadas] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const leitura = useRef(0);
  async function escolher(file?: File) {
    const versao = ++leitura.current;
    setArquivo(null); setCsv([]); setPrevia(null); setErro(""); setContaConfirmada(false); setDuplicadasConfirmadas(false);
    if (!file) return;
    if (file.size > LIMITE_ARQUIVO || !/\.(ofx|csv)$/i.test(file.name)) { setErro("Selecione um arquivo OFX ou CSV de até 2 MB."); return; }
    try {
      if (/\.csv$/i.test(file.name)) {
        const bytes = await file.arrayBuffer();
        let texto: string; try { texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { texto = new TextDecoder("windows-1252").decode(bytes); }
        const dados = linhasCsv(texto);
        if (versao !== leitura.current) return;
        setCsv(dados);
        const normalizadas = (dados[0] ?? []).map(c => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
        const indice = (nomes: string[]) => normalizadas.findIndex(c => nomes.includes(c));
        setMapa({ ...mapaVazio, data: indice(["data", "date"]), descricao: indice(["descricao", "historico", "description"]), valor: indice(["valor", "amount"]), identificador: indice(["id", "identificador", "fitid"]) });
      }
      if (versao === leitura.current) setArquivo(file);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
  }
  function formulario() { const f = new FormData(); f.set("arquivo", arquivo!); f.set("contaId", contaId); f.set("mapa", JSON.stringify(mapa)); return f; }
  function conferir() { iniciar(async () => { setErro(""); try {
    const r = await prepararExtratoAction(formulario()); if ("erro" in r) { setErro(r.erro); return; }
    setPrevia(r.previa); setSelecionadas(r.previa.linhas.filter(l => l.situacao === "NOVA").map(l => l.indice));
  } catch { setErro("Falha ao preparar o extrato. Tente novamente."); } }); }
  function importar() { iniciar(async () => { setErro(""); try {
    const f = formulario(); f.set("indices", JSON.stringify(selecionadas)); f.set("confirmarConta", contaConfirmada ? "sim" : "nao"); f.set("confirmarDuplicadas", duplicadasConfirmadas ? "sim" : "nao");
    const r = await importarExtratoAction(f); if ("erro" in r) { setErro(r.erro); return; }
    toast.success(`${r.importadas} transação(ões) importada(s). Agora confira e concilie.`, r.linhasSaldoIgnoradas ? { description: r.linhasSaldoIgnoradas === 1 ? "1 linha informativa de saldo foi ignorada." : `${r.linhasSaldoIgnoradas} linhas informativas de saldo foram ignoradas.` } : undefined); aoImportar({ de: r.de, ate: r.ate }); aoFechar();
  } catch { setErro("Falha ao importar. Confira a conexão e tente novamente."); } }); }
  const possiveis = previa?.linhas.filter(l => l.situacao === "POSSIVEL_DUPLICADA" && selecionadas.includes(l.indice)).length ?? 0;
  function coluna(campo: "data" | "descricao" | "valor" | "identificador" | "entrada" | "saida", titulo: string) {
    return <label className="space-y-1 text-xs font-medium" key={campo}><span>{titulo}</span><SelecaoFormulario aria-label={titulo} value={mapa[campo] ?? -1} onValueChange={novoValor => setMapa({ ...mapa, [campo]: Number(novoValor) })}>
      <option value={-1}>Selecionar coluna</option>{(csv[mapa.cabecalho] ?? []).map((c, i) => <option key={i} value={i}>{i + 1}. {c || "Sem título"}</option>)}
    </SelecaoFormulario></label>;
  }
  return <Dialog open onOpenChange={aberto => { if (!aberto && !pendente) aoFechar(); }}><DialogContent showCloseButton={!pendente} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="size-5" />Importar extrato bancário</DialogTitle><DialogDescription>Conta de destino: <strong>{contaNome}</strong>. Importar organiza a conferência; os saldos só mudam ao realizar lançamentos.</DialogDescription></DialogHeader>
    {!previa ? <>
      <div className="space-y-2 rounded-xl border border-dashed bg-muted/30 p-5"><Label htmlFor="arquivo-extrato">Arquivo do banco</Label><Input id="arquivo-extrato" type="file" accept=".ofx,.csv" disabled={pendente} onChange={e => escolher(e.target.files?.[0])} /><p className="text-xs text-muted-foreground">OFX de conta bancária em reais ou CSV · até 2 MB e 2.000 transações.</p></div>
      {arquivo && csv.length > 0 && <fieldset disabled={pendente} className="space-y-3"><legend className="font-medium">Confira as colunas do CSV</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium">Linha dos títulos<SelecaoFormulario aria-label="Linha dos títulos" value={mapa.cabecalho} onValueChange={novoValor => setMapa({ ...mapaVazio, cabecalho: Number(novoValor) })}>{csv.slice(0, 21).map((_, i) => <option key={i} value={i}>Linha {i + 1}</option>)}</SelecaoFormulario></label>
        <label className="space-y-1 text-xs font-medium">Formato da data<SelecaoFormulario aria-label="Formato da data" value={mapa.formatoData} onValueChange={novoValor => setMapa({ ...mapa, formatoData: novoValor as "BR" | "ISO" })}><option value="BR">dd/mm/aaaa</option><option value="ISO">aaaa-mm-dd</option></SelecaoFormulario></label>
        <label className="space-y-1 text-xs font-medium">Formato do valor<SelecaoFormulario aria-label="Formato do valor" value={mapa.formatoValor} onValueChange={novoValor => setMapa({ ...mapa, formatoValor: novoValor as "BR" | "US" })}><option value="BR">1.234,56</option><option value="US">1,234.56</option></SelecaoFormulario></label>
        {coluna("data", "Data")}{coluna("descricao", "Descrição")}{coluna("identificador", "Identificador único (opcional)")}
        <label className="space-y-1 text-xs font-medium">Valores do extrato<SelecaoFormulario aria-label="Valores do extrato" value={mapa.modo} onValueChange={novoValor => setMapa({ ...mapa, modo: novoValor as "SINAL" | "COLUNAS" })}><option value="SINAL">Uma coluna com sinal +/−</option><option value="COLUNAS">Entrada e saída separadas</option></SelecaoFormulario></label>
        {mapa.modo === "SINAL" ? coluna("valor", "Valor com sinal") : <>{coluna("entrada", "Entrada")}{coluna("saida", "Saída")}</>}
      </div><p className="text-xs text-muted-foreground">Na coluna única, entradas são positivas e saídas negativas. Linhas “Saldo do dia” e “Saldo anterior” são ignoradas automaticamente; outros saldos e totais devem ser retirados.</p></fieldset>}
    </> : <>
      <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="flex items-center gap-2 font-medium"><FileCheck2 className="size-4" />{previa.nomeArquivo}</p>{previa.referenciaOfx && <p className="mt-1 break-all">Banco / agência / conta no arquivo: {previa.referenciaOfx}</p>}<p className="mt-1 text-muted-foreground">{selecionadas.length} selecionadas · {previa.linhas.filter(l => l.situacao === "EXISTENTE").length} já importadas · {previa.linhas.filter(l => l.situacao === "POSSIVEL_DUPLICADA").length} possíveis duplicadas</p>{previa.linhasSaldoIgnoradas > 0 && <p className="mt-1 text-muted-foreground">{previa.linhasSaldoIgnoradas === 1 ? "1 linha informativa de saldo será ignorada." : `${previa.linhasSaldoIgnoradas} linhas informativas de saldo serão ignoradas.`}</p>}</div>
      <div className="max-h-64 overflow-auto rounded-xl border divide-y" aria-label="Transações para importar">{previa.linhas.map(l => <label key={l.indice} className="flex items-start gap-3 p-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-blue-600" aria-label={`Importar ${l.descricao} linha ${l.indice + 1}`} disabled={pendente || l.situacao === "EXISTENTE"} checked={selecionadas.includes(l.indice)} onChange={e => setSelecionadas(e.target.checked ? [...selecionadas, l.indice] : selecionadas.filter(i => i !== l.indice))} />
        <span className="min-w-0 flex-1"><span className="block break-words">{l.descricao}</span><small className="text-muted-foreground">{l.data.split("-").reverse().join("/")} · {l.situacao === "NOVA" ? "Nova transação" : l.situacao === "EXISTENTE" ? (l.conciliada ? "Já conciliada — vínculo preservado" : "Já importada") : "Possível duplicada — conferir"}</small>{l.observacao && <small className="mt-1 block text-amber-800 dark:text-amber-300">{l.observacao}</small>}</span><strong className={`shrink-0 tabular-nums ${l.centavos < 0 ? "text-destructive" : "text-emerald-700"}`}>{formatarMoeda(l.centavos / 100)}</strong>
      </label>)}</div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={contaConfirmada} disabled={pendente} onChange={e => setContaConfirmada(e.target.checked)} />Confirmei que este extrato pertence à conta {contaNome}.</label>
      {possiveis > 0 && <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" className="mt-1 size-4 shrink-0" disabled={pendente} checked={duplicadasConfirmadas} onChange={e => setDuplicadasConfirmadas(e.target.checked)} />Conferi as {possiveis} possíveis duplicadas selecionadas e confirmo que são transações diferentes.</label>}
    </>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={() => previa ? setPrevia(null) : aoFechar()}>{previa ? "Revisar arquivo" : "Cancelar"}</Button><Button type="button" disabled={pendente || !arquivo || (!!previa && (!selecionadas.length || !contaConfirmada || (possiveis > 0 && !duplicadasConfirmadas)))} onClick={previa ? importar : conferir}>{pendente && <Loader2 className="size-4 animate-spin" />}{previa ? `Importar ${selecionadas.length} transações` : "Conferir extrato"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
