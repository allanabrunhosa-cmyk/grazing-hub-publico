"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EntradaAvulsaEdicaoDialog } from "./entrada-avulsa-detalhe";
import { consultarEntradaAvulsaAction, excluirEntradaAvulsaAction } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import Link from "next/link";
import type { FiltrosEntradas, listarEntradas } from "@/lib/estoque/consultar-entradas";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
function rotaFiltros(busca: string, periodo: { de?: string; ate?: string }) {
  const parametros = new URLSearchParams({ de: periodo.de ?? "", ate: periodo.ate ?? "" });
  if (busca.trim()) parametros.set("busca", busca.trim());
  return `/inventario/entradas?${parametros}`;
}
export function EntradasHistorico({ filtros, dados, podeAdicionar, podeEditar = false, podeExcluir = false }: { filtros: FiltrosEntradas; dados: Awaited<ReturnType<typeof listarEntradas>> | null; podeAdicionar: boolean; podeEditar?: boolean; podeExcluir?: boolean }) {
  const router = useRouter();
  const buscaAtual = filtros.busca ?? "";
  const [consulta, setConsulta] = useState({ base: filtros, valor: buscaAtual, pendente: false, agendar: false });
  const [compondo, setCompondo] = useState(false);
  if (consulta.base !== filtros) {
    const pendente = consulta.pendente && consulta.valor.trim() !== buscaAtual;
    setConsulta({ base: filtros, valor: pendente ? consulta.valor : buscaAtual, pendente, agendar: pendente && consulta.agendar });
  }
  const rotaBusca = rotaFiltros(consulta.valor, filtros);
  const substituir = router.replace;
  const [pesquisando, pesquisar] = useTransition();
  useEffect(() => {
    if (!consulta.agendar || compondo) return;
    const temporizador = setTimeout(() => { setConsulta(v => ({ ...v, agendar: false })); pesquisar(() => substituir(rotaBusca, { scroll: false })); }, 300);
    return () => clearTimeout(temporizador);
  }, [consulta.agendar, consulta.valor, compondo, rotaBusca, substituir]);
  function mudarBusca(valor: string) { const pendente = valor.trim() !== buscaAtual || consulta.pendente; setConsulta({ base: filtros, valor, pendente, agendar: pendente }); }
  function aplicarPeriodo(periodo: { de: string; ate: string }) {
    setConsulta(v => ({ ...v, agendar: false }));
    pesquisar(() => substituir(rotaFiltros(consulta.valor, periodo), { scroll: false }));
  }
  const [edicao, setEdicao] = useState<Extract<Awaited<ReturnType<typeof consultarEntradaAvulsaAction>>, { detalhe: unknown }> | null>(null);
  const [exclusao, setExclusao] = useState<NonNullable<typeof dados>["linhas"][number] | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trava = useRef(false);
  const chaveExclusao = useRef("");
  function editar(id: string) {
    if (trava.current) return;
    trava.current = true; setErro(null);
    startTransition(async () => {
      try { const r = await consultarEntradaAvulsaAction(id); if ("erro" in r) setErro(r.erro!); else if (r.detalhe.bloqueio) setErro(r.detalhe.bloqueio); else setEdicao(r); }
      catch { setErro("Não foi possível consultar a entrada. Tente novamente."); }
      finally { trava.current = false; }
    });
  }
  function excluir() {
    if (!exclusao || trava.current) return;
    trava.current = true; setErro(null);
    startTransition(async () => {
      try {
        const r = await excluirEntradaAvulsaAction({ id: exclusao.id, versao: exclusao.versao, chave: chaveExclusao.current, motivo });
        if ("erro" in r) setErro(r.erro); else { setExclusao(null); router.refresh(); }
      } catch { setErro("Não foi possível confirmar. Tente novamente; o estorno não será duplicado."); }
      finally { trava.current = false; }
    });
  }
  const linkPagina = (pagina: number) => `/inventario/entradas?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => typeof v === "string")), pagina: String(pagina) })}`;
  return <div className="space-y-5">
    <BarraAcoes titulo="Histórico de entradas avulsas" descricao="Consulte cada lançamento completo e confira suas correções.">
      {podeAdicionar && <Button nativeButton={false} render={<Link href="/inventario/entrada-avulsa" />}>Entrada avulsa</Button>}
    </BarraAcoes>
    <Card><CardContent className="space-y-4 pt-5">
      <form role="search" aria-label="Busca e período das entradas avulsas" className="flex min-w-0 flex-wrap items-start gap-2" onSubmit={e => { e.preventDefault(); setConsulta(v => ({ ...v, agendar: false })); pesquisar(() => substituir(rotaBusca, { scroll: false })); }}>
        <CampoBusca aria-label="Buscar nas entradas avulsas" value={consulta.valor} onChange={mudarBusca} maxLength={160} placeholder="Buscar em todo o lançamento..." containerClassName="min-w-44 flex-1" className="h-9!" onCompositionStart={() => setCompondo(true)} onCompositionEnd={() => setCompondo(false)} />
        <FiltroPeriodo de={filtros.de ?? ""} ate={filtros.ate ?? ""} aoAlterar={aplicarPeriodo} />
      </form>
      {!dados ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar. Confira o período e tente novamente.</p> : <>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{pesquisando ? "Pesquisando… · " : ""}{dados.total} lançamentos · Página {dados.pagina} de {dados.paginas}</p>
        <Table><TableHeader><TableRow><TableHead>Data de lançamento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Itens com quantidade</TableHead><TableHead>Valor total</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
          {dados.linhas.map(r => { const encerrada = ["Excluída", "Estornada"].includes(r.situacao); return <TableRow key={r.id}>
            <TableCell>{new Date(r.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}<p className="text-xs text-muted-foreground">Entrada <Link className="text-primary underline underline-offset-4" href={`/inventario/entradas/${encodeURIComponent(r.id)}`}>{r.identificador}</Link></p></TableCell>
            <TableCell className="max-w-xs whitespace-normal">{r.fornecedor}</TableCell>
            <TableCell className="min-w-48 max-w-sm whitespace-normal"><ul className="space-y-1">{r.itens.map((i, n) => <li key={n}>{i.nome} · {Number(i.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 9 })} {i.unidade.toLocaleLowerCase("pt-BR")}</li>)}</ul></TableCell>
            <TableCell>{formatarMoeda(r.valorTotal)}</TableCell><TableCell><div className="flex items-center gap-2">
              {podeEditar && <Button variant="editar" aria-label={`Editar entrada ${r.identificador}`} disabled={pending || encerrada} title={encerrada ? "Entrada encerrada; consulte o histórico pelo número do lançamento." : `Editar entrada ${r.identificador}`} onClick={() => editar(r.id)} />}
              {podeExcluir && <Button variant="excluir" aria-label={`Excluir entrada ${r.identificador}`} disabled={pending || encerrada} title={encerrada ? "Entrada já encerrada; não é possível excluir novamente." : `Excluir entrada ${r.identificador}`} onClick={() => { setErro(null); setMotivo(""); chaveExclusao.current = crypto.randomUUID(); setExclusao(r); }} />}
            </div></TableCell></TableRow>; })}
          {!dados.linhas.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma entrada encontrada para estes filtros.</TableCell></TableRow>}
        </TableBody></Table>
        <GrupoAcoes nome="Páginas do histórico"><Button variant="outline" disabled={dados.pagina <= 1} nativeButton={false} render={<Link href={linkPagina(dados.pagina - 1)} />}>Anterior</Button><Button variant="outline" disabled={dados.pagina >= dados.paginas} nativeButton={false} render={<Link href={linkPagina(dados.pagina + 1)} />}>Próxima</Button></GrupoAcoes>
      </>}
    </CardContent></Card>
    {!exclusao && erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {edicao && <EntradaAvulsaEdicaoDialog {...edicao} aberto aoFechar={() => setEdicao(null)} />}
    <Dialog open={!!exclusao} protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto && !pending) setExclusao(null); }}><DialogContent showCloseButton={!pending}><DialogHeader><DialogTitle>Excluir entrada {exclusao?.identificador}</DialogTitle><DialogDescription>O estoque será estornado pela versão atual. Títulos pendentes serão cancelados. O histórico e os movimentos posteriores serão preservados. Pagamentos, vínculos ativos ou saldo insuficiente impedem a exclusão.</DialogDescription></DialogHeader>
      <Label htmlFor="motivo-exclusao-entrada">Motivo da exclusão</Label><Textarea id="motivo-exclusao-entrada" maxLength={255} value={motivo} disabled={pending} onChange={e => { setMotivo(e.target.value); chaveExclusao.current = crypto.randomUUID(); }} />
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <GrupoAcoes nome="Exclusão da entrada"><Button variant="outline" disabled={pending} onClick={() => setExclusao(null)}>Cancelar</Button><Button variant="excluir" aria-label="Confirmar exclusão da entrada" disabled={pending || motivo.trim().length < 15} onClick={excluir} /></GrupoAcoes>
    </DialogContent></Dialog>
  </div>;
}
