"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelecaoFormulario } from "@/components/ui/select";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { compararCadastroFiscal, regrasDaOperacao, valoresClassificacao, valoresRegra } from "@/lib/tributacao/ficha";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import type { ClassificacaoFiscal, ContextoFiscal, PerfilFiscal, RegraFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { dadosFiscaisIniciais } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import { consultarFichaFiscalAction } from "./manutencao-actions";
import { EdicaoFiscalVersionada } from "./edicao-versionada";

export type FichaFiscalDados = Extract<Awaited<ReturnType<typeof consultarFichaFiscalAction>>, { ok: true }>["dados"];
const rotulosRegra: Record<string, string> = { cfop: "CFOP", csosn: "CSOSN", cstIcms: "CST ICMS", pis: "CST PIS", cofins: "CST COFINS" };
export function FiscalProdutoUnificado({ produtoId, inicial, editar = true }: { produtoId: string; inicial?: FichaFiscalDados; editar?: boolean }) {
  const [dados, setDados] = useState(inicial), [erro, setErro] = useState(""), [recarregar, setRecarregar] = useState(0);
  useEffect(() => {
    if (inicial && !recarregar) return;
    let vigente = true;
    consultarFichaFiscalAction(produtoId).then(r => { if (!vigente) return; if ("erro" in r) setErro(r.erro ?? "A operação fiscal não foi concluída."); else { setDados(r.dados); setErro(""); } }).catch(() => { if (vigente) setErro("Não foi possível carregar a ficha fiscal. Tente novamente."); });
    return () => { vigente = false; };
  }, [produtoId, inicial, recarregar]);
  if (erro) return <div data-ficha-fiscal="erro" className="space-y-3"><p role="alert" className="text-sm text-destructive">{erro}</p><Button type="button" variant="outline" onClick={() => setRecarregar(v => v + 1)}>Tentar novamente</Button></div>;
  return dados ? <FichaFiscal key={produtoId} dados={dados} editar={editar && dados.painel.administrador} atualizado={() => setRecarregar(v => v + 1)} /> : <p role="status" className="text-sm text-muted-foreground">Carregando configuração fiscal vigente…</p>;
}

function FichaFiscal({ dados, editar, atualizado }: { dados: FichaFiscalDados; editar: boolean; atualizado: () => void }) {
  const { painel, produto, dia } = dados;
  const [modelo, setModelo] = useState<"55" | "65">("65"), [uf, setUf] = useState("SP"), [destinatario, setDestinatario] = useState<ContextoFiscal["destinatario"]>("CONSUMIDOR_FINAL");
  const [editor, setEditor] = useState<{ tipo: "CLASSIFICACAO" | "REGRA"; versao?: VersaoFiscalDto } | null>(null);
  const vs = versoesVigentes(painel.versoes, dia), cv = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === produto.id), c = cv?.dados as ClassificacaoFiscal | undefined;
  const perfil = vs.find(v => v.tipo === "PERFIL" && v.chave === "singleton")?.dados as PerfilFiscal | undefined;
  const contexto: ContextoFiscal = { data: dia, estabelecimento: "singleton", ufDestino: uf, destinatario, modelo, operacao: "VENDA" };
  const resolucao = c && perfil ? regrasDaOperacao(vs, c, produto.id, contexto, perfil) : undefined;
  const rv = resolucao?.efetiva, r = rv?.dados as RegraFiscal | undefined;
  const diffs = compararCadastroFiscal(produto.fiscal, { ...valoresClassificacao(c), ...valoresRegra(r) });
  const grupo = painel.grupos.find(g => g.id === c?.grupoFiscalId);
  const grupoCadastro = painel.grupos.find(g => g.id === produto.grupoFiscalId);
  const historico = painel.versoes.filter(v => v.tipo === "CLASSIFICACAO" && v.chave === produto.id || v.tipo === "REGRA" && ((v.dados as RegraFiscal).produtoId === produto.id || !!c?.grupoFiscalId && (v.dados as RegraFiscal).grupoFiscalId === c.grupoFiscalId || !(v.dados as RegraFiscal).produtoId && !!c?.grupo && (v.dados as RegraFiscal).grupo === c.grupo));
  function editarRegra() { setEditor({ tipo: "REGRA", versao: rv }); }
  const base = editor?.tipo === "CLASSIFICACAO" ? { ...(editor.versao?.dados ?? c ?? { ...dadosFiscaisIniciais("CLASSIFICACAO", produto.id), ...(produto.id.startsWith("INSUMO:") ? { produtoId: null, referenciaInternaInsumoId: produto.id.slice(7) } : {}), unidade: produto.unidade }) as ClassificacaoFiscal, grupoFiscalId: (editor.versao?.dados as ClassificacaoFiscal | undefined)?.grupoFiscalId ?? c?.grupoFiscalId ?? null } : editor?.versao?.dados ?? dadosFiscaisIniciais("REGRA");
  const regraPropria = editor?.tipo === "REGRA" && (editor.versao?.dados as RegraFiscal | undefined)?.produtoId === produto.id;
  const regraInicial = editor?.tipo === "REGRA" && !regraPropria ? { ...base as RegraFiscal, produtoId: produto.id, estabelecimento: perfil?.estabelecimento ?? "singleton", regime: perfil?.regime ?? "SIMPLES_NACIONAL", ufDestino: uf, destinatario, modelo } : base;
  const chave = editor?.tipo === "CLASSIFICACAO" ? produto.id : regraPropria ? editor!.versao!.chave : `produto-${produto.id.replace(/^INSUMO:/, "insumo-")}-${uf}-${destinatario === "CONTRIBUINTE" ? "C" : "F"}-${modelo}`;
  return <div data-ficha-fiscal="pronta" className="min-w-0 space-y-4">
    <Card className="vidro-painel"><CardHeader><CardTitle>Configuração fiscal do produto</CardTitle><p className="text-sm font-medium">{produto.nome}</p><CardDescription>Valores utilizados na prévia e na emissão. Alterações valem a partir da vigência aplicada.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm">Modelo<SelecaoFormulario aria-label="Modelo da ficha fiscal" disabled={!!editor} value={modelo} onValueChange={v => setModelo(v as typeof modelo)}><option value="65">NFC-e · 65</option><option value="55">NF-e · 55</option></SelecaoFormulario></label>
        <label className="grid gap-1.5 text-sm">Destino<SelecaoFormulario aria-label="UF de destino fiscal" disabled={!!editor} value={uf} onValueChange={setUf}>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(v => <option key={v} value={v}>{v}</option>)}</SelecaoFormulario></label>
        <label className="grid gap-1.5 text-sm">Destinatário<SelecaoFormulario aria-label="Destinatário da ficha fiscal" disabled={!!editor} value={destinatario} onValueChange={v => setDestinatario(v as typeof destinatario)}><option value="CONSUMIDOR_FINAL">Não contribuinte · consumo final</option><option value="CONTRIBUINTE">Contribuinte ICMS</option></SelecaoFormulario></label>
      </div>
      {editor && <p className="text-xs text-muted-foreground">Feche a edição para selecionar outra operação.</p>}
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[["Grupo", grupo?.nome ?? grupoCadastro?.nome ?? "Sem grupo"], ["NCM", c?.tratamento === "KIT_COMPOSTO" ? "Por componente do kit" : c?.ncmAplicabilidade === "NAO_APLICAVEL" ? "Sem linha independente" : c?.configuracaoNcm ? "Conforme escolhas documentadas" : c?.ncm ?? "Não configurado"], ["Origem ICMS", c?.tratamento === "KIT_COMPOSTO" ? "Por componente" : c?.tratamento === "OPCAO_CONFIGURACAO" ? "Integrada ao produto final" : c?.origem ?? "Não configurada"], ["GTIN", c?.tratamento === "KIT_COMPOSTO" ? "Por componente" : c?.tratamento === "OPCAO_CONFIGURACAO" ? "Sem linha independente" : c?.gtin ?? "Não confirmado"], ["Unidade", c?.unidade ?? "Não configurada"], ["Vigência", cv?.vigenciaInicio ?? "Não aplicada"]].map(([nome, valor]) => <div key={nome}><dt className="text-xs text-muted-foreground">{nome}</dt><dd className="break-words font-medium">{valor}</dd></div>)}</dl>
      {!c?.grupoFiscalId && grupoCadastro && <p className="text-sm text-muted-foreground">O grupo cadastrado ainda não integra a versão fiscal. A regra anterior foi preservada. Confira as diferenças e escolha o vínculo ao editar.</p>}
      {editar ? <Button type="button" variant="outline" onClick={() => setEditor({ tipo: "CLASSIFICACAO", versao: cv })}>Editar classificação e grupo</Button> : <p className="text-sm text-muted-foreground">A aplicação de versões exige administrador com permissão fiscal.</p>}
    </CardContent></Card>
    <Card className="vidro-painel"><CardHeader><CardTitle>Tributação desta operação</CardTitle><CardDescription>{modelo === "65" ? "NFC-e" : "NF-e"} · {uf} · {destinatario === "CONTRIBUINTE" ? "Contribuinte ICMS" : "Consumo final"}</CardDescription></CardHeader><CardContent className="space-y-4">
      {c && c.tratamento !== "NORMAL" ? <p className="text-sm text-muted-foreground">{c.tratamento === "KIT_COMPOSTO" ? "O kit usa a tributação de cada mercadoria discriminada. Os valores por componente aparecem abaixo." : "Esta opção integra o produto final. A tributação é definida na linha desse produto."}</p> : <>
      {r ? <><Badge variant="outline">{r.produtoId ? "Personalizado" : r.grupoFiscalId ? "Herdado do grupo" : "Regra anterior vigente"}</Badge><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{Object.entries(valoresRegra(r)).filter(([k, v]) => v && (r.csosn ? k !== "cstIcms" : k !== "csosn")).map(([k, v]) => <div key={k}><dt className="text-xs uppercase text-muted-foreground">{rotulosRegra[k] ?? k}</dt><dd className="font-medium">{v}</dd></div>)}</dl></> : <p role="status" className="text-sm text-muted-foreground">{resolucao?.conflito ? "Há regras concorrentes. Resolva o conflito antes de emitir." : "Não há regra vigente para este contexto."}</p>}
      {modelo === "65" && (uf !== perfil?.uf || destinatario === "CONTRIBUINTE") && <p className="text-sm text-destructive">Este contexto exige conferir a NF-e modelo 55. A ficha não altera o destinatário para liberar NFC-e.</p>}
      {editar && <Button type="button" variant="outline" onClick={editarRegra}>{r?.produtoId ? "Editar regra do produto" : "Personalizar esta operação"}</Button>}</>}
    </CardContent></Card>
    {editor && <EdicaoFiscalVersionada key={`${editor.tipo}:${editor.versao?.id ?? chave}`} titulo={editor.tipo === "CLASSIFICACAO" ? "Editar dados fiscais" : "Editar tributação por operação"} tipo={editor.tipo} chave={chave} inicial={regraInicial} painel={painel} versao={editor.versao?.chave === chave ? editor.versao : undefined} fechar={() => setEditor(null)} atualizado={atualizado} />}
    <Card className="vidro-painel"><CardHeader><CardTitle>Como aparece na nota</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
      {c?.tratamento === "KIT_COMPOSTO" ? <><p>Kit discriminado por decisão fiscal registrada. Quantidades por unidade de venda. Cada mercadoria conserva seus dados.</p>{c.componentesKit?.map((k, i) => {
        const id = k.produtoId ?? `INSUMO:${k.referenciaInternaInsumoId}`, cv = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === id), classe = cv?.dados as ClassificacaoFiscal | undefined;
        const regra = classe && perfil ? regrasDaOperacao(vs, classe, id, contexto, perfil).efetiva?.dados as RegraFiscal | undefined : undefined;
        return <div key={i} className="space-y-2 border-b pb-3"><p className="font-medium">{i + 1}. {k.descricao ?? painel.produtos.find(p => p.id === k.produtoId)?.nome ?? "Componente documentado"} · {k.quantidade} {k.unidade ?? "unidade(s)"}</p><p className="text-xs text-muted-foreground">NCM {classe?.ncm ?? "conforme configuração"} · Origem {classe?.origem ?? "pendente"}{regra ? ` · CFOP ${regra.cfop} · ${regra.csosn ? `CSOSN ${regra.csosn}` : `CST ${regra.icms.cst}`}` : " · Regra desta operação pendente"}</p><Button type="button" size="sm" variant="outline" disabled={!!editor} nativeButton={false} render={<Link href={`/financeiro/fiscal/vinculos?produto=${encodeURIComponent(id)}#ficha-fiscal`} />}>Abrir fiscal do componente</Button></div>;
      })}</> : <p>{c?.tratamento === "OPCAO_CONFIGURACAO" ? "Esta opção integra outro produto. Não cria linha fiscal independente." : `${produto.nome} · ${c?.unidade ?? produto.unidade}${c?.ncm ? ` · NCM ${c.ncm}` : ""}${r ? ` · CFOP ${r.cfop} · ${r.csosn ? `CSOSN ${r.csosn}` : `CST ${r.icms.cst}`}` : ""}`}</p>}
      <p className="text-xs text-muted-foreground">Ingredientes da receita de produção não viram linhas fiscais automaticamente. A prévia do pedido confere escolhas, quantidades, rateios e valores reais.</p>
    </CardContent></Card>
    <details className="space-y-3 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Diferenças anteriores, histórico e fundamentos</summary>
      {diffs.length > 0 && <section className="space-y-2"><h3 className="text-sm font-medium">Diferenças entre o cadastro anterior e o motor vigente</h3>{diffs.map(d => <p key={d.campo} className="text-sm">{d.campo}: cadastro anterior {d.cadastrado || "vazio"} · motor {d.vigente || "vazio"}.</p>)}<p className="text-xs text-muted-foreground">Nenhum valor será escolhido ou migrado automaticamente.</p></section>}
      {!historico.length && <p className="text-sm text-muted-foreground">Ainda não há versões registradas.</p>}
      {historico.map(v => <section key={v.id} className="space-y-2 border-b pb-3 text-sm"><p>{v.tipo === "CLASSIFICACAO" ? "Classificação" : "Regra"} · versão {v.versao} · {v.status === "RASCUNHO" ? "Rascunho" : v.vigenciaInicio > dia ? "Aplicação futura" : "Aplicada"} · vigência {v.vigenciaInicio}</p><p className="text-xs text-muted-foreground">{v.criadoPorNome} · {v.justificativa}</p>{editar && <GrupoAcoes>{v.tipo === "CLASSIFICACAO" || (v.dados as RegraFiscal).produtoId === produto.id ? <Button type="button" size="sm" variant="outline" onClick={() => setEditor({ tipo: v.tipo as "CLASSIFICACAO" | "REGRA", versao: v })}>{v.status === "RASCUNHO" ? "Retomar rascunho" : "Criar nova versão"}</Button> : <Button type="button" size="sm" variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal/grupos" />}>Abrir regras do grupo</Button>}</GrupoAcoes>}</section>)}
    </details>
  </div>;
}
