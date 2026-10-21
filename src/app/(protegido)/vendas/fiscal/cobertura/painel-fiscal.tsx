"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead } from "@/components/ui/table";
import { Tabs, TabsList, TabsContent, TabsTriggerBotao } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { CabecalhoVendas, Vazio } from "../../componentes";
import type { ImpactoFiscal, PainelFiscal, TipoVersaoFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { analisarImpactoFiscalAction, ativarVersaoFiscalAction } from "../estrutura-actions";
import { EditorVersaoFiscal } from "./versao-editor";
import { DetalhesAnaliseNcm, ncmDiscriminadoPorEscolha } from "@/components/fiscal/analise-ncm";

const estados = { APTO: "Classificação confirmada", PENDENTE: "Emissão pendente", CONFIGURACAO: "Opção de configuração" };
const tipos: Record<TipoVersaoFiscal, string> = { CLASSIFICACAO: "Classificação", PERFIL: "Perfil", REGRA: "Regra", TABELA: "Tabela oficial", COMPLEMENTO: "Complemento" };
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const data = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split("-").reverse().join("/") : s;
function Evidencias({ valor }: { valor: unknown }) {
  function descrever(v: unknown) {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "nome" in v) {
      const c = v as { nome: unknown; quantidade?: unknown; unidade?: unknown };
      return [String(c.nome), [c.quantidade, c.unidade].filter(a => a != null).join(" ")].filter(Boolean).join(" · ");
    }
    return "Referência registrada no histórico fiscal.";
  }
  if (Array.isArray(valor)) return valor.length ? <ul className="list-disc space-y-1 pl-5">{valor.map((v, i) => <li key={i}>{descrever(v)}</li>)}</ul> : <p className="text-muted-foreground">Sem referência registrada.</p>;
  return <p>{valor == null ? "Sem evidência registrada." : descrever(valor)}</p>;
}

export function PainelEstruturaFiscal({ painel, abaInicial = "cobertura" }: { painel: PainelFiscal; abaInicial?: "cobertura" | "regras" }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [ordem, setOrdem] = useState<{ coluna: "nome" | "grupo"; direcao: "asc" | "desc" }>({ coluna: "nome", direcao: "asc" });
  const [editor, setEditor] = useState<{ tipo: TipoVersaoFiscal; versao?: VersaoFiscalDto; produtoId?: string; evidencia?: string; ncm?: string } | null>(null);
  const [impacto, setImpacto] = useState<{ versao: VersaoFiscalDto; dados: ImpactoFiscal } | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const trava = useRef(false); const router = useRouter();
  const pesquisados = useMemo(() => painel.produtos.filter(p => normalizar([p.nome, p.codigo, p.grupo, p.ncm, ...p.pendencias].join(" ")).includes(normalizar(busca))), [painel.produtos, busca]);
  const lista = pesquisados.filter(p => filtro === "TODOS" || p.status === filtro).sort((a, b) => {
    const resultado = (a[ordem.coluna] ?? "").localeCompare(b[ordem.coluna] ?? "", "pt-BR", { sensitivity: "base" }) || a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id);
    return ordem.direcao === "asc" ? resultado : -resultado;
  });
  function ordenar(coluna: "nome" | "grupo") { setOrdem(a => ({ coluna, direcao: a.coluna === coluna && a.direcao === "asc" ? "desc" : "asc" })); }
  function classificar(produtoId: string, evidencia?: string, ncm?: string) {
    const versao = painel.versoes.filter(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId).sort((a, b) => b.versao - a.versao)[0];
    setEditor({ tipo: "CLASSIFICACAO", produtoId, versao, evidencia, ncm });
  }
  function executar(tarefa: () => Promise<void>) {
    if (trava.current) return; trava.current = true; setErro("");
    iniciar(async () => { try { await tarefa(); } catch { setErro("A ação não foi confirmada. Seu cadastro foi preservado; atualize e tente novamente."); } finally { trava.current = false; } });
  }
  function exportar() {
    const cabecalho = ["Identificador", "SKU", "Produto", "Grupo", "NCM", "Aplicabilidade NCM", "Confiança", "Origem da classificação", "Descrição oficial", "Data da análise", "Justificativa NCM", "Fontes NCM", "Cenários por escolha", "Situação de emissão", "Pendências", "Composição", "Evidências"];
    const celula = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""').replace(/^[=+@-]/, "'$&")}"`;
    const csv = [cabecalho, ...painel.produtos.map(p => [p.id, p.codigo, p.nome, p.grupo, p.ncm, p.ncmAplicabilidade === "NAO_APLICAVEL" ? "Não aplicável" : ncmDiscriminadoPorEscolha(p) ? "Conforme escolha" : p.ncmAplicabilidade === "APLICAVEL" ? "Aplicável" : "Não registrada", p.analiseNcm?.confianca, p.analiseNcm?.fundamento, p.analiseNcm?.descricaoNcm, p.analiseNcm?.dataAnalise, p.analiseNcm?.justificativa, p.analiseNcm?.fontes.join(" | "), JSON.stringify(p.configuracaoNcm ?? {}), estados[p.status], p.pendencias.join(" | "), JSON.stringify(p.composicao), JSON.stringify(p.evidencias)])].map(l => l.map(celula).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "cobertura-fiscal-produtos.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-5">
    <CabecalhoVendas titulo="Estrutura fiscal" descricao="Cobertura dos produtos ativos, regras por vigência e evidências de classificação.">
      <Button nativeButton={false} render={<a href="/vendas/fiscal" />} variant="outline">Grupos fiscais</Button>
      <Button nativeButton={false} render={<a href="/vendas/fiscal/vinculos" />} variant="outline">Vínculos cadastrais</Button>
      <Button onClick={exportar} variant="outline"><Download className="size-4" />Exportar cobertura</Button>
    </CabecalhoVendas>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Produtos ativos", painel.resumo.ativos], ["Classificações confirmadas", painel.resumo.aptos], ["Emissão pendente", painel.resumo.pendentes], ["Opções de configuração", painel.resumo.configuracoes]].map(([titulo, quantidade]) => <Card size="sm" key={titulo}><CardHeader><CardDescription>{titulo}</CardDescription><CardTitle className="tabular-nums">{quantidade}</CardTitle></CardHeader></Card>)}</div>
    <p className="text-sm text-muted-foreground">Classificação confirmada indica cobertura cadastral. A prévia do pedido verifica perfil, operação, tabelas e cálculos antes da emissão. Alterações têm vigência própria e preservam documentos históricos.</p>
    <p className="text-sm text-muted-foreground">NCM não aplicável: {painel.produtos.filter(p => p.ncmAplicabilidade === "NAO_APLICAVEL").length} · NCM conforme escolha: {painel.produtos.filter(p => ncmDiscriminadoPorEscolha(p)).length}. A confiança e o fundamento do NCM são registrados separadamente das pendências para emitir.</p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Tabs defaultValue={abaInicial} className="space-y-4"><TabsList variant="buttons"><TabsTriggerBotao value="cobertura">Produtos</TabsTriggerBotao><TabsTriggerBotao value="regras">Regras e perfis</TabsTriggerBotao><TabsTriggerBotao value="fornecedores">Notas de fornecedores</TabsTriggerBotao><TabsTriggerBotao value="historico">Histórico e tabelas</TabsTriggerBotao></TabsList>
      <TabsContent value="cobertura" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3"><CampoBusca aria-label="Buscar cobertura fiscal" placeholder="Produto, SKU, NCM ou pendência" value={busca} onChange={setBusca} maxLength={200} />
          <FiltroOpcoesContadas nome="Situação fiscal" valor={filtro} onValueChange={setFiltro} opcoes={[{ valor: "TODOS", nome: "Todos", quantidade: pesquisados.length }, ...Object.keys(estados).map(valor => ({ valor, nome: valor === "APTO" ? "Confirmados" : valor === "PENDENTE" ? "Pendentes" : "Configurações", quantidade: pesquisados.filter(p => p.status === valor).length }))]} />
        </div>
        {!lista.length ? <Vazio>{painel.produtos.length ? "Nenhum produto encontrado com estes filtros." : "Nenhum produto ativo para classificar."}</Vazio> : <Card><CardContent><Table><TableHeader><TableRow><SortableTableHead active={ordem.coluna === "nome"} direction={ordem.direcao} onClick={() => ordenar("nome")}>Produto / SKU</SortableTableHead><SortableTableHead active={ordem.coluna === "grupo"} direction={ordem.direcao} onClick={() => ordenar("grupo")}>Grupo fiscal</SortableTableHead><TableHead>NCM</TableHead><TableHead>Cobertura e evidências</TableHead>{painel.administrador && <TableHead>Ação</TableHead>}</TableRow></TableHeader><TableBody>{lista.map(p => <TableRow key={p.id}><TableCell><p className="font-medium">{p.nome}</p><p className="text-xs text-muted-foreground">{p.codigo ?? "Sem SKU"} · {p.papeis.join(" / ")}</p></TableCell><TableCell>{p.grupo ?? "Sem grupo"}</TableCell><TableCell className="tabular-nums">{p.ncmAplicabilidade === "NAO_APLICAVEL" ? "NCM não aplicável" : ncmDiscriminadoPorEscolha(p) ? "Conforme escolha" : p.ncm ?? "Não definido"}<DetalhesAnaliseNcm valor={p} /></TableCell><TableCell><Badge variant={p.status === "PENDENTE" ? "outline" : "secondary"} className="whitespace-normal">{estados[p.status]}</Badge>{p.pendencias.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{p.pendencias.map((m, i) => <li key={i}>{m}</li>)}</ul>}<details className="mt-2 text-xs"><summary className="cursor-pointer">Composição e evidências</summary><div className="mt-2 space-y-2 break-words"><Evidencias valor={p.evidencias} /><Evidencias valor={p.composicao} /></div></details></TableCell>{painel.administrador && <TableCell><Button size="sm" variant="outline" onClick={() => classificar(p.id)}>Classificar</Button></TableCell>}</TableRow>)}</TableBody></Table></CardContent></Card>}
      </TabsContent>
      <TabsContent value="regras" className="space-y-4">
        <GrupoAcoes alinhamento="inicio" className="flex-wrap">{painel.administrador && (["PERFIL", "REGRA", "COMPLEMENTO"] as const).map(tipo => <Button key={tipo} variant="outline" onClick={() => setEditor({ tipo })}><Plus className="size-4" />{tipo === "PERFIL" ? "Novo perfil" : tipo === "REGRA" ? "Nova regra" : "Tratamento de complemento"}</Button>)}</GrupoAcoes>
        <p className="text-sm text-muted-foreground">Perfis confirmam estabelecimento, regime e emissor responsável. Regras definem o tratamento por mercadoria, destino e destinatário. A vigência de 2027 só se aplica após confirmação do enquadramento.</p>
        <Versoes lista={painel.versoes.filter(v => ["PERFIL", "REGRA", "COMPLEMENTO"].includes(v.tipo))} administrador={painel.administrador} ocupado={ocupado} editar={v => setEditor({ tipo: v.tipo, versao: v })} analisar={v => executar(async () => { const r = await analisarImpactoFiscalAction(v.id); if ("erro" in r) setErro(r.erro ?? "A ação não foi confirmada."); else setImpacto({ versao: v, dados: r.impacto }); })} />
      </TabsContent>
      <TabsContent value="fornecedores" className="space-y-4"><p className="text-sm text-muted-foreground">Compare NCM das notas recebidas com o produto comercial. A referência do fornecedor comprova a mercadoria de entrada; preparações Grazing precisam de análise própria. Conciliar cria um rascunho prospectivo.</p>
        {!painel.entradas.length ? <Vazio>Nenhuma evidência de nota de entrada vinculada aos produtos ativos.</Vazio> : <Card><CardContent><Table><TableHeader><TableRow><TableHead>Mercadoria do fornecedor</TableHead><TableHead>NCM recebido</TableHead><TableHead>Produto comercial</TableHead><TableHead>Evidência</TableHead>{painel.administrador && <TableHead>Ação</TableHead>}</TableRow></TableHeader><TableBody>{painel.entradas.map((e, i) => <TableRow key={`${e.produtoId}-${e.insumoId}-${i}`}><TableCell><p>{e.insumo}</p><p className="text-xs text-muted-foreground">{e.descricao}</p></TableCell><TableCell>{e.ncm}</TableCell><TableCell>{painel.produtos.find(p => p.id === e.produtoId)?.nome ?? "Produto vinculado"}</TableCell><TableCell className="break-words">{e.evidencia}</TableCell>{painel.administrador && <TableCell><Button size="sm" variant="outline" onClick={() => classificar(e.produtoId, e.evidencia, e.ncm)}>Conciliar</Button></TableCell>}</TableRow>)}</TableBody></Table></CardContent></Card>}
      </TabsContent>
      <TabsContent value="historico" className="space-y-4">{painel.administrador && <Button variant="outline" onClick={() => setEditor({ tipo: "TABELA" })}><Plus className="size-4" />Importar tabela oficial</Button>}<Versoes lista={painel.versoes} administrador={painel.administrador} ocupado={ocupado} editar={v => setEditor({ tipo: v.tipo, versao: v })} analisar={v => executar(async () => { const r = await analisarImpactoFiscalAction(v.id); if ("erro" in r) setErro(r.erro ?? "A ação não foi confirmada."); else setImpacto({ versao: v, dados: r.impacto }); })} /></TabsContent>
    </Tabs>
    {editor && <EditorVersaoFiscal {...editor} painel={painel} fechar={() => setEditor(null)} />}
    <Dialog open={!!impacto} protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto && !ocupado) setImpacto(null); }}><DialogContent className="sm:max-w-3xl" showCloseButton={!ocupado}><DialogHeader><DialogTitle>Análise de impacto</DialogTitle><DialogDescription>Ativar cria vigência para as próximas operações; documentos e snapshots anteriores permanecem preservados.</DialogDescription></DialogHeader>{impacto && <div className="space-y-4"><p>{tipos[impacto.versao.tipo]} · versão {impacto.versao.versao} · início {data(impacto.versao.vigenciaInicio)}</p><p className="font-medium">{impacto.dados.produtosAfetados} produto(s) afetado(s) · {impacto.dados.documentosPreservados} documento(s) preservado(s)</p><ul className="list-disc space-y-1 pl-5 text-sm">{impacto.dados.resumo.map((s, i) => <li key={i}>{s}</li>)}</ul>{impacto.dados.produtos.length > 0 && <div className="max-h-64 overflow-auto"><ul className="space-y-2 text-sm">{impacto.dados.produtos.map(p => <li key={p.id}><span className="font-medium">{p.nome}</span> · {p.motivos.join("; ")}</li>)}</ul></div>}{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><Button variant="outline" disabled={ocupado} onClick={() => setImpacto(null)}>Voltar</Button>{impacto.versao.status === "RASCUNHO" && painel.administrador && <Button disabled={ocupado} onClick={() => executar(async () => { const r = await ativarVersaoFiscalAction(impacto.versao.id, impacto.dados.hash, crypto.randomUUID()); if ("erro" in r) setErro(r.erro ?? "A ação não foi confirmada."); else { setImpacto(null); router.refresh(); } })}>{ocupado ? "Ativando…" : "Ativar versão"}</Button>}</GrupoAcoes></div>}</DialogContent></Dialog>
  </div>;
}

function Versoes({ lista, administrador, ocupado, editar, analisar }: { lista: VersaoFiscalDto[]; administrador: boolean; ocupado: boolean; editar: (v: VersaoFiscalDto) => void; analisar: (v: VersaoFiscalDto) => void }) {
  return !lista.length ? <Vazio>Nenhuma versão registrada neste grupo.</Vazio> : <Card><CardContent><Table><TableHeader><TableRow><TableHead>Configuração</TableHead><TableHead>Vigência</TableHead><TableHead>Situação</TableHead><TableHead>Autoria e evidências</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{lista.map(v => <TableRow key={v.id}><TableCell><p className="font-medium">{tipos[v.tipo]} · {v.chave}</p><p className="text-xs text-muted-foreground">Versão {v.versao}</p></TableCell><TableCell>{data(v.vigenciaInicio)}</TableCell><TableCell><Badge variant="outline">{v.status === "ATIVO" ? "Ativa" : "Rascunho"}</Badge></TableCell><TableCell><p>{v.criadoPorNome}</p><p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><details className="mt-2"><summary className="cursor-pointer text-xs">Justificativa e fontes</summary><p className="mt-2 text-sm">{v.justificativa}</p><ul className="mt-2 space-y-1 text-xs">{v.fontes.map((f, i) => <li className="break-words" key={i}>{/^https:\/\//.test(f) ? <a href={f} target="_blank" rel="noreferrer" className="underline">{f}</a> : f}</li>)}</ul></details></TableCell><TableCell><GrupoAcoes alinhamento="inicio">{administrador && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => editar(v)}>Nova versão</Button>}{administrador && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => analisar(v)}>Ver impacto</Button>}</GrupoAcoes></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}
