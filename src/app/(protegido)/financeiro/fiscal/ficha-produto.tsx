"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelecaoFormulario } from "@/components/ui/select";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
import { ComponentesKitFiscal } from "@/components/fiscal/componentes-kit";
import type { RepresentacaoFiscalSimples } from "@/lib/tributacao/edicao-simples";
import { Campo, Check } from "@/app/(protegido)/vendas/componentes";
import { regrasDaOperacao } from "@/lib/tributacao/ficha";
import { camposDoProduto, camposDaRegra, regraDoGrupo, type ContextoEdicaoFiscal } from "@/lib/tributacao/campos-simples";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import type { ClassificacaoFiscal, PerfilFiscal, RegraFiscal } from "@/lib/tributacao/tipos";
import { consultarFichaFiscalAction } from "./manutencao-actions";
import { salvarFiscalSimplesAction } from "./simples-actions";
export type FichaFiscalDados = Extract<Awaited<ReturnType<typeof consultarFichaFiscalAction>>, { ok: true }>["dados"];
export function FiscalProdutoUnificado({ produtoId, inicial, editar = true }: { produtoId: string; inicial?: FichaFiscalDados; editar?: boolean }) {
  const [dados, setDados] = useState(inicial), [erro, setErro] = useState("");
  useEffect(() => { if (inicial) return; let ativo = true; consultarFichaFiscalAction(produtoId).then(r => { if (ativo) { if (r.ok) setDados(r.dados); else setErro(r.erro ?? "Não foi possível abrir o cadastro fiscal."); } }).catch(() => { if (ativo) setErro("Não foi possível abrir o cadastro fiscal."); }); return () => { ativo = false; }; }, [produtoId, inicial]);
  return dados ? <Ficha key={produtoId} dados={dados} editar={editar && dados.painel.administrador} atualizar={setDados} /> : <p role={erro ? "alert" : "status"} className="text-sm text-muted-foreground">{erro || "Carregando dados fiscais…"}</p>;
}
function Ficha({ dados, editar, atualizar }: { dados: FichaFiscalDados; editar: boolean; atualizar: (d: FichaFiscalDados) => void }) {
  const { painel, produto, dia } = dados, vs = versoesVigentes(painel.versoes, dia);
  const cv = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === produto.id), c = cv?.dados as ClassificacaoFiscal | undefined;
  const perfil = vs.find(v => v.tipo === "PERFIL" && v.chave === "singleton")?.dados as PerfilFiscal | undefined;
  const [ctx, setCtx] = useState<ContextoEdicaoFiscal>({ modelo: "65", ufDestino: perfil?.uf ?? "SP", destinatario: "CONSUMIDOR_FINAL" });
  const resolucao = c && perfil ? regrasDaOperacao(vs, c, produto.id, { ...ctx, data: dia, estabelecimento: perfil.estabelecimento, operacao: "VENDA" }, perfil) : undefined;
  const rv = resolucao?.efetiva, r = rv?.dados as RegraFiscal | undefined;
  const regraGrupo = perfil && c?.grupoFiscalId ? regraDoGrupo(vs, c.grupoFiscalId, c.grupo, ctx, perfil).efetiva?.dados as RegraFiscal | undefined : undefined;
  const [fiscal, setFiscal] = useState<Record<string, string>>(() => ({ ...camposDoProduto(c, r, regraGrupo), unidadeTributavel: c?.unidade ?? produto.unidade })), [grupo, setGrupo] = useState(c?.grupoFiscalId ?? produto.grupoFiscalId ?? "");
  const [herdar, setHerdar] = useState(c?.herdarOrigemGrupo ?? false), [usarGrupo, setUsarGrupo] = useState(!r?.produtoId);
  const representacaoInicial: RepresentacaoFiscalSimples = c?.tratamento === "KIT_COMPOSTO" ? "KIT" : c?.natureza === "PREPARADO" || !c ? "PRODUTO_PREPARADO" : "PRODUTO";
  const [representacao, setRepresentacao] = useState(representacaoInicial), [componentes, setComponentes] = useState(c?.componentesKit ?? []);
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState(""), [sucesso, setSucesso] = useState(false), [alterado, setAlterado] = useState(false);
  const operacao = useRef(crypto.randomUUID());
  function mudar(f: Record<string, string>) { setFiscal(f); setAlterado(true); setSucesso(false); }
  function representar(valor: RepresentacaoFiscalSimples) {
    setRepresentacao(valor); setAlterado(true); setSucesso(false); setHerdar(false); setUsarGrupo(false);
    if (c?.tratamento === "KIT_COMPOSTO" && valor !== "KIT") {
      const f = { ...fiscal };
      // Proposta visível, apenas durante a correção explícita. Salvar adota os
      // campos no motor versionado; não há fallback comercial durante a emissão.
      for (const k of ["ncm", "origem", "cfop", "csosn", "cstIcms", "pis", "cofins", "cest", "ean", "unidadeTributavel"]) if (!f[k] && produto.fiscal[k]) f[k] = produto.fiscal[k];
      setFiscal(f);
    }
  }
  function trocarContexto(novo: ContextoEdicaoFiscal) {
    setCtx(novo); const regra = c && perfil ? regrasDaOperacao(vs, c, produto.id, { ...novo, data: dia, estabelecimento: perfil.estabelecimento, operacao: "VENDA" }, perfil).efetiva?.dados as RegraFiscal | undefined : undefined;
    const padrao = perfil && c?.grupoFiscalId ? regraDoGrupo(vs, c.grupoFiscalId, c.grupo, novo, perfil).efetiva?.dados as RegraFiscal | undefined : undefined; setFiscal(camposDoProduto(c, regra, padrao)); setUsarGrupo(!regra?.produtoId); setAlterado(false); setErro(""); setSucesso(false);
  }
  function usarDadosGrupo(id: string) {
    setGrupo(id); setAlterado(true); setSucesso(false);
    const regra = perfil && id ? regraDoGrupo(vs, id, painel.grupos.find(g => g.id === id)?.codigo ?? (id === (c?.grupoFiscalId ?? produto.grupoFiscalId) ? c?.grupo ?? null : null), ctx, perfil).efetiva?.dados as RegraFiscal | undefined : undefined;
    if (regra) { setFiscal(f => ({ ...f, ...camposDaRegra(regra), ncm: f.ncm, ean: f.ean, unidadeTributavel: f.unidadeTributavel, origem: regra.origem ?? f.origem })); setHerdar(!!regra.origem); setUsarGrupo(true); }
  }
  async function salvar() {
    if (salvando) return; setSalvando(true); setErro("");
    try {
      const resposta = await salvarFiscalSimplesAction({ produtoId: produto.id, classificacaoId: cv?.id ?? null, regraId: rv?.id ?? null, contexto: ctx, grupoFiscalId: grupo || null, fiscal, herdarOrigemGrupo: herdar, usarImpostosGrupo: usarGrupo, ...(representacao !== representacaoInicial || representacao === "KIT" ? { representacao, ...(representacao === "KIT" ? { componentesKit: componentes } : {}) } : {}), chaveOperacao: operacao.current });
      if (resposta.erro) { setErro(resposta.erro); return; }
      const atual = await consultarFichaFiscalAction(produto.id); if (atual.ok) atualizar(atual.dados);
      operacao.current = crypto.randomUUID(); setSucesso(true); setAlterado(false);
    } catch { setErro("Não foi possível confirmar o salvamento. Reabra o cadastro para conferir os dados."); } finally { setSalvando(false); }
  }
  return <div data-ficha-fiscal="pronta" className="space-y-4">
    {c?.natureza !== "SERVICO" && c?.tratamento !== "OPCAO_CONFIGURACAO" && !produto.id.startsWith("INSUMO:") && <Campo nome="Representação na nota"><SelecaoFormulario aria-label="Representação na nota" disabled={!editar || salvando} value={representacao} onValueChange={v => representar(v as RepresentacaoFiscalSimples)}><option value="PRODUTO_PREPARADO">Preparação · somente o produto</option><option value="PRODUTO">Mercadoria · somente o produto</option><option value="KIT">Kit · discriminar componentes</option></SelecaoFormulario></Campo>}
    <div className="grid gap-4 sm:grid-cols-2"><Campo nome="Grupo fiscal"><SelecaoFormulario aria-label="Grupo fiscal" disabled={!editar || salvando} value={grupo} onValueChange={usarDadosGrupo}><option value="">Sem grupo fiscal</option>{painel.grupos.filter(g => g.ativo || g.id === grupo).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}</SelecaoFormulario></Campo><Campo nome="Operação"><SelecaoFormulario aria-label="Operação fiscal" disabled={salvando || alterado} value={`${ctx.modelo}:${ctx.destinatario}`} onValueChange={v => { const [modelo, destinatario] = v.split(":"); trocarContexto({ ...ctx, modelo: modelo as "55" | "65", destinatario: destinatario as ContextoEdicaoFiscal["destinatario"] }); }}><option value="65:CONSUMIDOR_FINAL">NFC-e · consumidor final</option><option value="55:CONSUMIDOR_FINAL">NF-e · consumidor final</option><option value="55:CONTRIBUINTE">NF-e · contribuinte ICMS</option></SelecaoFormulario></Campo></div>
    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Outra UF de destino</summary><div className="mt-3 max-w-xs"><SelecaoFormulario aria-label="UF de destino fiscal" disabled={salvando || alterado} value={ctx.ufDestino} onValueChange={ufDestino => trocarContexto({ ...ctx, ufDestino })}>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(v => <option key={v} value={v}>{v}</option>)}</SelecaoFormulario></div></details>
    {(c?.tratamento === "OPCAO_CONFIGURACAO" || c?.natureza === "SERVICO" || representacao === "KIT") ? <div className="space-y-3"><p className="text-sm text-muted-foreground">{c?.natureza === "SERVICO" ? "Serviços não usam os campos de NF-e/NFC-e." : representacao === "KIT" ? "O kit utiliza os dados fiscais dos produtos que o compõem." : "Este complemento integra a nota do produto final."}</p>{representacao === "KIT" && <ComponentesKitFiscal itens={componentes} produtos={painel.produtos.filter(p => p.id !== produto.id)} disabled={!editar || salvando} mudar={itens => { setComponentes(itens); setAlterado(true); setSucesso(false); }} />}</div> : <fieldset disabled={!editar || salvando} className="min-w-0 space-y-4"><>{!c && <label className="grid gap-1.5 text-sm">Tipo do produto<SelecaoFormulario aria-label="Tipo fiscal do produto" value={fiscal.natureza ?? ""} onValueChange={v => mudar({ ...fiscal, natureza: v })}><option value="">Selecionar</option><option value="PREPARADO">Produção própria</option><option value="REVENDA">Revenda</option><option value="FRACIONADO">Fracionado</option></SelecaoFormulario></label>}<CamposClassificacaoFiscal ncmEditavel={c?.tratamento === "KIT_COMPOSTO" || !c?.configuracaoNcm} fiscal={fiscal} mudar={f => { mudar(f); if (f.origem !== fiscal.origem) setHerdar(false); if (["cfop", "csosn", "cstIcms", "pis", "cofins", "cest", "aliquotaPis", "aliquotaCofins", "aliquotaIcms", "st", "evidenciaSt"].some(k => f[k] !== fiscal[k])) setUsarGrupo(false); }} crt={perfil?.crt} modelo={Number(ctx.modelo) as 55 | 65} uf={ctx.ufDestino} dia={dia} escopo="produto" /></>{grupo && <div className="space-y-2"><Check disabled={!regraGrupo?.origem} checked={herdar} onChange={e => { setHerdar(e.target.checked); if (e.target.checked && regraGrupo?.origem) setFiscal(f => ({ ...f, origem: regraGrupo.origem! })); setAlterado(true); }}>Usar origem ICMS do grupo</Check><Check checked={usarGrupo} onChange={e => { if (e.target.checked) usarDadosGrupo(grupo); else { setUsarGrupo(false); setAlterado(true); } }}>Usar impostos do grupo</Check></div>}</fieldset>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}{sucesso && <p role="status" className="text-sm text-success">Dados fiscais salvos.</p>}
    {editar && <Button type="button" variant="entrada" disabled={!alterado || salvando || !!resolucao?.conflito} onClick={() => void salvar()}>{salvando ? "Salvando…" : "Salvar"}</Button>}
    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Histórico fiscal</summary><div className="mt-3 space-y-2">{painel.versoes.filter(v => v.tipo === "CLASSIFICACAO" && v.chave === produto.id || v.tipo === "REGRA" && (v.dados as RegraFiscal).produtoId === produto.id).map(v => <p key={v.id}>Versão {v.versao} · {v.vigenciaInicio} · {v.criadoPorNome}</p>)}</div></details>
  </div>;
}
