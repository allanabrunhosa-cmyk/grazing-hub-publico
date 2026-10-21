"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { CATEGORIAS_DIAGNOSTICO_BRASILNFE, ETAPAS_CONTRATO_BRASILNFE, CAMPOS_ITEM_NUMERACAO_BRASILNFE, TIPOS_ITEM_NUMERACAO_BRASILNFE, MOTIVOS_ITEM_NUMERACAO_BRASILNFE, sanitizarMetadadosErroBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";
import type { NumeracaoFiscalBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
import { EditorNumeracaoFiscal, HistoricoNumeracaoFiscal, type AcaoAtualizarNumeracao, type ResultadoAtualizarNumeracao } from "./numeracao-editor";

const datas = (v: string | null) => v ? `${new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)` : "Não conferida";
const ESTADOS = { NAO_CONSULTADA: "Consulta ainda não realizada", CONCLUIDA: "Consulta concluída", FALHOU: "Consulta não concluída", OBSOLETA: "Consulta anterior desatualizada" } as const;
export function NumeracaoFiscal({ inicial, consultar, podeConsultar, atualizar, certificado }: {
  inicial: NumeracaoFiscalBrasilNfeDto; podeConsultar: boolean;
  consultar: (entrada: { versao: number }) => Promise<{ ok: true; dados: NumeracaoFiscalBrasilNfeDto } | { erro: string }>;
  atualizar?: AcaoAtualizarNumeracao;
  certificado?: ReactNode;
}) {
  const [leitura, definirLeitura] = useState({ base: inicial, dados: inicial }), [erro, definirErro] = useState(""), [consultando, definirConsultando] = useState(false);
  if (leitura.base !== inicial) definirLeitura({ base: inicial, dados: inicial });
  const dados = leitura.base === inicial ? leitura.dados : inicial;
  const [ambiente, definirAmbiente] = useState("TODOS"), [modelo, definirModelo] = useState("TODOS");
  const [atualizando, definirAtualizando] = useState(false);
  const trava = useRef(false);
  async function conferir() {
    if (!podeConsultar || trava.current) return;
    trava.current = true; definirConsultando(true); definirErro("");
    try { const r = await consultar({ versao: dados.versaoConfiguracao }); if ("erro" in r) definirErro(r.erro); else definirLeitura({ base: inicial, dados: r.dados }); }
    catch { definirErro("A consulta não foi concluída. Nenhum contador foi alterado."); }
    finally { trava.current = false; definirConsultando(false); }
  }
  const salvar: AcaoAtualizarNumeracao = async entrada => {
    if (!podeConsultar || !atualizar || trava.current) return { erro: "A atualização não está disponível neste momento." };
    trava.current = true; definirAtualizando(true); definirErro("");
    try {
      const r = await atualizar(entrada);
      if ("ok" in r) definirLeitura({ base: inicial, dados: r.dados });
      return r;
    } catch {
      return { erro: "Resultado da atualização não confirmado. Consulte a numeração antes de repetir; nenhum reenvio será automático.", conferenciaNecessaria: true } satisfies ResultadoAtualizarNumeracao;
    } finally { trava.current = false; definirAtualizando(false); }
  };
  const linhas = dados.linhas.filter(l => (ambiente === "TODOS" || String(l.ambiente) === ambiente) && (modelo === "TODOS" || String(l.modelo) === modelo));
  const falha = dados.consulta.falha;
  const detalhe = sanitizarMetadadosErroBrasilNfe(falha)?.itemNumeracao;
  const foraEscopo = dados.consulta.situacao === "CONCLUIDA" && typeof dados.consulta.itensForaEscopo === "number" && Number.isSafeInteger(dados.consulta.itensForaEscopo) && dados.consulta.itensForaEscopo > 0 && dados.consulta.itensForaEscopo <= 1000 ? dados.consulta.itensForaEscopo : null;
  return <div className="space-y-5">
    <BarraAcoes titulo="Configurações" descricao="Ajuste a numeração das notas e administre o certificado digital.">
      <Button variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal" />}>Visão geral</Button>
    </BarraAcoes>
    <Card className="vidro-painel"><CardHeader><CardTitle>{dados.emitente.nome ?? "Emitente não cadastrado"}</CardTitle><CardDescription>CNPJ {dados.emitente.cnpj ?? "não informado"} · Última consulta: {datas(dados.consulta.consultadoEm)}</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant={dados.consulta.situacao === "CONCLUIDA" ? "success" : "warning"}>{ESTADOS[dados.consulta.situacao]}</Badge><GrupoAcoes>{podeConsultar && <Button variant="outline" disabled={consultando || atualizando || dados.versaoConfiguracao < 1} onClick={() => void conferir()}>{consultando ? "Consultando…" : "Consultar numeração"}</Button>}</GrupoAcoes></div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <details className="space-y-3"><summary className="cursor-pointer text-sm text-muted-foreground">Detalhes da consulta</summary><dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Empresa</dt><dd className="break-words">{dados.emitente.nome ?? "Cadastro pendente"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">CNPJ do emitente</dt><dd>{dados.emitente.cnpj ?? "Cadastro pendente"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Última consulta desta configuração</dt><dd>{datas(dados.consulta.consultadoEm)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Origem da leitura</dt><dd>{dados.consulta.situacao === "CONCLUIDA" ? "Brasil NFe · ConsultarNumeracao" : "Sem leitura externa confirmada nesta configuração"}</dd></div>
      </dl>
      {falha && <p role="alert" className="text-sm text-destructive">{CATEGORIAS_DIAGNOSTICO_BRASILNFE[falha.categoria]}{falha.httpStatus !== null ? ` · HTTP ${falha.httpStatus}` : ""}{falha.etapaContrato ? ` · ${ETAPAS_CONTRATO_BRASILNFE[falha.etapaContrato]}` : ""}. A consulta não confirma nem altera o contador.</p>}
      {detalhe && <section aria-label="Campo incompatível na numeração" className="space-y-2 text-sm"><p className="font-medium">Item {detalhe.posicao} da lista Numeracoes</p><dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Campo</dt><dd>{CAMPOS_ITEM_NUMERACAO_BRASILNFE[detalhe.campo]}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo observado</dt><dd>{TIPOS_ITEM_NUMERACAO_BRASILNFE[detalhe.tipoObservado]}</dd></div><div><dt className="text-xs text-muted-foreground">Motivo</dt><dd>{MOTIVOS_ITEM_NUMERACAO_BRASILNFE[detalhe.motivo]}</dd></div></dl><p className="text-xs text-muted-foreground">Diagnóstico por categorias locais. O valor recebido não é exibido nem armazenado.</p></section>}
      {foraEscopo !== null && <p className="text-sm text-muted-foreground">Entradas de outros modelos descartadas: {foraEscopo.toLocaleString("pt-BR")}. Estão fora do escopo NF-e/NFC-e; seus contadores não foram validados.</p>}
      {dados.consulta.avisosPresentes && <p className="text-sm text-muted-foreground">O fornecedor devolveu avisos. Textos externos não são armazenados nesta consulta.</p>}
      </details>
      {falha && <p role="alert" className="text-sm text-destructive">A consulta não foi concluída. Veja os detalhes e tente consultar novamente.</p>}
      {!podeConsultar && <p className="text-xs text-muted-foreground">A atualização manual exige permissão de edição da integração Brasil NFe.</p>}
      </CardContent></Card>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
      {podeConsultar && atualizar && <EditorNumeracaoFiscal key={`${dados.versaoConfiguracao}:${dados.consulta.consultadoEm}:${dados.emitente.cnpj ?? "sem-emitente"}`} dados={dados} ocupado={consultando || atualizando} atualizar={salvar} />}
      {certificado}
    </div>
    <details className="space-y-4"><summary className="cursor-pointer text-sm font-medium">Histórico e contadores por série</summary>
    <HistoricoNumeracaoFiscal dados={dados} />
    <Card className="vidro-painel"><CardHeader><CardTitle>Contadores por série</CardTitle><CardDescription>NF-e 55 e NFC-e 65 mantêm sequências separadas em produção e homologação.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="flex flex-wrap gap-4">
        <FiltroOpcoesContadas nome="Ambiente de numeração" valor={ambiente} onValueChange={definirAmbiente} opcoes={[{ valor: "TODOS", nome: "Todos os ambientes" }, { valor: "2", nome: "Homologação" }, { valor: "1", nome: "Produção" }].map(o => ({ ...o, quantidade: dados.linhas.filter(l => (o.valor === "TODOS" || String(l.ambiente) === o.valor) && (modelo === "TODOS" || String(l.modelo) === modelo)).length }))} />
        <FiltroOpcoesContadas nome="Modelo de documento" valor={modelo} onValueChange={definirModelo} opcoes={[{ valor: "TODOS", nome: "Todos os modelos" }, { valor: "55", nome: "NF-e 55" }, { valor: "65", nome: "NFC-e 65" }].map(o => ({ ...o, quantidade: dados.linhas.filter(l => (o.valor === "TODOS" || String(l.modelo) === o.valor) && (ambiente === "TODOS" || String(l.ambiente) === ambiente)).length }))} />
      </div>
      {linhas.length > 0 && <Table identificationColumn={0}><TableHeader><TableRow><TableHead>Modelo e série</TableHead><TableHead>Ambiente</TableHead><TableHead>Padrão</TableHead><TableHead className="text-right">Próximo número<br /><span className="font-normal">não reservado</span></TableHead><TableHead className="text-right">Última autorizada no HUB</TableHead><TableHead>Conferência</TableHead></TableRow></TableHeader>
        <TableBody>{linhas.length ? linhas.map(l => <TableRow key={`${l.modelo}:${l.ambiente}:${l.serie}`}><TableCell><span className="font-medium">{l.modelo === 55 ? "NF-e 55" : "NFC-e 65"}</span><br />Série {l.serie}</TableCell><TableCell>{l.ambiente === 2 ? "Homologação · 2" : "Produção · 1"}</TableCell><TableCell>{l.padrao ? "Sim" : "Não"}</TableCell><TableCell className="text-right tabular-nums">{l.proximoNumero}</TableCell><TableCell className="text-right tabular-nums">{l.ultimaAutorizadaLocal ? <>{l.ultimaAutorizadaLocal.numero}<br /><span className="text-xs text-muted-foreground">{datas(l.ultimaAutorizadaLocal.autorizadaEm)}</span></> : "Não confirmada"}</TableCell><TableCell>{l.divergencia ? <Badge variant="warning" className="whitespace-normal">Contador não supera autorização local</Badge> : "Sem divergência local conhecida"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6}>Nenhum contador confirmado para estes filtros. Série e próximo número não serão presumidos.</TableCell></TableRow>}</TableBody>
      </Table>}
      {!linhas.length && <p className="text-sm text-muted-foreground">Nenhum contador confirmado para estes filtros. Série e próximo número não serão presumidos.</p>}
      <ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">{dados.pendencias.map(p => <li key={p}>{p}</li>)}</ul>
      <p className="text-xs text-muted-foreground">Configurar ou consultar numeração não autoriza transmissão. Cada documento exige habilitação, revisão e autorização no pedido.</p>
      </CardContent></Card></details>
  </div>;
}
