"use client";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
import { CabecalhoVendas, Check, EditorVenda, Texto, Vazio } from "../componentes";
import { BotaoExcluirVenda } from "../botao-excluir";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusCadastroVenda } from "../status-cadastro";
import { salvarGrupoFiscalSimplesAction } from "../../financeiro/fiscal/simples-actions";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import { camposDaRegra, regraDoGrupo } from "@/lib/tributacao/campos-simples";
import type { PainelFiscal, PerfilFiscal, RegraFiscal } from "@/lib/tributacao/tipos";
import type { CrtFiscal } from "@/lib/fiscal/catalogos/tipos";
import { SelecaoFormulario } from "@/components/ui/select";
type GrupoFiscal = { id: string; codigo?: string | null; nome: string; versao: number; fiscal: Record<string,string>; ativo: boolean; produtos: { id: string }[] };
export function GruposFiscais({ grupos, editar, crt, painel }: { grupos: GrupoFiscal[]; editar: boolean; crt?: CrtFiscal; painel?: PainelFiscal }) {
  const [atual, setAtual] = useState<GrupoFiscal | null>(null);
  return <div className="space-y-5"><CabecalhoVendas titulo="Grupos fiscais" descricao="Impostos do grupo. O NCM é cadastrado em cada produto.">{editar && <Button onClick={() => setAtual({ id:"",nome:"",versao:0,fiscal:{},ativo:true,produtos:[] })}><Plus className="size-4" />Novo grupo fiscal</Button>}</CabecalhoVendas>
    {!grupos.length ? <Vazio>Nenhum grupo fiscal cadastrado.</Vazio> : <div className="grid gap-3 md:grid-cols-2">{grupos.map(g => <div key={g.id} className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{g.nome}</h2><StatusCadastroVenda tipo="GRUPO_FISCAL" id={g.id} versao={g.versao} ativo={g.ativo} nome={g.nome} editar={editar} /></div><p className="mt-2 text-sm text-muted-foreground">{g.produtos.length} produto(s)</p>{editar && <GrupoAcoes className="mt-3"><Button onClick={() => setAtual(g)} aria-label={`Editar ${g.nome}`} variant="editar" size="icon-sm" /><BotaoExcluirVenda tipo="GRUPO_FISCAL" id={g.id} versao={g.versao} nome={g.nome} aviso="Grupos usados em versões fiscais devem ser inativados para preservar o histórico." /></GrupoAcoes>}</div>)}</div>}
    {atual && <EditorGrupoFiscal inicial={atual} fechar={() => setAtual(null)} crt={crt} painel={painel} />}
  </div>;
}
function EditorGrupoFiscal({ inicial, fechar, crt, painel }: { inicial: GrupoFiscal; fechar: () => void; crt?: CrtFiscal; painel?: PainelFiscal }) {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const vs = versoesVigentes(painel?.versoes ?? [], hoje), perfil = vs.find(v => v.tipo === "PERFIL" && v.chave === "singleton")?.dados as PerfilFiscal | undefined;
  const [ctx, setCtx] = useState({ modelo: "65" as "55" | "65", ufDestino: perfil?.uf ?? "SP", destinatario: "CONSUMIDOR_FINAL" as "CONSUMIDOR_FINAL" | "CONTRIBUINTE" });
  const resolver = (c: typeof ctx) => perfil ? regraDoGrupo(vs, inicial.id, inicial.codigo ?? null, c, perfil) : undefined;
  const rv = resolver(ctx)?.efetiva, regra = rv?.dados as RegraFiscal | undefined;
  const [d, setD] = useState({ id: inicial.id, versao: inicial.versao, nome: inicial.nome, fiscal: regra ? camposDaRegra(regra) : {}, ativo: inicial.ativo });
  const operacao = useRef(crypto.randomUUID());
  return <EditorVenda titulo={d.id ? "Editar grupo fiscal" : "Novo grupo fiscal"} descricao="Parâmetros usados na emissão. Personalizações do produto são preservadas." fechar={fechar} salvar={() => salvarGrupoFiscalSimplesAction({ ...d, regraId: rv?.id ?? null, contexto: ctx, chaveOperacao: operacao.current })}>
    <Texto nome="Nome do grupo *" required maxLength={120} value={d.nome} onChange={e => setD({ ...d,nome:e.target.value })} />
    <label className="grid gap-1.5 text-sm font-medium">Operação<SelecaoFormulario aria-label="Operação do grupo" value={`${ctx.modelo}:${ctx.destinatario}`} onValueChange={v => { const [modelo, destinatario] = v.split(":"); const novo = { ...ctx, modelo: modelo as "55" | "65", destinatario: destinatario as typeof ctx.destinatario }; setCtx(novo); setD({ ...d, fiscal: camposDaRegra(resolver(novo)?.efetiva?.dados as RegraFiscal | undefined) }); }}><option value="65:CONSUMIDOR_FINAL">Venda · NF-e/NFC-e</option><option value="55:CONTRIBUINTE">NF-e · contribuinte ICMS</option><option value="55:CONSUMIDOR_FINAL">NF-e · consumidor final</option></SelecaoFormulario></label>
    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Outra UF de destino</summary><div className="mt-3 max-w-xs"><SelecaoFormulario aria-label="UF de destino do grupo" value={ctx.ufDestino} onValueChange={ufDestino => { const novo = { ...ctx, ufDestino }; setCtx(novo); setD({ ...d, fiscal: camposDaRegra(resolver(novo)?.efetiva?.dados as RegraFiscal | undefined) }); }}>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(v => <option key={v} value={v}>{v}</option>)}</SelecaoFormulario></div></details>
    <CamposClassificacaoFiscal fiscal={d.fiscal} mudar={fiscal => setD({ ...d,fiscal })} crt={crt} dia={hoje} escopo="grupo" />
    <Check checked={d.ativo} onChange={e => setD({ ...d,ativo:e.target.checked })}>Grupo ativo</Check>
  </EditorVenda>;
}
