"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { CampoBusca } from "@/components/campo-busca";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelecaoFormulario } from "@/components/ui/select";
import { EditorTokens } from "@/components/design-system/editor-tokens";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buscarPadroes, ESTADOS_DEMONSTRACAO, type GrupoDesign, type EstadoDemonstracao } from "@/lib/design-system/grupos";
import { resolverTema } from "@/lib/design-system/resolver-tema";
import { REGISTRO_TOKENS, VALORES_FABRICA, type ChaveTokenDesign, type ValoresTemaParciais } from "@/lib/design-system/registro";
import type { DadosCentralDesign, VersaoDesignTela } from "@/lib/design-system/tipos";
import { publicarRascunhoDesignAction, restaurarVersaoDesignAction, salvarRascunhoDesignAction } from "@/app/(protegido)/configuracoes/design/actions";
import type { ConfiguracaoLaboratorio } from "@/lib/design-system/previa";
import type { IdentidadeInterface } from "@/lib/hosts";

const nomesEstados: Record<EstadoDemonstracao, string> = { normal: "Normal", foco: "Foco por teclado", hover: "Ponteiro", desabilitado: "Desabilitado", "somente-leitura": "Somente leitura", carregando: "Carregando", salvando: "Salvando", sucesso: "Sucesso", erro: "Erro", "sem-permissao": "Sem permissão", vazio: "Vazio", longo: "Conteúdo longo" };

export function CentralDesign({ grupo, dados }: { grupo?: GrupoDesign; dados: DadosCentralDesign }) {
  const roteador = useRouter();
  const [busca, definirBusca] = useState("");
  const [padraoId, definirPadrao] = useState("status-ativo");
  const [comparar, definirComparar] = useState(false);
  const [reinicio, definirReinicio] = useState(0);
  const [configuracao, definirConfiguracao] = useState({ identidade: "hub" as IdentidadeInterface, modo: "claro" as "claro" | "escuro", estado: "normal" as EstadoDemonstracao, aplicado: false });
  const publicados = dados.publicada?.valores ?? VALORES_FABRICA;
  const [valores, definirValores] = useState<ValoresTemaParciais>(dados.rascunho?.valores ?? {});
  const [revisao, definirRevisao] = useState(dados.rascunho?.revisao ?? 0);
  const [salvando, iniciarSalvar] = useTransition();
  const encontrados = buscarPadroes(busca, grupo);
  const padrao = encontrados.find(p => p.id === padraoId) ?? encontrados[0];
  const resolvidos = resolverTema({ ...publicados, ...valores });
  const pendentes = (Object.keys(REGISTRO_TOKENS) as ChaveTokenDesign[]).filter(k => resolvidos[k] !== publicados[k]).length;
  const previa: ConfiguracaoLaboratorio = { canal: "grazing-design-lab", tipo: "configurar", ...configuracao, padrao: padrao?.id ?? "status-ativo", reinicio, valores: resolvidos };
  return <div className="ds-central mx-auto w-full space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-medium text-primary">Configurações · Administradores</p><h1 className="text-display">Central de Design</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Explore padrões reais. Experimente com dados sintéticos e revise o alcance antes de publicar.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{dados.publicada ? `Versão ${dados.publicada.numero}` : "Valores de fábrica"}</Badge>
        <Badge variant="outline">{pendentes ? `${pendentes} ajustes pendentes` : "Sem ajustes pendentes"}</Badge>
        <Button size="sm" variant="outline" disabled={!padrao} aria-expanded={comparar} onClick={() => definirComparar(v => !v)}>{comparar ? "Ocultar comparação" : "Comparar com publicado"}</Button>
      </div>
    </header>
    <div className="ds-central-colunas">
      <aside className="ds-central-categorias space-y-3" aria-label="Categorias de design">
        <CampoBusca value={busca} onChange={definirBusca} placeholder="Status, lápis, preço…" aria-label="Buscar padrão de design" />
        <label className="ds-categoria-seletor text-sm">Categoria<SelecaoFormulario className="mt-1" aria-label="Categoria de design" value={padrao?.id ?? ""} onValueChange={definirPadrao}>{!encontrados.length && <option value="">Nenhum padrão</option>}{encontrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelecaoFormulario></label>
        <nav className="ds-categorias-lista" aria-label="Padrões de design">{encontrados.map(p => <button key={p.id} type="button" aria-pressed={p.id === padrao?.id} onClick={() => definirPadrao(p.id)} className={"w-full rounded-lg border px-3 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring " + (p.id === padrao?.id ? "border-primary/30 bg-primary/10 font-semibold text-primary" : "border-transparent hover:bg-muted")}>{p.nome}<span className="mt-1 block text-[11px] font-normal text-muted-foreground">{p.situacao}</span></button>)}</nav>
      </aside>
      <section className="min-w-0 space-y-4" aria-label="Demonstração interativa">
        {padrao ? <>
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-title">{padrao.nome}</h2><Badge variant="outline">{padrao.situacao}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{padrao.resumo}</p></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant={!configuracao.aplicado ? "default" : "outline"} aria-pressed={!configuracao.aplicado} onClick={() => definirConfiguracao(c => ({ ...c, aplicado: false }))}>Componente</Button><Button size="sm" variant={configuracao.aplicado ? "default" : "outline"} aria-pressed={configuracao.aplicado} onClick={() => definirConfiguracao(c => ({ ...c, aplicado: true }))}>Aplicado na tela</Button><Button size="sm" variant="ghost" onClick={() => definirReinicio(r => r + 1)}><RotateCcw className="size-3.5" />Reiniciar exemplo</Button></div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3">
            <label className="text-xs">Identidade<SelecaoFormulario className="mt-1" aria-label="Identidade" value={configuracao.identidade} onValueChange={valor => definirConfiguracao(c => ({ ...c, identidade: valor as IdentidadeInterface }))}><option value="hub">Grazing HUB</option><option value="etiquetas">Validades</option><option value="pedidos">Pedidos</option></SelecaoFormulario></label>
            <label className="text-xs">Aparência<SelecaoFormulario className="mt-1" aria-label="Aparência" value={configuracao.modo} onValueChange={valor => definirConfiguracao(c => ({ ...c, modo: valor as "claro" | "escuro" }))}><option value="claro">Claro</option><option value="escuro">Escuro</option></SelecaoFormulario></label>
            <label className="col-span-2 text-xs">Cenário<SelecaoFormulario className="mt-1" aria-label="Cenário" value={configuracao.estado} onValueChange={valor => definirConfiguracao(c => ({ ...c, estado: valor as EstadoDemonstracao }))}>{ESTADOS_DEMONSTRACAO.map(e => <option key={e} value={e}>{nomesEstados[e]}</option>)}</SelecaoFormulario></label>
          </div>
          <QuadroPrevia titulo="Experimento isolado" configuracao={previa} />
          {comparar && <QuadroPrevia titulo="Padrão publicado" configuracao={{ ...previa, valores: publicados }} />}
          <p className="text-xs text-muted-foreground">Somente o documento de prévia recebe os ajustes, incluindo suas janelas e listas abertas. Não há gravação de produtos. Mudanças de lógica exigem código, testes e deploy.</p>
        </> : <div role="status" className="rounded-xl border p-6"><h2 className="font-semibold">Nenhum padrão encontrado</h2><p className="mt-1 text-sm text-muted-foreground">Tente “ativar”, “editar preço” ou limpe a busca.</p><Button variant="outline" className="mt-3" onClick={() => definirBusca("")}>Limpar busca</Button></div>}
      </section>
      <aside className="ds-central-propriedades min-w-0" aria-label="Ajustes contextuais">{padrao && <details open className="rounded-xl border bg-card p-3"><summary className="cursor-pointer text-sm font-semibold">Ajustes · {padrao.nome}</summary><div className="mt-4 space-y-4">
        {padrao.chavesEditaveis?.length ? <EditorTokens valores={valores} base={publicados} aoMudar={definirValores} chaves={padrao.chavesEditaveis} titulo="Propriedades permitidas" descricao="Prévia local até salvar e publicar." /> : <p className="text-xs text-muted-foreground">Este padrão não expõe ajustes visuais globais. Seu comportamento permanece no código compartilhado.</p>}
        <dl className="space-y-3 break-words text-xs"><div><dt className="font-semibold">Escopo e consumidores</dt><dd className="mt-1 text-muted-foreground">{padrao.consumidores.join(" · ")}</dd></div><div><dt className="font-semibold">Fonte única</dt><dd className="mt-1 text-muted-foreground">{padrao.fonte}</dd></div><div><dt className="font-semibold">Restrições</dt><dd className="mt-1 text-muted-foreground">{padrao.restricoes}</dd></div></dl>
        <details className="text-xs"><summary className="cursor-pointer font-semibold">Referência técnica</summary><dl className="mt-2 space-y-2">{padrao.valores.map(v => <div key={v.rotulo}><dt className="font-medium">{v.rotulo}</dt><dd className="break-words text-muted-foreground">{v.valor} · {v.origem}</dd></div>)}</dl><p className="mt-2 break-all text-muted-foreground">ID: {padrao.id} · implementação: {padrao.componente}</p></details>
      </div></details>}</aside>
    </div>
    <GestaoPublicacao valores={valores} revisao={revisao} dados={dados} salvando={salvando} aoSalvar={() => iniciarSalvar(async () => {
      try { const resultado = await salvarRascunhoDesignAction({ valores, revisao, versaoBase: dados.revisaoPublicada }); if ("erro" in resultado) { toast.error(resultado.erro); return; } definirRevisao(resultado.rascunho?.revisao ?? revisao); toast.success(resultado.mensagem); roteador.refresh(); }
      catch { toast.error("Não foi possível confirmar o salvamento. Seu experimento foi mantido."); }
    })} aoPublicado={(_versao, limpar = true) => { if (limpar) { definirValores({}); definirRevisao(0); } roteador.refresh(); }} />
  </div>;
}

function GestaoPublicacao({ valores, revisao, dados, salvando, aoSalvar, aoPublicado }: { valores: ValoresTemaParciais; revisao: number; dados: DadosCentralDesign; salvando: boolean; aoSalvar: () => void; aoPublicado: (versao: VersaoDesignTela, limpar?: boolean) => void }) {
  const [motivo, definirMotivo] = useState("");
  const [dialogo, definirDialogo] = useState<"publicar" | VersaoDesignTela | null>(null);
  const [ocupado, iniciar] = useTransition();
  const trava = useRef(false);
  const pedido = useRef({ assinatura: "", chave: "" });
  const base = dados.publicada?.valores ?? VALORES_FABRICA;
  const experimento = resolverTema({ ...base, ...valores });
  const desatualizado = Boolean(dados.rascunho && dados.rascunho.versaoBase !== dados.revisaoPublicada);
  const temMudancas = (Object.keys(REGISTRO_TOKENS) as ChaveTokenDesign[]).some(k => valores[k] !== dados.rascunho?.valores[k]);
  const podePublicar = revisao > 0 && !temMudancas && !desatualizado;
  const destino = dialogo && dialogo !== "publicar" ? dialogo.valores : experimento;
  const alteracoes = (Object.keys(REGISTRO_TOKENS) as ChaveTokenDesign[]).filter(k => destino[k] !== base[k]);
  function abrir(alvo: "publicar" | VersaoDesignTela) { definirMotivo(""); definirDialogo(alvo); }
  function confirmar() {
    if (trava.current || !dialogo) return;
    trava.current = true;
    const payload = { motivo, revisao, versaoBase: dados.revisaoPublicada, versaoId: dialogo === "publicar" ? null : dialogo.id };
    const assinatura = JSON.stringify(payload);
    if (pedido.current.assinatura !== assinatura) pedido.current = { assinatura, chave: crypto.randomUUID() };
    iniciar(async () => {
      try {
        const resultado = dialogo === "publicar"
          ? await publicarRascunhoDesignAction({ revisao, motivo, chaveIdempotencia: pedido.current.chave })
          : await restaurarVersaoDesignAction({ versaoId: dialogo.id, versaoBase: dados.revisaoPublicada, motivo, chaveIdempotencia: pedido.current.chave });
        if ("erro" in resultado) { toast.error(resultado.erro); return; }
        if (resultado.publicada) aoPublicado(resultado.publicada, dialogo === "publicar");
        toast.success(resultado.mensagem); definirDialogo(null);
      } catch { toast.error("Resposta não confirmada. Tente novamente: o mesmo pedido não cria outra versão."); }
      finally { trava.current = false; }
    });
  }
  return <section aria-labelledby="publicacao-heading" className="space-y-4 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="publicacao-heading" className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-primary" />Rascunho, versões e publicação</h2><p className="mt-1 text-xs text-muted-foreground">A prévia é local. Publicar altera o padrão compartilhado dos componentes conectados.</p></div><Badge variant="outline">{desatualizado ? "Revisão necessária" : podePublicar ? `Rascunho salvo · revisão ${revisao}` : temMudancas ? "Alterações não salvas" : "Sem rascunho salvo"}</Badge></div>
    {desatualizado && <p role="alert" className="rounded-lg border border-warning/30 bg-warning-bg p-3 text-sm text-warning">A versão publicada mudou desde este rascunho. Compare o experimento com o publicado. “Revisar e salvar” reaplica suas escolhas sobre a versão atual, sem publicar.</p>}
    <div className="flex flex-wrap gap-2"><Button onClick={aoSalvar} disabled={salvando || (!temMudancas && !desatualizado)}><Save className="size-4" />{salvando ? "Salvando…" : desatualizado ? "Revisar e salvar" : "Salvar rascunho"}</Button><Button variant="secondary" disabled={!podePublicar} onClick={() => abrir("publicar")}><Send className="size-4" />Revisar publicação</Button></div>
    {temMudancas && <p className="text-xs text-muted-foreground">Salve antes de publicar. O servidor verifica valores, contraste, permissão e revisão.</p>}
    {!!dados.versoes.length && <details><summary className="cursor-pointer text-sm font-semibold">Histórico de versões ({dados.versoes.length} recentes)</summary><div className="mt-3 space-y-2">{dados.versoes.map(v => <div key={v.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">Versão {v.numero} · {v.tipo === "RESTAURACAO" ? `Restauração de ${v.versaoOrigemNumero}` : "Publicação"}</p><p className="text-xs text-muted-foreground">{v.autor} · {new Date(v.criadaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {v.motivo}</p></div><Button variant="outline" size="sm" onClick={() => abrir(v)}><RotateCcw className="size-3" />Revisar restauração</Button></div><details className="mt-2 text-xs"><summary>Conteúdo imutável</summary><dl className="mt-2 grid gap-1">{(Object.keys(REGISTRO_TOKENS) as ChaveTokenDesign[]).map(k => <div key={k} className="break-words"><dt className="inline font-medium">{REGISTRO_TOKENS[k].rotulo}: </dt><dd className="inline">{v.valores[k]}</dd></div>)}</dl></details></div>)}</div></details>}
    {!!dados.eventos.length && <details><summary className="cursor-pointer text-sm font-semibold">Auditoria recente</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{dados.eventos.map(e => <li key={e.id}>{e.acao} · {e.autor} · {new Date(e.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</li>)}</ul></details>}
    <Dialog open={dialogo !== null} onOpenChange={v => { if (!v && !ocupado) definirDialogo(null); }} protegerAlteracoes={false}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{dialogo === "publicar" ? "Revisar publicação" : "Revisar restauração"}</DialogTitle><DialogDescription>Uma nova versão será criada sobre a versão {dados.revisaoPublicada}. O histórico será preservado. Alterações alcançam HUB e Validades conforme o escopo abaixo.</DialogDescription></DialogHeader>
      <div className="max-h-72 overflow-auto rounded-lg border"><Table className="w-full text-left text-xs"><TableCaption className="sr-only">Antes e depois das propriedades</TableCaption><TableHeader><TableRow className="bg-muted"><TableHead className="p-2">Propriedade / escopo</TableHead><TableHead className="p-2">Publicado</TableHead><TableHead className="p-2">Novo</TableHead></TableRow></TableHeader><TableBody>{alteracoes.map(k => <TableRow key={k} className="border-t"><TableHead className="p-2 font-medium">{REGISTRO_TOKENS[k].rotulo}<span className="block font-normal text-muted-foreground">{k.startsWith("cor.hub") ? "HUB" : k.startsWith("cor.etiquetas") ? "Validades" : "Sistema compartilhado"}</span></TableHead><TableCell className="break-all p-2">{base[k]}</TableCell><TableCell className="break-all p-2">{destino[k]}</TableCell></TableRow>)}</TableBody></Table>{!alteracoes.length && <p className="p-3 text-sm">Nenhuma propriedade diferente do publicado.</p>}</div>
      <p className="text-xs text-muted-foreground">Consumidores: componentes UI, ações/status, formulários, cartões e layout conectados. Regras fiscais, cálculos, impressos e ZPL não mudam. Restaurar preserva rascunhos existentes e exige revisar sua base antes de publicá-los.</p>
      <label className="grid gap-2 text-sm">Motivo<Textarea value={motivo} onChange={e => definirMotivo(e.target.value)} maxLength={500} disabled={ocupado} /></label>
      <DialogFooter><DialogClose render={<Button variant="outline" disabled={ocupado} />}>Cancelar</DialogClose><Button disabled={ocupado || motivo.trim().length < 5} onClick={confirmar}>{ocupado ? "Confirmando…" : dialogo === "publicar" ? "Confirmar publicação" : "Confirmar restauração"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}

function QuadroPrevia({ titulo, configuracao }: { titulo: string; configuracao: ConfiguracaoLaboratorio }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [altura, definirAltura] = useState(320);
  useEffect(() => {
    const receber = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin || evento.source !== iframe.current?.contentWindow) return;
      const dado = evento.data;
      if (dado?.canal === "grazing-design-lab" && dado.tipo === "pronto") iframe.current?.contentWindow?.postMessage(configuracao, window.location.origin);
      if (dado?.canal === "grazing-design-lab" && dado.tipo === "altura" && Number.isFinite(dado.altura) && dado.altura > 0) definirAltura(Math.max(260, Math.min(1200, dado.altura + 8)));
    };
    window.addEventListener("message", receber);
    return () => window.removeEventListener("message", receber);
  }, [configuracao]);
  const enviar = () => iframe.current?.contentWindow?.postMessage(configuracao, window.location.origin);
  useEffect(enviar, [configuracao]);
  return <div className="min-w-0 overflow-hidden rounded-xl border bg-background"><div className="flex flex-wrap justify-between gap-2 border-b px-3 py-2"><h3 className="text-sm font-semibold">{titulo}</h3><span className="text-xs text-muted-foreground">Dados sintéticos · sem gravação</span></div><iframe ref={iframe} src="/configuracoes/design/laboratorio" title={titulo} style={{ height: altura }} className="w-full bg-background" onLoad={enviar} /></div>;
}
