"use client";
import { Checkbox } from "@/components/ui/checkbox";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { aprovarRegraBrasilNfeAction, historicoRegraBrasilNfeAction, inativarRegraBrasilNfeAction, revisarRegraBrasilNfeAction, bloquearRegraBrasilNfeAction } from "./actions";
import { FormularioRegraBrasilNfe } from "./formulario";
import { resumoConteudoRegraBrasilNfe } from "./formulario-dominio";
import { ResumoFundamentacaoFiscal } from "./fundamentacao-resumo";
import type { CatalogosRegrasBrasilNfe, HistoricoRegraBrasilNfe, RegraListaBrasilNfe } from "./tipos";

const alvos: Record<string, string> = { EMPRESA: "Emitente", OPERACAO: "Operação de venda", PRODUTO: "Produto", GRUPO: "Grupo fiscal" };
const estados: Record<string, string> = { RASCUNHO: "Rascunho legado", PROPOSTA: "Proposta", EM_REVISAO: "Em revisão", APROVADA: "Aprovada", BLOQUEADA: "Bloqueada", INATIVA: "Inativa" };
const data = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : "Não informada";
const horario = (v: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(v));
function SituacaoRegra({ estado, legado = false }: { estado: string; legado?: boolean }) { return <Badge variant={estado === "APROVADA" ? "success" : ["RASCUNHO", "PROPOSTA", "EM_REVISAO", "BLOQUEADA"].includes(estado) ? "warning" : "muted"}>{estado === "APROVADA" && legado ? "Aprovada no contrato legado" : estados[estado] ?? "Conferência pendente"}</Badge>; }
function tituloRegra(r: RegraListaBrasilNfe) { return r.produtoNome || r.grupoNome || alvos[r.alvo] || "Decisão tributária"; }
type Comando = "APROVAR" | "INATIVAR" | "REVISAR" | "BLOQUEAR";
type Painel = { tipo: "EDITAR" | "HISTORICO"; historico: HistoricoRegraBrasilNfe } | { tipo: Comando; regra: RegraListaBrasilNfe; historico?: HistoricoRegraBrasilNfe } | { tipo: "NOVA" };
export function RegrasBrasilNfeClient({ regras, editar, catalogos, responsaveis }: { regras: RegraListaBrasilNfe[]; editar: boolean; catalogos: CatalogosRegrasBrasilNfe; responsaveis: Record<string, string> }) {
  const [painel, definirPainel] = useState<Painel | null>(null), [erro, definirErro] = useState(""), [carregando, definirCarregando] = useState(false), [nomes, definirNomes] = useState(responsaveis);
  const trava = useRef(false);
  async function abrir(r: RegraListaBrasilNfe, tipo: "EDITAR" | "HISTORICO" | "APROVAR") {
    if (trava.current) return; trava.current = true; definirCarregando(true); definirErro("");
    try {
      const resultado = await historicoRegraBrasilNfeAction(r.id);
      if ("erro" in resultado) definirErro(resultado.erro ?? "Não foi possível consultar a decisão.");
      else if (tipo === "APROVAR" && (resultado.historico.revisao !== r.revisao || resultado.historico.versoes[0]?.id !== r.atual?.id)) definirErro("A decisão foi alterada. Atualize e confira a revisão antes de aprovar.");
      else { definirNomes(n => ({ ...n, ...resultado.responsaveis })); definirPainel(tipo === "APROVAR" ? { tipo, regra: r, historico: resultado.historico } : { tipo, historico: resultado.historico }); }
    } catch { definirErro("Não foi possível consultar esta decisão tributária. Atualize a página."); }
    finally { trava.current = false; definirCarregando(false); }
  }
  return <div className="space-y-5">
    <BarraAcoes titulo="Decisões tributárias · Brasil NFe" descricao="Fundamentação verificável por emitente, operação e produto, com revisão interna e histórico preservado.">
      <Button variant="outline" nativeButton={false} render={<Link href="/configuracoes/integracoes/brasilnfe" />}>Integração Brasil NFe</Button>
      {editar && <Button onClick={() => definirPainel({ tipo: "NOVA" })} disabled={carregando}>Nova decisão</Button>}
    </BarraAcoes>
    <Card><CardHeader><CardTitle>Preparação fiscal</CardTitle><CardDescription>A aprovação interna registra a responsabilidade e a aplicação das fontes verificadas. Consultoria especializada é opcional para dúvidas materiais. A aprovação não habilita emissão nem comprova homologação.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Badge variant="outline">Homologação · ambiente 2</Badge><Badge variant="warning">Transmissão não autorizada</Badge><Badge variant="warning">Produção bloqueada</Badge></CardContent></Card>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {!regras.length ? <Card><CardContent><p className="text-sm text-muted-foreground">Nenhuma decisão tributária registrada. Prepare as fontes, o alcance e os parâmetros do emitente, da operação e de cada produto para revisão interna.</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{regras.map(r => <Card key={r.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><CardTitle className="min-w-0 break-words">{tituloRegra(r)}</CardTitle>{r.atual && <SituacaoRegra estado={r.atual.estado} legado={r.atual.legado} />}</div><CardDescription>{r.modelo === 55 ? "NF-e" : "NFC-e"} · {alvos[r.alvo]} · revisão {r.revisao}</CardDescription></CardHeader><CardContent className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Fundamentação</dt><dd className="break-words">{r.atual?.fundamentacaoFiscal ? `${r.atual.fundamentacaoFiscal.fontes.length} fonte(s) · ${r.atual.fundamentacaoFiscal.contexto.uf || "UF pendente"}` : r.atual?.legado ? "Contrato legado · sem conversão automática" : "Pendente"}</dd></div><div><dt className="text-xs text-muted-foreground">Vigência</dt><dd>{r.atual ? `${data(r.atual.vigenteDesde)}${r.atual.vigenteAte ? ` a ${data(r.atual.vigenteAte)}` : " · sem término"}` : "Pendente"}</dd></div><div><dt className="text-xs text-muted-foreground">Autor / responsável pela revisão</dt><dd>{r.atual ? r.atual.autorNome ?? nomes[r.atual.responsavelId] ?? "Responsável registrado" : "Pendente"}</dd></div><div><dt className="text-xs text-muted-foreground">Registro</dt><dd>{r.atual ? horario(r.atual.criadoEm) : "Pendente"}</dd></div>{r.atual?.aprovacaoInterna && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Aprovação interna registrada</dt><dd>{r.atual.aprovacaoInterna.aprovador.nome} · {horario(r.atual.aprovacaoInterna.aprovadoEm)}</dd></div>}{r.atual?.legado && r.atual.referenciaConfirp && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Referência Confirp legada</dt><dd className="break-words">{r.atual.referenciaConfirp}</dd></div>}</dl>
      {r.atual?.fundamentacaoFiscal && r.atual.fundamentacaoFiscal.confianca.some(c => ["PENDENTE", "REVISAO_ESPECIALIZADA"].includes(c.estado)) && <p className="text-sm text-muted-foreground">Campos pendentes: {r.atual.fundamentacaoFiscal.confianca.filter(c => ["PENDENTE", "REVISAO_ESPECIALIZADA"].includes(c.estado)).map(c => c.campo).join(", ")}. A pendência limita esta decisão.</p>}
      <GrupoAcoes nome={`Ações de ${tituloRegra(r)}`} className="flex-wrap"><Button variant="outline" size="sm" disabled={carregando} onClick={() => void abrir(r, "HISTORICO")}>Histórico</Button>{editar && <><Button variant="outline" size="sm" disabled={carregando} onClick={() => void abrir(r, "EDITAR")}>Nova revisão</Button>{r.atual && !r.atual.legado && ["PROPOSTA", "BLOQUEADA"].includes(r.atual.estado) && <Button variant="outline" size="sm" disabled={carregando} onClick={() => definirPainel({ tipo: "REVISAR", regra: r })}>Enviar para revisão</Button>}{r.atual && ["PROPOSTA", "EM_REVISAO"].includes(r.atual.estado) && !r.atual.legado && <><Button size="sm" disabled={carregando} onClick={() => void abrir(r, "APROVAR")}>Aprovar internamente</Button></>}{r.atual && !r.atual.legado && !["BLOQUEADA", "INATIVA", "RASCUNHO"].includes(r.atual.estado) && <Button variant="outline" size="sm" disabled={carregando} onClick={() => definirPainel({ tipo: "BLOQUEAR", regra: r })}>Bloquear decisão</Button>}{r.atual && r.atual.estado !== "INATIVA" && <Button variant="outline" size="sm" disabled={carregando} onClick={() => definirPainel({ tipo: "INATIVAR", regra: r })}>Inativar</Button>}</>}</GrupoAcoes>
    </CardContent></Card>)}</div>}
    {painel?.tipo === "NOVA" && <FormularioRegraBrasilNfe catalogos={catalogos} fechar={() => definirPainel(null)} />}
    {painel?.tipo === "EDITAR" && <FormularioRegraBrasilNfe catalogos={catalogos} historico={painel.historico} fechar={() => definirPainel(null)} />}
    {painel?.tipo === "HISTORICO" && <HistoricoRegraDialog historico={painel.historico} responsaveis={nomes} fechar={() => definirPainel(null)} />}
    {painel && ["APROVAR", "INATIVAR", "REVISAR", "BLOQUEAR"].includes(painel.tipo) && "regra" in painel && <ConfirmarRegraDialog regra={painel.regra} comando={painel.tipo as Comando} historico={painel.historico} fechar={() => definirPainel(null)} />}
  </div>;
}
export function HistoricoRegraDialog({ historico, responsaveis, fechar }: { historico: HistoricoRegraBrasilNfe; responsaveis: Record<string, string>; fechar: () => void }) {
  return <Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Histórico da decisão tributária</DialogTitle><DialogDescription>Versões preservadas para conferência. Referências antigas conservam seu contrato; dados não recebem aprovação automática.</DialogDescription></DialogHeader>
    <div className="space-y-4">{historico.versoes.map(v => <Card key={v.id} size="sm"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Revisão {v.revisao}</CardTitle><SituacaoRegra estado={v.estado} legado={v.legado} /></div><CardDescription>{data(v.vigenteDesde)}{v.vigenteAte ? ` a ${data(v.vigenteAte)}` : " · sem término"}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-xs text-muted-foreground">Autor / responsável: {v.autorNome ?? responsaveis[v.responsavelId] ?? "Responsável registrado"}. Registro: {horario(v.criadoEm)}.</p>{v.legado && <div className="space-y-1"><p className="text-sm font-medium">Contrato legado preservado</p><p className="break-words text-sm text-muted-foreground">Referência Confirp legada: {v.referenciaConfirp || "Não informada"}. Sem conversão em aprovação interna.</p></div>}{v.aprovacaoInterna && <p className="text-sm">Aprovação interna: {v.aprovacaoInterna.aprovador.nome} · {horario(v.aprovacaoInterna.aprovadoEm)}. Aplicação conferida à revisão {v.aprovacaoInterna.revisaoOrigem}.</p>}{v.fundamentacaoFiscal && <ResumoFundamentacaoFiscal valor={v.fundamentacaoFiscal} />}<dl className="grid gap-3 text-sm sm:grid-cols-2">{resumoConteudoRegraBrasilNfe(v.conteudo).map(([rotulo, valor], i) => <div key={`${rotulo}-${i}`}><dt className="text-xs text-muted-foreground">{rotulo}</dt><dd className="break-words">{valor}</dd></div>)}</dl></CardContent></Card>)}</div>
    <GrupoAcoes><DialogClose render={<Button variant="outline" />}>Fechar</DialogClose></GrupoAcoes>
  </DialogContent></Dialog>;
}
const rotulosComando: Record<Comando, [string, string]> = { APROVAR: ["Aprovar internamente a decisão", "Confirmar aprovação interna"], INATIVAR: ["Inativar decisão tributária", "Confirmar inativação"], REVISAR: ["Enviar decisão para revisão", "Confirmar revisão"], BLOQUEAR: ["Bloquear decisão tributária", "Confirmar bloqueio"] };
function ConfirmarRegraDialog({ regra, comando, historico, fechar }: { regra: RegraListaBrasilNfe; comando: Comando; historico?: HistoricoRegraBrasilNfe; fechar: () => void }) {
  const [confirmado, definirConfirmado] = useState(false), [salvando, definirSalvando] = useState(false), [erro, definirErro] = useState("");
  const router = useRouter(), trava = useRef(false), aprovar = comando === "APROVAR", versao = historico?.versoes[0];
  const prova = !!(versao?.fundamentacaoFiscal && versao.fundamentacaoHash && versao.conteudoHash && !versao.legado);
  async function confirmar() {
    if (trava.current || (aprovar && (!confirmado || !prova))) return;
    trava.current = true; definirSalvando(true); definirErro("");
    try {
      const base = { regraId: regra.id, revisao: regra.revisao };
      const resultado = aprovar ? await aprovarRegraBrasilNfeAction({ ...base, fundamentacaoHash: versao?.fundamentacaoHash, conteudoHash: versao?.conteudoHash, aplicacaoConferida: confirmado }) : comando === "REVISAR" ? await revisarRegraBrasilNfeAction(base) : comando === "BLOQUEAR" ? await bloquearRegraBrasilNfeAction(base) : await inativarRegraBrasilNfeAction(base);
      if ("erro" in resultado) definirErro(resultado.erro); else { fechar(); router.refresh(); }
    } catch { definirErro("Não foi possível registrar a alteração. Atualize e confira a revisão."); }
    finally { trava.current = false; definirSalvando(false); }
  }
  return <Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto && !salvando) fechar(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{rotulosComando[comando][0]}</DialogTitle><DialogDescription>{aprovar ? "Confira as fontes, o alcance e os parâmetros abaixo. A revisão autorizada registra responsabilidade interna e nova versão; não autoriza transmissão." : "A mudança cria uma versão e conserva o histórico. Não altera cadastros comerciais, valores ou habilitação de emissão."}</DialogDescription></DialogHeader><p className="text-sm">{tituloRegra(regra)} · revisão {regra.revisao}.</p>
    {aprovar && versao && <div className="space-y-4">{versao.fundamentacaoFiscal && <ResumoFundamentacaoFiscal valor={versao.fundamentacaoFiscal} />}<dl className="grid gap-3 text-sm sm:grid-cols-2">{resumoConteudoRegraBrasilNfe(versao.conteudo).map(([nome, valor], i) => <div key={`${nome}-${i}`}><dt className="text-xs text-muted-foreground">{nome}</dt><dd className="break-words">{valor}</dd></div>)}</dl><label className="flex items-start gap-2 text-sm"><Checkbox className="mt-1 " disabled={salvando || !prova} checked={confirmado} onCheckedChange={checked => definirConfirmado(checked)} />Revisei as fontes e os parâmetros desta versão, conferi sua aplicação à empresa, produto e operação indicados e assumo a responsabilidade pela aprovação interna.</label></div>}
    {aprovar && !prova && <p className="text-sm text-muted-foreground">Fundamentação íntegra não disponível. Crie uma nova proposta ou atualize a revisão antes de aprovar.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button variant="outline" disabled={salvando} />}>Cancelar</DialogClose><Button disabled={salvando || (aprovar && (!confirmado || !prova))} onClick={() => void confirmar()}>{salvando ? "Registrando…" : rotulosComando[comando][1]}</Button></GrupoAcoes>
  </DialogContent></Dialog>;
}
