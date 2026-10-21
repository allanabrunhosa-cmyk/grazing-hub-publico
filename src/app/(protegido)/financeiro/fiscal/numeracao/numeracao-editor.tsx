"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelecaoFormulario } from "@/components/ui/select";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORIAS_DIAGNOSTICO_BRASILNFE, sanitizarMetadadosErroBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";
import type { AtualizacaoNumeracaoBrasilNfeDto, ComandoAtualizacaoNumeracaoBrasilNfe, NumeracaoFiscalBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";

export type ResultadoAtualizarNumeracao = { ok: true; dados: NumeracaoFiscalBrasilNfeDto } | { erro: string; conferenciaNecessaria?: true };
export type AcaoAtualizarNumeracao = (entrada: ComandoAtualizacaoNumeracaoBrasilNfe) => Promise<ResultadoAtualizarNumeracao>;
const estados = { EM_ANDAMENTO: "Atualização em andamento", CONFIRMADA: "Configuração confirmada", PENDENTE_CONFERENCIA: "Resultado pendente de conferência", RECUSADA: "Configuração não confirmada" } as const;
const datas = (v: string | null) => v ? `${new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)` : "Não confirmada";
const vazio = { modelo: "", ambiente: "", serie: "", proximoNumero: "", padrao: "" };
function preencherContador(dados: NumeracaoFiscalBrasilNfeDto, modelo?: string, ambiente?: string, serie?: string) {
  const candidatas = dados.linhas.filter(l => (!modelo || String(l.modelo) === modelo) && (!ambiente || String(l.ambiente) === ambiente));
  const linha = serie !== undefined ? candidatas.find(l => Number(l.serie) === Number(serie) && serie !== "") : candidatas.find(l => l.padrao && l.modelo === 55 && l.ambiente === 1) ?? candidatas.find(l => l.padrao) ?? candidatas[0];
  return linha ? { modelo: String(linha.modelo), ambiente: String(linha.ambiente), serie: serie ?? linha.serie, proximoNumero: linha.proximoNumero, padrao: linha.padrao ? "SIM" : "NAO" } : { ...vazio, modelo: modelo ?? "", ambiente: ambiente ?? "", serie: serie ?? "" };
}
function consultaRecente(dados: NumeracaoFiscalBrasilNfeDto) {
  const timestamp = dados.consulta.consultadoEm ? Date.parse(dados.consulta.consultadoEm) : NaN;
  const idade = Date.now() - timestamp;
  return dados.consulta.situacao === "CONCLUIDA" && Number.isFinite(timestamp) && idade <= 300000 && idade >= -30000;
}

function ResultadoNumeracao({ atualizacao }: { atualizacao: AtualizacaoNumeracaoBrasilNfeDto }) {
  const falha = sanitizarMetadadosErroBrasilNfe(atualizacao.falha);
  const anterior = atualizacao.contexto === "ANTERIOR";
  return <section aria-label={anterior ? "Registro histórico da atualização de numeração" : "Resultado da atualização de numeração"} className="space-y-2 text-sm">
    {anterior && <p className="font-medium">Configuração anterior — registro histórico</p>}
    <div role="status"><Badge variant={anterior ? "outline" : atualizacao.situacao === "CONFIRMADA" ? "success" : "warning"}>{anterior ? `Estado registrado: ${estados[atualizacao.situacao]}` : estados[atualizacao.situacao]}</Badge></div>
    <p>{atualizacao.modelo === 55 ? "NF-e 55" : "NFC-e 65"} · {atualizacao.ambiente === 2 ? "Homologação · 2" : "Produção · 1"} · Série {atualizacao.serie} · Próximo número solicitado: {atualizacao.proximoNumero} · Padrão: {atualizacao.padrao ? "Sim" : "Não"}.</p>
    <p className="text-xs text-muted-foreground">Solicitada em {datas(atualizacao.solicitadoEm)}. Confirmação por consulta posterior: {datas(atualizacao.confirmadoEm)}.</p>
    {falha && <p className="text-sm text-destructive">{CATEGORIAS_DIAGNOSTICO_BRASILNFE[falha.categoria]}{falha.httpStatus !== null ? ` · HTTP ${falha.httpStatus}` : ""}.{anterior ? " Falha registrada na configuração anterior." : " O resultado exige conferência; não repita a atualização."}</p>}
    {anterior ? <p className="text-xs text-muted-foreground">Este registro preserva o estado e as datas de outra configuração. Não comprova o contador atual nem libera uma nova atualização.</p> : atualizacao.situacao === "CONFIRMADA" ? <p className="text-xs text-muted-foreground">O fornecedor confirmou os parâmetros por uma nova leitura. Nenhum número foi reservado e nenhuma nota foi emitida.</p> : <p className="text-xs text-muted-foreground">Use Consultar numeração para conferir o estado externo antes de uma nova configuração. Uma falha não comprova que o contador permaneceu igual.</p>}
  </section>;
}

export function EditorNumeracaoFiscal({ dados, ocupado, atualizar }: { dados: NumeracaoFiscalBrasilNfeDto; ocupado: boolean; atualizar: AcaoAtualizarNumeracao }) {
  const id = useId(), trava = useRef(false), operacao = useRef({ assinatura: "", id: "" });
  const [form, definirForm] = useState(() => preencherContador(dados)), [erro, definirErro] = useState("");
  const [assinaturaConfirmada, definirConfirmada] = useState("");
  const [aguardarConsulta, definirAguardarConsulta] = useState<{ consultadoEm: string | null } | null>(null);
  const assinatura = JSON.stringify([dados.versaoConfiguracao, form]);
  const recente = consultaRecente(dados);
  const pendente = dados.atualizacao?.contexto !== "ANTERIOR" && (dados.atualizacao?.situacao === "PENDENTE_CONFERENCIA" || dados.atualizacao?.situacao === "EM_ANDAMENTO");
  const consultaNecessaria = Boolean(aguardarConsulta && aguardarConsulta.consultadoEm === dados.consulta.consultadoEm);
  const camposValidos = ["55", "65"].includes(form.modelo) && ["1", "2"].includes(form.ambiente) && /^\d{1,3}$/.test(form.serie) && /^[1-9]\d{0,8}$/.test(form.proximoNumero) && ["SIM", "NAO"].includes(form.padrao);
  const bloqueado = ocupado || pendente || consultaNecessaria || !recente || dados.versaoConfiguracao < 1;
  const existente = dados.consulta.situacao === "CONCLUIDA" ? dados.linhas.find(l => String(l.modelo) === form.modelo && String(l.ambiente) === form.ambiente && /^\d{1,3}$/.test(form.serie) && Number(l.serie) === Number(form.serie)) : null;
  let motivoNumero: string | null = null;
  if (recente && camposValidos) {
    if (!existente && form.proximoNumero !== "1") motivoNumero = "Uma série não localizada na consulta só pode iniciar em 1. O servidor também confere documentos anteriores do HUB.";
    else if (existente && /^\d+$/.test(existente.proximoNumero) && BigInt(form.proximoNumero) < BigInt(existente.proximoNumero)) motivoNumero = "O próximo número não pode ser menor que o contador consultado. Não é permitido reiniciar uma série utilizada.";
    else if (existente?.ultimaAutorizadaLocal && /^\d+$/.test(existente.ultimaAutorizadaLocal.numero) && BigInt(form.proximoNumero) <= BigInt(existente.ultimaAutorizadaLocal.numero)) motivoNumero = "O próximo número deve superar a última autorização comprovada no HUB para esta série, modelo e ambiente.";
  }
  const parametrosIguais = Boolean(recente && !motivoNumero && existente && existente.proximoNumero === form.proximoNumero && existente.padrao === (form.padrao === "SIM") && ["SIM", "NAO"].includes(form.padrao));
  function mudar(campo: keyof typeof vazio, valor: string) {
    definirErro("");
    definirForm(anterior => {
      if (campo === "serie") {
        const contador = preencherContador(dados, anterior.modelo, anterior.ambiente, valor);
        return { ...contador, padrao: contador.padrao || anterior.padrao };
      }
      return campo === "modelo" || campo === "ambiente" ? preencherContador(dados, campo === "modelo" ? valor : anterior.modelo, campo === "ambiente" ? valor : anterior.ambiente) : { ...anterior, [campo]: valor };
    });
  }
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (trava.current || ocupado || assinaturaConfirmada === assinatura || parametrosIguais) return;
    if (pendente || consultaNecessaria) { definirErro("Consulte a numeração e confira o resultado anterior antes de salvar outra configuração."); return; }
    if (!consultaRecente(dados) || dados.versaoConfiguracao < 1 || !dados.consulta.consultadoEm) { definirErro("Consulte a numeração desta configuração antes de salvar. A leitura deve ter até cinco minutos."); return; }
    if (!camposValidos) { definirErro("Selecione modelo, ambiente e padrão. Informe série com até três dígitos e próximo número de 1 a 999999999, sem zero inicial."); return; }
    if (motivoNumero) { definirErro(motivoNumero); return; }
    const assinaturaOperacao = JSON.stringify([assinatura, dados.consulta.consultadoEm]);
    if (operacao.current.assinatura !== assinaturaOperacao) operacao.current = { assinatura: assinaturaOperacao, id: crypto.randomUUID() };
    trava.current = true; definirErro("");
    try {
      const r = await atualizar({ versao: dados.versaoConfiguracao, modelo: Number(form.modelo) as 55 | 65, ambiente: Number(form.ambiente) as 1 | 2, serie: form.serie, proximoNumero: form.proximoNumero, padrao: form.padrao === "SIM", operacaoId: operacao.current.id, consultadoEm: dados.consulta.consultadoEm, confirmarAtualizacao: true });
      if ("erro" in r) { definirErro(r.erro); if (r.conferenciaNecessaria) definirAguardarConsulta({ consultadoEm: dados.consulta.consultadoEm }); }
      else if (r.dados.atualizacao?.contexto !== "ANTERIOR" && r.dados.atualizacao?.situacao === "CONFIRMADA") { definirConfirmada(assinatura); definirAguardarConsulta(null); }
      else definirAguardarConsulta({ consultadoEm: r.dados.consulta.consultadoEm });
    } catch { definirErro("Resultado da atualização não confirmado. Consulte a numeração antes de repetir; nenhum reenvio será automático."); definirAguardarConsulta({ consultadoEm: dados.consulta.consultadoEm }); }
    finally { trava.current = false; }
  }
  return <Card className="vidro-painel min-w-0"><CardHeader><CardTitle>Série e próxima nota</CardTitle><CardDescription>Os campos mostram a última numeração confirmada. Atualize a consulta antes de ajustar e salve para confirmar.</CardDescription></CardHeader><CardContent className="space-y-4">
    <form onSubmit={evento => void salvar(evento)} className="space-y-4" aria-label="Configuração de série e próximo número">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-modelo`}>Modelo a configurar</Label><SelecaoFormulario id={`${id}-modelo`} value={form.modelo} disabled={ocupado} onValueChange={v => mudar("modelo", v)}><option value="">Selecione o modelo</option><option value="55">NF-e · modelo 55</option><option value="65">NFC-e · modelo 65</option></SelecaoFormulario></div>
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-ambiente`}>Ambiente a configurar</Label><SelecaoFormulario id={`${id}-ambiente`} value={form.ambiente} disabled={ocupado} onValueChange={v => mudar("ambiente", v)}><option value="">Selecione o ambiente</option><option value="2">Homologação · 2</option><option value="1">Produção · 1</option></SelecaoFormulario></div>
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-serie`}>Série</Label><Input id={`${id}-serie`} inputMode="numeric" restricao="digitos" maxLength={3} pattern="[0-9]{1,3}" value={form.serie} disabled={ocupado} onChange={e => mudar("serie", e.target.value)} aria-describedby={`${id}-serie-ajuda`} /><p id={`${id}-serie-ajuda`} className="text-xs text-muted-foreground">Até três dígitos. A série é independente por modelo e ambiente.</p></div>
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-proximo`}>Próximo número</Label><Input id={`${id}-proximo`} inputMode="numeric" restricao="digitos" maxLength={9} pattern="[1-9][0-9]{0,8}" value={form.proximoNumero} disabled={ocupado} onChange={e => mudar("proximoNumero", e.target.value)} aria-describedby={`${id}-numero-ajuda`} /><p id={`${id}-numero-ajuda`} className="text-xs text-muted-foreground">De 1 a 999999999, sem zero inicial. Não é uma reserva de número.</p></div>
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-padrao`}>Definir como padrão</Label><SelecaoFormulario id={`${id}-padrao`} value={form.padrao} disabled={ocupado} onValueChange={v => mudar("padrao", v)}><option value="">Selecione uma opção</option><option value="SIM">Sim</option><option value="NAO">Não</option></SelecaoFormulario></div>
      </div>
      {existente && <p className="text-sm text-muted-foreground">Última leitura: número {existente.proximoNumero} · Padrão: {existente.padrao ? "Sim" : "Não"}.</p>}
      {parametrosIguais && <p className="text-sm text-muted-foreground">Os parâmetros coincidem com a última leitura. Nenhuma atualização é necessária para essa combinação.</p>}
      {motivoNumero && <p className="text-sm text-destructive">{motivoNumero}</p>}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Regras da numeração</summary><p className="mt-2">Não reduza nem reinicie contadores utilizados. Definir como padrão pode desmarcar a série padrão anterior somente no mesmo modelo e ambiente. Os demais contadores e históricos são preservados. A configuração não modifica certificado ou CSC e não habilita emissão.</p></details>
      {(!recente || dados.versaoConfiguracao < 1) && <p className="text-sm text-muted-foreground">Consulte a numeração desta configuração antes de salvar. A leitura deve ter até cinco minutos.</p>}
      {(pendente || consultaNecessaria) && <p role="status" className="text-sm text-muted-foreground">Há resultado a conferir. Use Consultar numeração; salvar novamente permanece bloqueado.</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <GrupoAcoes nome="Salvar configuração de numeração"><Button type="button" variant="outline" disabled={ocupado || Object.values(form).every(v => !v)} onClick={() => { definirForm(preencherContador(dados)); definirErro(""); }}>Cancelar edição</Button><Button type="submit" variant="entrada" disabled={bloqueado || !camposValidos || Boolean(motivoNumero) || parametrosIguais || assinaturaConfirmada === assinatura}>{ocupado ? "Aguarde…" : "Salvar numeração"}</Button></GrupoAcoes>
    </form>
  </CardContent></Card>;
}

export function HistoricoNumeracaoFiscal({ dados }: { dados: NumeracaoFiscalBrasilNfeDto }) {
  if (!dados.atualizacao && !dados.historicoAtualizacoes?.length) return null;
  return <Card className="vidro-painel"><CardHeader><CardTitle>Última atualização e histórico</CardTitle><CardDescription>Leitura dos registros administrativos do HUB. Somente a consulta posterior pode confirmar a configuração externa.</CardDescription></CardHeader><CardContent className="space-y-4">
    {dados.atualizacao && <ResultadoNumeracao atualizacao={dados.atualizacao} />}
    {!!dados.historicoAtualizacoes?.length && <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">Histórico das configurações de numeração</summary><p className="text-xs text-muted-foreground">Registros administrativos do HUB. A confirmação externa tem data própria; não comprova emissão nem reserva.</p><Table identificationColumn={0}><TableHeader><TableRow><TableHead>Solicitação e contexto</TableHead><TableHead>Modelo e ambiente</TableHead><TableHead>Série e próximo</TableHead><TableHead>Padrão</TableHead><TableHead>Situação registrada</TableHead><TableHead>Confirmada em</TableHead></TableRow></TableHeader><TableBody>{dados.historicoAtualizacoes.slice(0, 10).map(h => <TableRow key={h.operacaoId}><TableCell>{datas(h.solicitadoEm)}<p className="mt-1 text-xs text-muted-foreground">{h.contexto === "ANTERIOR" ? "Configuração anterior — registro histórico" : h.contexto === "ATUAL" ? "Configuração atual" : "Vínculo da configuração não informado"}</p></TableCell><TableCell>{h.modelo === 55 ? "NF-e 55" : "NFC-e 65"}<br />{h.ambiente === 2 ? "Homologação · 2" : "Produção · 1"}</TableCell><TableCell>Série {h.serie}<br />{h.proximoNumero}</TableCell><TableCell>{h.padrao ? "Sim" : "Não"}</TableCell><TableCell>{estados[h.situacao]}</TableCell><TableCell>{datas(h.confirmadoEm)}</TableCell></TableRow>)}</TableBody></Table></details>}
  </CardContent></Card>;
}
