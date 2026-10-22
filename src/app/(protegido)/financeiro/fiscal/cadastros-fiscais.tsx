"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CampoBusca } from "@/components/campo-busca";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PainelFiscal, PerfilFiscal, RegraFiscal, TipoVersaoFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import { dadosFiscaisIniciais } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import { FiscalProdutoUnificado } from "./ficha-produto";
import { SelecaoFormulario } from "@/components/ui/select";
import { EdicaoFiscalVersionada } from "./edicao-versionada";
import { simularConciliacaoFiscalAction } from "./manutencao-actions";

export function CadastrosFiscais({ painel, produtoInicial }: { painel: PainelFiscal; produtoInicial?: string }) {
  const [busca, setBusca] = useState(""), [produto, setProduto] = useState<string | null>(produtoInicial ?? null);
  const [limite, setLimite] = useState(24);
  const fichaRef = useRef<HTMLElement>(null), buscaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ficha = fichaRef.current;
    if (!produto || !ficha) return;
    const posicionar = () => {
      if (!ficha.querySelector("[data-ficha-fiscal]")) return false;
      ficha.scrollIntoView?.({ block: "start", behavior: "smooth" }); ficha.focus({ preventScroll: true });
      return true;
    };
    if (posicionar()) return;
    const observador = new MutationObserver(() => { if (posicionar()) observador.disconnect(); });
    observador.observe(ficha, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, [produto]);
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const produtos = painel.produtos.filter(p => normalizar(`${p.nome} ${p.codigo ?? ""} ${p.ncm ?? ""}`).includes(normalizar(busca)));
  return <div className="space-y-5"><BarraAcoes titulo="Fiscal dos produtos" descricao="Os mesmos dados da aba Fiscal do produto." />
    <div ref={buscaRef}><CampoBusca aria-label="Buscar produto fiscal" placeholder="Produto, código ou NCM" value={busca} onChange={setBusca} maxLength={200} /></div>
    <div className="grid gap-3 md:grid-cols-2">{produtos.slice(0, limite).map(p => <Card className="vidro-painel" key={p.id}><CardHeader><CardTitle>{p.nome}</CardTitle><CardDescription>NCM {p.ncm ?? "pendente"} · {p.status === "APTO" ? "Classificação confirmada" : "Configuração a conferir"}</CardDescription></CardHeader><CardContent><Button type="button" variant="outline" aria-label={`${produto === p.id ? "Fechar" : "Abrir"} Fiscal de ${p.nome}`} onClick={() => setProduto(produto === p.id ? null : p.id)}>{produto === p.id ? "Fechar ficha" : "Abrir Fiscal do produto"}</Button></CardContent></Card>)}</div>
    {produtos.length > limite && <Button type="button" variant="outline" onClick={() => setLimite(v => v + 24)}>Mostrar mais produtos ({limite} de {produtos.length})</Button>}
    {!produtos.length && <p role="status" className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
    {produto && <section ref={fichaRef} tabIndex={-1} id="ficha-fiscal" aria-label="Ficha fiscal selecionada" className="scroll-mt-24 space-y-3"><Button type="button" variant="outline" onClick={() => { setProduto(null); buscaRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }); buscaRef.current?.querySelector("input")?.focus({ preventScroll: true }); }}>Voltar aos produtos</Button><FiscalProdutoUnificado key={produto} produtoId={produto} /></section>}

  </div>;
}

export function RegrasFiscaisVisiveis({ painel, grupoId }: { painel: PainelFiscal; grupoId?: string }) {
  const [editor, setEditor] = useState<VersaoFiscalDto | "NOVA" | null>(null);
  const [novaChave, setNovaChave] = useState("");
  const [busca, setBusca] = useState(""), [limite, setLimite] = useState(12), [historicas, setHistoricas] = useState(false);
  const router = useRouter();
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const vigentes = versoesVigentes(painel.versoes, hoje), perfil = vigentes.find(v => v.tipo === "PERFIL" && v.chave === "singleton")?.dados as PerfilFiscal | undefined;
  const nomeRegra = (r: RegraFiscal) => r.produtoId ? r.produtoId.startsWith("INSUMO:") ? painel.insumos?.find(i => `INSUMO:${i.id}` === r.produtoId)?.nome ?? "Referência interna indisponível" : painel.produtos.find(p => p.id === r.produtoId)?.nome ?? "Produto indisponível" : painel.grupos.find(g => g.id === r.grupoFiscalId)?.nome ?? `Regra anterior ${r.grupo ?? "geral"}`;
  const regras = painel.versoes.filter(v => {
    if (v.tipo !== "REGRA") return false;
    const r = v.dados as RegraFiscal;
    const texto = `${nomeRegra(r)} ${r.grupo ?? ""} ${r.ufDestino} ${r.modelo ?? "55/65"} ${r.ncm ?? ""} ${r.cfop} ${r.csosn ?? r.icms.cst}`;
    return (!grupoId || r.grupoFiscalId === grupoId) && (historicas || v.status === "RASCUNHO" || v.vigenciaInicio > hoje || vigentes.some(a => a.id === v.id)) && texto.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
  });
  const iniciais = editor === "NOVA" ? { ...dadosFiscaisIniciais("REGRA") as RegraFiscal, estabelecimento: "singleton", regime: perfil?.regime ?? "SIMPLES_NACIONAL", ufDestino: perfil?.uf ?? "SP", grupoFiscalId: grupoId ?? null } : editor?.dados;
  const chave = editor === "NOVA" ? novaChave : editor?.chave;
  return <Card className="vidro-painel"><CardHeader><CardTitle>{grupoId ? "Padrões do grupo por operação" : "Regras fiscais existentes"}</CardTitle><CardDescription>Exceções do produto prevalecem sobre o padrão do grupo. Regras anteriores conservam seus IDs e alcance.</CardDescription></CardHeader><CardContent className="space-y-4">
    {painel.administrador && <Button type="button" variant="outline" onClick={() => { setNovaChave(`grupo-${grupoId ?? "geral"}-${crypto.randomUUID()}`); setEditor("NOVA"); }}>Criar regra {grupoId ? "do grupo" : "por operação"}</Button>}
    <CampoBusca aria-label="Buscar regra fiscal" placeholder="Grupo, produto, destino ou código" maxLength={200} value={busca} onChange={v => { setBusca(v); setLimite(12); }} />
    <Button type="button" variant="outline" onClick={() => { setHistoricas(v => !v); setLimite(12); }}>{historicas ? "Ocultar históricas" : "Incluir versões históricas"}</Button>
    {!regras.length && <p className="text-sm text-muted-foreground">Nenhuma regra registrada para este grupo. Nenhum parâmetro será presumido.</p>}
    {regras.slice(0, limite).map(v => { const r = v.dados as RegraFiscal; return <section key={v.id} className="space-y-2 border-b pb-3 text-sm"><p className="font-medium">{nomeRegra(r)} · {r.ufDestino} · {r.destinatario === "CONTRIBUINTE" ? "Contribuinte" : "Consumo final"} · {r.modelo ?? "55/65"}</p><p>CFOP {r.cfop} · {r.csosn ? `CSOSN ${r.csosn}` : `CST ${r.icms.cst}`} · {r.habilitada === false ? "Desabilitada nesta versão" : "Habilitada"} · versão {v.versao} · {v.status === "RASCUNHO" ? "Rascunho" : vigentes.some(a => a.id === v.id) ? "Vigente" : "Histórica ou futura"}</p>{painel.administrador && <Button type="button" size="sm" variant="outline" onClick={() => setEditor(v)}>{v.status === "RASCUNHO" ? "Retomar rascunho" : "Editar em nova versão"}</Button>}</section>; })}
    {regras.length > limite && <Button type="button" variant="outline" onClick={() => setLimite(v => v + 12)}>Mostrar mais regras ({limite} de {regras.length})</Button>}
    {editor && iniciais && chave && <EdicaoFiscalVersionada key={editor === "NOVA" ? chave : editor.id} titulo="Regra fiscal por operação" tipo="REGRA" chave={chave} inicial={iniciais} painel={painel} versao={editor === "NOVA" ? undefined : editor} fechar={() => setEditor(null)} atualizado={() => router.refresh()} />}
  </CardContent></Card>;
}

export function ConciliacaoFiscal() {
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof simularConciliacaoFiscalAction>> | null>(null), [ocupado, setOcupado] = useState(false);
  async function simular() {
    setOcupado(true);
    try { setResultado(await simularConciliacaoFiscalAction()); }
    catch { setResultado({ erro: "Não foi possível simular. Tente novamente." }); }
    finally { setOcupado(false); }
  }
  return <details className="space-y-3 rounded-xl border p-4">
    <summary className="cursor-pointer text-sm font-medium">Conciliação dos cadastros anteriores</summary>
    <p className="text-sm text-muted-foreground">Simule as diferenças reais antes de decidir. A simulação não grava nem seleciona parâmetros tributários.</p>
    <Button type="button" variant="outline" disabled={ocupado} onClick={() => void simular()}>Simular comparação</Button>
    {resultado && ("erro" in resultado ? <p role="alert" className="text-sm text-destructive">{resultado.erro}</p> : <div className="space-y-3">{resultado.dados.map(p => <div key={p.id} className="space-y-1 border-b pb-2 text-sm">
      <p className="font-medium">{p.nome}</p>
      <p>Grupo cadastrado: {p.grupoCadastro ?? "ausente"} · motor: {p.grupoMotor ?? "ausente"}</p>
      {p.classificacaoAusente && <p>Classificação versionada ausente.</p>}
      {p.diferencas.map(d => <p key={d.campo}>{d.campo}: {d.cadastrado || "vazio"} → vigente {d.vigente || "vazio"}</p>)}
      {p.regras.flatMap(r => r.diferencas.map(d => <p key={`${r.id}:${d.campo}`}>{r.contexto} · {d.campo}: {d.cadastrado || "vazio"} → vigente {d.vigente || "vazio"}</p>))}
    </div>)}</div>)}
  </details>;
}

export function DetalhesFiscais({ painel }: { painel: PainelFiscal }) {
  const [editor, setEditor] = useState<VersaoFiscalDto | null>(null), router = useRouter();
  const [novo, setNovo] = useState<null | { tipo: "COMPLEMENTO" | "CLASSIFICACAO" | "TABELA"; id: string }>(null);
  return <details className="space-y-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Complementos, referências internas e tabelas oficiais</summary><p className="text-sm text-muted-foreground">Funções preservadas da estrutura anterior. Edite e aplique nesta mesma tela.</p>
    {painel.administrador && <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm">Configurar complemento<SelecaoFormulario aria-label="Configurar complemento" value="" onValueChange={id => { if (id) setNovo({ tipo: "COMPLEMENTO", id }); }}><option value="">Selecione uma opção existente</option>{painel.opcoes.map(o => <option value={o.id} key={o.id}>{o.nome}</option>)}</SelecaoFormulario></label>
      <label className="grid gap-1.5 text-sm">Classificar mercadoria interna do kit<SelecaoFormulario aria-label="Classificar mercadoria interna do kit" value="" onValueChange={id => { if (id) setNovo({ tipo: "CLASSIFICACAO", id }); }}><option value="">Selecione um insumo existente</option>{painel.insumos?.map(i => <option value={i.id} key={i.id}>{i.nome} · {i.unidade}</option>)}</SelecaoFormulario></label>
      <label className="grid gap-1.5 text-sm">Atualizar tabela oficial<SelecaoFormulario aria-label="Atualizar tabela oficial" value="" onValueChange={id => { if (id) setNovo({ tipo: "TABELA", id }); }}><option value="">Selecione a tabela</option>{["NCM", "CFOP", "CSOSN", "CST_ICMS", "CST_PIS_COFINS", "CST_IPI", "CEST", "CST_IBSCBS", "CCLASSTRIB"].map(t => <option key={t} value={t}>{t}</option>)}</SelecaoFormulario></label>
    </div>}
    {novo && (() => {
      const chave = novo.tipo === "CLASSIFICACAO" ? `INSUMO:${novo.id}` : novo.id;
      const anterior = painel.versoes.filter(v => v.tipo === novo.tipo && v.chave === chave).sort((a, b) => b.versao - a.versao)[0];
      const inicial = anterior?.dados ?? (novo.tipo === "CLASSIFICACAO" ? { ...dadosFiscaisIniciais("CLASSIFICACAO"), produtoId: null, referenciaInternaInsumoId: novo.id, unidade: painel.insumos?.find(i => i.id === novo.id)?.unidade ?? "UN" } : novo.tipo === "COMPLEMENTO" ? { ...dadosFiscaisIniciais("COMPLEMENTO"), opcaoId: novo.id } : { ...dadosFiscaisIniciais("TABELA"), tabela: novo.id });
      return <EdicaoFiscalVersionada key={chave} titulo="Configuração fiscal complementar" tipo={novo.tipo} chave={chave} inicial={inicial as VersaoFiscalDto["dados"]} versao={anterior} painel={painel} fechar={() => setNovo(null)} atualizado={() => router.refresh()} />;
    })()}
    {painel.versoes.filter(v => ["TABELA", "COMPLEMENTO"].includes(v.tipo) || v.tipo === "CLASSIFICACAO" && v.chave.startsWith("INSUMO:")).map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm"><span>{v.tipo === "TABELA" ? `Tabela ${v.chave}` : v.tipo === "COMPLEMENTO" ? painel.opcoes.find(o => o.id === v.chave)?.nome ?? "Complemento" : painel.insumos?.find(i => `INSUMO:${i.id}` === v.chave)?.nome ?? "Referência interna"} · versão {v.versao} · {v.status === "RASCUNHO" ? "Rascunho" : "Aplicada"}</span>{painel.administrador && <Button type="button" size="sm" variant="outline" onClick={() => setEditor(v)}>Revisar</Button>}</div>)}
    {editor && <EdicaoFiscalVersionada key={editor.id} titulo="Detalhes fiscais" tipo={editor.tipo as TipoVersaoFiscal} chave={editor.chave} inicial={editor.dados} versao={editor} painel={painel} fechar={() => setEditor(null)} atualizado={() => router.refresh()} />}
  </details>;
}
