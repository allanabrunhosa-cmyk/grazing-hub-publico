"use client";
/* eslint-disable @next/next/no-img-element -- Fotos autenticadas com cache privado; miniatura segue o cadastro de Produtos. */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FiscalProdutoEditor } from "../fiscal-produto-editor";
import { Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SeletorFiscal } from "@/components/fiscal/seletor-fiscal";
import { SelecaoFormulario } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTriggerBotao } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AcoesEdicao } from "@/components/padroes-operacionais";
import { validarFiscal } from "@/lib/vendas/dominio";
import { salvarFiscalVendaAction } from "../../actions";
import { CabecalhoVendas, Vazio } from "../../componentes";
import { herdarParametrosFiscais as sugerirModeloFiscal } from "@/lib/tributacao/heranca";
import type { GrupoFiscalVinculo } from "../fiscal-produto-editor";
import { DetalhesAnaliseNcm, ncmDiscriminadoPorEscolha, type AnaliseCadastroNcm } from "@/components/fiscal/analise-ncm";

export type ItemFiscal = {
  id: string; nome: string; codigo: string | null; fotoUrl: string | null;
  categorias: { id: string; nome: string; ativo: boolean }[]; classificacoes: string[]; ativo: boolean;
  versao: number; fiscal: Record<string, string>; fiscalRevisado: boolean; grupoFiscalId: string | null;
  ncmEditavel?: boolean;
  ncmNaoAplicavel?: boolean;
  analiseFiscal?: AnaliseCadastroNcm;
  referenciaFiscal?: { classificacaoId: string | null; regraId: string | null; contexto: import("@/lib/tributacao/campos-simples").ContextoEdicaoFiscal };
};
type Rascunho = { base: ItemFiscal; fiscal: Record<string, string>; grupoFiscalId: string | null };
type Filtro = "TODOS" | "PREENCHIDO" | "PENDENTES";
type ColunaOrdenavel = "produto" | "categoria";
const filtros: { valor: Filtro; titulo: string }[] = [{ valor: "TODOS", titulo: "Todos" }, { valor: "PREENCHIDO", titulo: "Preenchido" }, { valor: "PENDENTES", titulo: "Pendentes" }];
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const semNcm = (p: ItemFiscal) => p.ncmNaoAplicavel || p.analiseFiscal?.ncmAplicabilidade === "NAO_APLICAVEL";
const porEscolha = (p: ItemFiscal) => ncmDiscriminadoPorEscolha(p.analiseFiscal);
const analiseConcluida = (a: AnaliseCadastroNcm["analiseNcm"]) => !!a && a.confianca !== "BAIXA" && !a.pendenciasNcm.length;
const preenchido = (p: ItemFiscal) => Boolean(p.grupoFiscalId) && (semNcm(p) ? analiseConcluida(p.analiseFiscal?.analiseNcm) : porEscolha(p) ? p.analiseFiscal!.configuracaoNcm!.cenarios.every(c => analiseConcluida(c.analiseNcm)) : /^\d{8}$/.test(p.fiscal.ncm ?? "")) && (p.analiseFiscal?.configuracaoNcm?.gruposEquivalentes ?? []).every(g => analiseConcluida(g.analiseNcm));
const alterado = (r: Rascunho | undefined) => !!r && (r.grupoFiscalId !== r.base.grupoFiscalId || JSON.stringify(r.fiscal) !== JSON.stringify(r.base.fiscal));

export function VinculosFiscais({ produtos, grupos, editar, produtoInicial }: { produtos: ItemFiscal[]; grupos: GrupoFiscalVinculo[]; editar: boolean; produtoInicial?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(produtoInicial);
  const [busca, setBusca] = useState("");
  const [abaSelecionada, setAbaSelecionada] = useState("produtos");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaOrdenavel; direcao: "asc" | "desc" } | null>(null);
  const [confirmados, setConfirmados] = useState<Record<string, ItemFiscal>>({});
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho | undefined>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const trava = useRef(new Set<string>());
  const itens = produtos.map(p => confirmados[p.id] && confirmados[p.id].versao >= p.versao ? confirmados[p.id] : p);
  const abas = [
    { valor: "produtos", titulo: "Produtos", itens: itens.filter(p => p.classificacoes.includes("PRINCIPAL")) },
    { valor: "complementos", titulo: "Complementos", itens: itens.filter(p => p.classificacoes.some(c => c === "COMPLEMENTO" || c === "OPCAO")) },
  ];
  const consulta = normalizar(busca.trim());
  const abaAtual = abas.find(a => a.valor === abaSelecionada)!;
  const correspondeBusca = (p: ItemFiscal) => normalizar([p.nome, p.codigo, ...p.categorias.map(c => c.nome), p.fiscal.ncm, grupos.find(g => g.id === p.grupoFiscalId)?.nome].filter(Boolean).join(" ")).includes(consulta);
  const encontradosAtuais = abaAtual.itens.filter(correspondeBusca);
  function ordenar(coluna: ColunaOrdenavel) {
    setOrdenacao(atual => ({ coluna, direcao: atual?.coluna === coluna && atual.direcao === "asc" ? "desc" : "asc" }));
  }
  function mudar(p: ItemFiscal, atualizar: (r: Rascunho) => Rascunho) {
    if (!editar || trava.current.has(p.id)) return;
    setRascunhos(anteriores => ({ ...anteriores, [p.id]: atualizar(anteriores[p.id] ?? { base: p, fiscal: { ...p.fiscal }, grupoFiscalId: p.grupoFiscalId }) }));
    setErros(anteriores => ({ ...anteriores, [p.id]: "" }));
  }
  function cancelar(id: string) {
    if (trava.current.has(id)) return;
    setRascunhos(anteriores => ({ ...anteriores, [id]: undefined }));
    setErros(anteriores => ({ ...anteriores, [id]: "" }));
  }
  async function confirmar(id: string) {
    const r = rascunhos[id];
    if (!editar || trava.current.has(id) || !alterado(r) || !r) return;
    let fiscal: Record<string, string>;
    try { fiscal = validarFiscal(r.fiscal, false); }
    catch (erro) { setErros(anteriores => ({ ...anteriores, [id]: erro instanceof Error ? erro.message : "Confira o NCM informado." })); return; }
    trava.current.add(id); setSalvando(anteriores => ({ ...anteriores, [id]: true })); setErros(anteriores => ({ ...anteriores, [id]: "" }));
    try {
      const resposta = await salvarFiscalVendaAction(id, r.base.versao, fiscal, false, r.grupoFiscalId, r.base.referenciaFiscal);
      if ("erro" in resposta) { setErros(anteriores => ({ ...anteriores, [id]: resposta.erro ?? "Não foi possível salvar. Tente novamente." })); return; }
      setConfirmados(anteriores => ({ ...anteriores, [id]: { ...r.base, versao: resposta.versao, referenciaFiscal: resposta.referenciaFiscal ?? r.base.referenciaFiscal, fiscal, fiscalRevisado: false, grupoFiscalId: r.grupoFiscalId } }));
      setRascunhos(anteriores => ({ ...anteriores, [id]: undefined }));
      router.refresh();
    } catch { setErros(anteriores => ({ ...anteriores, [id]: "Não foi possível salvar. Seu preenchimento foi mantido. Tente novamente." })); }
    finally { trava.current.delete(id); setSalvando(anteriores => ({ ...anteriores, [id]: false })); }
  }
  return <div className="space-y-5">
    {aberto && <FiscalProdutoEditor produto={produtos.find(p => p.id === aberto) ?? { id: aberto, nome: "Dados fiscais", versao: 0 }} grupos={grupos} fechar={() => setAberto(undefined)} aoSalvar={() => router.refresh()} />}
    <CabecalhoVendas titulo="Vínculos fiscais" descricao="NCM individual e grupo fiscal dos produtos e complementos."></CabecalhoVendas>
    <p className="text-xs text-muted-foreground">Preenchido inclui os casos fundamentados de NCM não aplicável e de classificação conforme escolha. A prévia do pedido verifica também as regras e a aptidão para emissão.</p>
    {!editar && <p className="text-sm text-muted-foreground">Somente consulta neste cadastro.</p>}
    <Tabs value={abaSelecionada} onValueChange={valor => setAbaSelecionada(String(valor))}>
      <TabsList variant="buttons" aria-label="Tipo de cadastro fiscal">{abas.map(aba => <TabsTriggerBotao key={aba.valor} value={aba.valor}>{aba.titulo} ({aba.itens.length})</TabsTriggerBotao>)}</TabsList>
      <div className="flex flex-wrap items-center justify-start gap-2">
        <Input className="w-full text-left sm:w-72 sm:flex-1 sm:max-w-sm" aria-label="Buscar vínculos fiscais" placeholder="Buscar por nome, código, categoria, NCM ou grupo fiscal" value={busca} onChange={e => setBusca(e.target.value)} />
        <div role="group" aria-label="Filtrar preenchimento fiscal" className="flex flex-wrap items-center justify-start gap-2">{filtros.map(f => <Button key={f.valor} type="button" className="justify-start" variant={filtro === f.valor ? "default" : "outline"} aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>{f.titulo} ({encontradosAtuais.filter(p => f.valor === "TODOS" || preenchido(p) === (f.valor === "PREENCHIDO")).length})</Button>)}</div>
      </div>
      {abas.map(aba => {
        const encontrados = aba.itens.filter(correspondeBusca);
        const lista = encontrados.filter(p => filtro === "TODOS" || preenchido(p) === (filtro === "PREENCHIDO"));
        if (ordenacao) {
          const texto = (p: ItemFiscal) => ordenacao.coluna === "produto" ? p.nome : p.categorias.map(c => c.nome).join(", ") || "Sem categoria";
          const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
          const sinal = ordenacao.direcao === "asc" ? 1 : -1;
          lista.sort((a, b) => sinal * (comparar(texto(a), texto(b)) || comparar(a.nome, b.nome) || comparar(a.id, b.id)));
        }
        return <TabsContent key={aba.valor} value={aba.valor} className="space-y-3">
          <p className="text-xs text-muted-foreground">{lista.length} de {aba.itens.length} {aba.titulo.toLocaleLowerCase("pt-BR")}</p>
          {!lista.length ? <div className="[&>div]:text-left"><Vazio>{!aba.itens.length ? `Nenhum cadastro em ${aba.titulo.toLocaleLowerCase("pt-BR")}.` : "Nenhum cadastro encontrado com estes filtros."}</Vazio></div> : <div className="min-w-0 rounded-2xl border bg-card">
            <Table className="table-fixed min-w-[48rem] text-left [&_th]:text-left [&_td]:text-left" aria-label={`Vínculos fiscais de ${aba.titulo.toLocaleLowerCase("pt-BR")}`}>
              <colgroup><col className="w-[32%]" /><col className="w-[20%]" /><col className="w-40" /><col />{editar && <col className="w-20" />}</colgroup>
              <TableHeader><TableRow><SortableTableHead active={ordenacao?.coluna === "produto"} direction={ordenacao?.direcao} onClick={() => ordenar("produto")}>Produto</SortableTableHead><SortableTableHead active={ordenacao?.coluna === "categoria"} direction={ordenacao?.direcao} onClick={() => ordenar("categoria")}>Categoria</SortableTableHead><TableHead>NCM</TableHead><TableHead>Grupo fiscal</TableHead>{editar && <TableHead>Salvar</TableHead>}</TableRow></TableHeader>
              <TableBody>{lista.map(p => {
                const r = rascunhos[p.id]; const fiscal = r?.fiscal ?? p.fiscal; const grupoId = r ? r.grupoFiscalId : p.grupoFiscalId;
                const grupo = grupos.find(g => g.id === grupoId); const mudou = alterado(r); const ocupado = Boolean(salvando[p.id]); const erro = erros[p.id];
                const ajuda = `fiscal-ajuda-${aba.valor}-${p.id}`;
                return <TableRow key={p.id} onKeyDown={e => {
                  if (e.key === "Escape" && !e.defaultPrevented && (!(e.target instanceof HTMLInputElement) || e.target.getAttribute("aria-expanded") !== "true")) { e.preventDefault(); cancelar(p.id); }
                  if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.getAttribute("role") !== "combobox") { e.preventDefault(); void confirmar(p.id); }
                }}>
                  <TableCell className="whitespace-normal"><div className="flex items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">{p.fotoUrl ? <img src={p.fotoUrl} alt={`Foto de ${p.nome}`} className="h-full w-full object-cover" loading="lazy" /> : <Package className="size-6 text-muted-foreground" aria-label="Sem foto" />}</span><div className="min-w-0"><div className="break-words font-medium">{p.nome}</div><div className="text-xs text-muted-foreground">{p.codigo || "Sem código"}{!p.ativo && " · Inativo"}</div></div></div></TableCell>
                  <TableCell className="break-words whitespace-normal">{p.categorias.length ? p.categorias.map(c => `${c.nome}${c.ativo ? "" : " (inativa)"}`).join(", ") : "Sem categoria"}</TableCell>
                  <TableCell className="whitespace-normal">{semNcm(p) ? <div><span>NCM não aplicável</span>{fiscal.ncm && <p className="mt-1 text-xs text-muted-foreground">Identidade anterior: {fiscal.ncm}</p>}</div> : porEscolha(p) ? <span>Conforme escolha</span> : editar && p.ncmEditavel !== false ? <SeletorFiscal nome={`NCM de ${p.nome}`} valor={fiscal.ncm ?? ""} disabled={ocupado} aria-describedby={ajuda} contexto={{ tabela: "ncm" }} mudar={ncm => { if (ncm !== (fiscal.ncm ?? "")) mudar(p, atual => ({ ...atual, fiscal: { ...atual.fiscal, ncm } })); }} /> : <span className="font-mono">{p.ncmEditavel === false ? "Conforme composição" : fiscal.ncm || "Não informado"}</span>}<div id={ajuda} className="text-xs">{erro ? <span role="alert" className="mt-1 block text-destructive">{erro}</span> : <span role="status" className="sr-only">{ocupado ? "Salvando…" : mudou ? "Alteração não salva" : confirmados[p.id] ? "Salvo" : preenchido(p) ? "Preenchido" : "Pendente"}</span>}</div><DetalhesAnaliseNcm valor={p.analiseFiscal} divergente={Boolean(p.analiseFiscal && !semNcm(p) && !porEscolha(p) && p.analiseFiscal.ncm !== (fiscal.ncm || null))} /></TableCell>
                  <TableCell className="whitespace-normal">{editar ? <SelecaoFormulario aria-label={`Grupo fiscal de ${p.nome}`} aria-describedby={ajuda}  value={grupoId ?? ""} disabled={ocupado} onValueChange={valor => {
                    const id = valor || null; const modelo = grupos.find(g => g.id === id);
                    mudar(p, atual => ({ ...atual, grupoFiscalId: id, fiscal: modelo ? sugerirModeloFiscal(modelo.fiscal, atual.fiscal) : atual.fiscal }));
                  }}><option value="">Sem grupo fiscal</option>{grupos.filter(g => g.ativo || g.id === grupoId).map(g => <option key={g.id} value={g.id} disabled={!g.ativo}>{g.nome}{g.ativo ? "" : " (inativo)"}</option>)}</SelecaoFormulario> : grupo ? `${grupo.nome}${grupo.ativo ? "" : " (inativo)"}` : "Sem grupo fiscal"}</TableCell>
                  {editar && <TableCell><AcoesEdicao nome={`vínculos fiscais de ${p.nome}`} alterado={mudou} salvando={ocupado} confirmar={() => void confirmar(p.id)} cancelar={() => cancelar(p.id)} somenteConfirmar destacarAlterado /></TableCell>}
                </TableRow>;
              })}</TableBody>
            </Table>
          </div>}
        </TabsContent>;
      })}
    </Tabs>
  </div>;
}
