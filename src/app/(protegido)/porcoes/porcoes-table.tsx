"use client";

import { startTransition, useMemo, useRef, useState, type FormEvent } from "react";
import { ListOrdered, Loader2, Plus, Save } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SortableTableHead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelecaoFormulario } from "@/components/ui/select";
import type { CategoriaPorcoesOption } from "@/lib/insumos/ordem-categorias-porcoes";
import { OrdemCategoriasPorcoes } from "./ordem-categorias";
import type { UnidadeMedida } from "@/generated/prisma/client";
import { CASAS_DECIMAIS_PORCAO, MAXIMO_UNIDADE_PORCAO, medidaPorcao, nomeMedidaPorcao, validarPorcao, type PorcaoInsumoOption } from "@/lib/insumos/porcoes";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import { removerPorcaoAction, salvarPorcaoAction } from "./actions";

export type InsumoPorcaoOption = { id: string; nome: string; unidade: UnidadeMedida; categoriaId?: string | null; categoriaNome: string | null; ativo: boolean };
type OpcaoInsumo = InsumoPorcaoOption & { value: string; label: string };
type Props = { porcoes: PorcaoInsumoOption[]; insumos: InsumoPorcaoOption[]; categorias?: CategoriaPorcoesOption[]; podeCriar: boolean; podeEditar: boolean; podeExcluir: boolean };
type Ordenacao = "manual" | "categoria-asc" | "categoria-desc" | "insumo-asc" | "insumo-desc";
const SEM_CATEGORIAS: CategoriaPorcoesOption[] = [];
const normalizarBusca = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const quantidadeLocal = (valor: string) => valor.replace(".", ",");

export function PorcoesTable({ porcoes, insumos, categorias = SEM_CATEGORIAS, podeCriar, podeEditar, podeExcluir }: Props) {
  const [origem, setOrigem] = useState(porcoes);
  const [lista, setLista] = useState(porcoes);
  if (origem !== porcoes) { setOrigem(porcoes); setLista(porcoes); }
  const [busca, setBusca] = useState("");
  const [origemCategorias, setOrigemCategorias] = useState(categorias);
  const [categoriasAtuais, setCategoriasAtuais] = useState(categorias);
  if (origemCategorias !== categorias) { setOrigemCategorias(categorias); setCategoriasAtuais(categorias); }
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("manual");
  const [ordemAberta, setOrdemAberta] = useState(false);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [baseFormulario, setBaseFormulario] = useState(JSON.stringify(["", "", "", ""]));
  const [editando, setEditando] = useState<PorcaoInsumoOption | null>(null);
  const [insumoId, setInsumoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [quantidadeMedida, setQuantidadeMedida] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [removendo, setRemovendo] = useState<PorcaoInsumoOption | null>(null);
  const [erroRemocao, setErroRemocao] = useState("");
  const [pendente, setPendente] = useState(false);
  const trava = useRef(false);
  const opcoes = useMemo<OpcaoInsumo[]>(() => insumos.map(insumo => ({ ...insumo, value: insumo.id, label: insumo.nome })), [insumos]);
  const selecionado = opcoes.find(insumo => insumo.id === insumoId) ?? null;
  const porId = useMemo(() => new Map(insumos.map(insumo => [insumo.id, insumo])), [insumos]);
  const categoriasComPorcoes = useMemo(() => {
    const ids = new Set<string>(), nomes = new Set<string>();
    for (const porcao of lista) {
      const insumo = porId.get(porcao.insumoId);
      if (insumo?.categoriaId) ids.add(insumo.categoriaId);
      else if (insumo?.categoriaNome) nomes.add(insumo.categoriaNome);
    }
    return categoriasAtuais.filter(c => ids.has(c.id) || nomes.has(c.nome));
  }, [lista, porId, categoriasAtuais]);
  const ordemCategorias = useMemo(() => ({ porId: new Map(categoriasAtuais.map((c, indice) => [c.id, indice])), porNome: new Map(categoriasAtuais.map((c, indice) => [c.nome, indice])) }), [categoriasAtuais]);
  const visiveis = lista.filter(porcao => {
    const insumo = porId.get(porcao.insumoId);
    return normalizarBusca(`${insumo?.categoriaNome ?? ""} ${insumo?.nome ?? ""} ${porcao.nome}`).includes(normalizarBusca(busca.trim()));
  }).sort((a, b) => {
    const ia = porId.get(a.insumoId), ib = porId.get(b.insumoId);
    const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
    const sinal = ordenacao.endsWith("desc") ? -1 : 1;
    const porCategoria = comparar(ia?.categoriaNome ?? "Sem categoria", ib?.categoriaNome ?? "Sem categoria");
    const porInsumo = comparar(ia?.nome ?? "", ib?.nome ?? "");
    const ordem = (i: InsumoPorcaoOption | undefined) => (i?.categoriaId ? ordemCategorias.porId.get(i.categoriaId) : ordemCategorias.porNome.get(i?.categoriaNome ?? "")) ?? 2147483647;
    const principal = ordenacao.startsWith("categoria-") ? sinal * porCategoria : ordenacao.startsWith("insumo-") ? sinal * porInsumo : ordem(ia) - ordem(ib) || porCategoria;
    return principal || porInsumo || comparar(a.nome, b.nome) || a.id.localeCompare(b.id);
  });

  function alternarOrdenacao(coluna: "categoria" | "insumo") {
    setOrdenacao(atual => atual === `${coluna}-asc` ? `${coluna}-desc` : atual === `${coluna}-desc` ? "manual" : `${coluna}-asc`);
  }

  function novaPorcao() {
    if (trava.current || !podeCriar) return;
    limparFormulario(); setBaseFormulario(JSON.stringify(["", "", "", ""])); setSucesso(""); setFormularioAberto(true);
  }

  function limparFormulario() {
    setEditando(null); setInsumoId(""); setQuantidade(""); setQuantidadeMedida(""); setUnidadeMedida(""); setErro(""); setAviso("");
  }

  function editar(porcao: PorcaoInsumoOption) {
    if (trava.current || !podeEditar) return;
    const mudouUnidade = porId.get(porcao.insumoId)?.unidade !== porcao.unidade;
    const medida = medidaPorcao(porcao);
    setEditando(porcao); setInsumoId(porcao.insumoId); setQuantidade(mudouUnidade ? "" : quantidadeLocal(porcao.quantidade)); setQuantidadeMedida(quantidadeLocal(medida.quantidadeMedida)); setUnidadeMedida(medida.unidadeMedida); setErro(""); setSucesso("");
    setAviso(mudouUnidade ? "A unidade do insumo mudou. Informe novamente a quantidade na unidade atual antes de salvar." : "");
    setBaseFormulario(JSON.stringify([porcao.insumoId, mudouUnidade ? "" : quantidadeLocal(porcao.quantidade), quantidadeLocal(medida.quantidadeMedida), medida.unidadeMedida]));
    setFormularioAberto(true);
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (trava.current || (editando ? !podeEditar : !podeCriar)) return;
    if (!selecionado?.ativo) { setErro("Selecione um insumo ativo."); return; }
    const entrada = validarPorcao({ insumoId: selecionado.id, quantidadeMedida, unidadeMedida, quantidade, unidade: selecionado.unidade, ...(editando ? { id: editando.id, versao: editando.versao } : {}) });
    if ("erro" in entrada) { setErro(entrada.erro); return; }
    trava.current = true; setPendente(true); setErro(""); setSucesso("");
    startTransition(async () => { try {
      const resultado = await salvarPorcaoAction(entrada.porcao);
      if ("erro" in resultado) { setErro(resultado.erro); return; }
      setLista(atuais => [...atuais.filter(porcao => porcao.id !== resultado.porcao.id), resultado.porcao]);
      setSucesso(editando ? "Porção atualizada." : "Porção cadastrada.");
      limparFormulario();
      setFormularioAberto(false);
    } catch { setErro("Não foi possível salvar a porção. Confira os dados e tente novamente."); }
    finally { trava.current = false; setPendente(false); } });
  }

  function remover() {
    if (!removendo || trava.current || !podeExcluir) return;
    trava.current = true; setPendente(true); setErroRemocao(""); setSucesso("");
    startTransition(async () => { try {
      const resultado = await removerPorcaoAction({ id: removendo.id, versao: removendo.versao });
      if ("erro" in resultado) { setErroRemocao(resultado.erro); return; }
      setLista(atuais => atuais.filter(porcao => porcao.id !== removendo.id));
      if (editando?.id === removendo.id) limparFormulario();
      setRemovendo(null); setSucesso("Porção removida.");
    } catch { setErroRemocao("Não foi possível remover a porção. Tente novamente."); }
    finally { trava.current = false; setPendente(false); } });
  }

  return <div className="mx-auto w-full max-w-5xl space-y-6">
    <BarraAcoes titulo="Tabela de Porções" descricao="Salve medidas frequentes para preencher preparações e composições de produtos com rapidez.">
      {podeEditar && <Button type="button" variant="outline" disabled={pendente || !categoriasComPorcoes.length} onClick={() => setOrdemAberta(true)}><ListOrdered className="size-4" />Ordenar categorias</Button>}
      {podeCriar && <Button type="button" disabled={pendente} onClick={novaPorcao}><Plus className="size-4" />Nova porção</Button>}
    </BarraAcoes>

    <Dialog open={formularioAberto} alterado={JSON.stringify([insumoId, quantidade, quantidadeMedida, unidadeMedida]) !== baseFormulario} protegerAlteracoes={!pendente} onOpenChange={aberto => { if (!pendente) { setFormularioAberto(aberto); if (!aberto) limparFormulario(); } }}>
    <DialogContent className="sm:max-w-4xl" showCloseButton={!pendente}>
    <form onSubmit={salvar} className="space-y-4" aria-label={editando ? "Editar porção" : "Cadastrar porção"}>
      <DialogHeader><DialogTitle>{editando ? "Editar porção" : "Nova porção"}</DialogTitle><DialogDescription>Defina a medida de uma porção e a quantidade equivalente do insumo.</DialogDescription></DialogHeader>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,.8fr)]">
        <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Quantidade do insumo</legend>
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="porcao-insumo" className="text-sm font-medium">Insumo</label>
          <Combobox items={opcoes.filter(insumo => insumo.ativo || insumo.id === insumoId)} value={selecionado} disabled={pendente} onValueChange={valor => { setInsumoId((valor as OpcaoInsumo | null)?.id ?? ""); setQuantidade(""); setAviso(""); setErro(""); }}>
            <ComboboxInputGroup><ComboboxInput id="porcao-insumo" aria-label="Insumo" placeholder="Buscar insumo..." maxLength={120} /></ComboboxInputGroup>
            <ComboboxContent emptyLabel="Nenhum insumo ativo encontrado.">
              {(insumo: OpcaoInsumo) => <ComboboxItem key={insumo.id} value={insumo} disabled={!insumo.ativo}><span className="min-w-0 flex-1 break-words">{insumo.nome}</span><span className="text-xs text-muted-foreground">{unidadeMedidaAbreviada[insumo.unidade]}</span></ComboboxItem>}
            </ComboboxContent>
          </Combobox>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="porcao-quantidade" className="text-sm font-medium">Qtd. do insumo</label>
          <div className="relative">
            <Input id="porcao-quantidade" aria-label="Quantidade do insumo" aria-describedby="porcao-precisao" inputMode="decimal" restricao="decimal" casasDecimais={CASAS_DECIMAIS_PORCAO} maxLength={19} min={0} value={quantidade} onChange={evento => { setQuantidade(evento.target.value); setErro(""); }} disabled={pendente || !selecionado?.ativo} placeholder="0" className="pr-10 tabular-nums" />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">{selecionado ? unidadeMedidaAbreviada[selecionado.unidade] : "—"}</span>
          </div>
        </div>
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">1 porção</legend>
          <div className="grid items-start gap-3 grid-cols-[5.5rem_minmax(0,1fr)]">
            <div className="space-y-1.5"><label htmlFor="porcao-medida" className="text-sm font-medium">Qtd.</label><Input id="porcao-medida" aria-label="Quantidade da medida da porção" value={quantidadeMedida} onChange={e => { setQuantidadeMedida(e.target.value); setErro(""); }} inputMode="decimal" restricao="decimal" casasDecimais={CASAS_DECIMAIS_PORCAO} maxLength={19} disabled={pendente} placeholder="8" className="tabular-nums" /></div>
            <div className="space-y-1.5"><label htmlFor="porcao-unidade" className="text-sm font-medium">Un.</label><Input id="porcao-unidade" aria-label="Unidade da medida da porção" value={unidadeMedida} onChange={e => { setUnidadeMedida(e.target.value.replace(/[\p{Cc}\p{Cf}]/gu, "")); setErro(""); }} disabled={pendente} maxLength={MAXIMO_UNIDADE_PORCAO} placeholder="Ex.: fatias, xícara, pote" /></div>
          </div>
        </fieldset>
      </div>
      <p id="porcao-precisao" className="text-xs text-muted-foreground">A medida cadastrada representa 1 porção e equivale à quantidade do insumo informada. Quantidades com até {CASAS_DECIMAIS_PORCAO} casas decimais.</p>
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
      {selecionado && !selecionado.ativo && <p role="status" className="text-sm text-muted-foreground">Este insumo está inativo. Selecione um insumo ativo para salvar.</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pendente || !selecionado?.ativo || !unidadeMedida.trim() || !quantidadeMedida || !quantidade} aria-busy={pendente || undefined}>{pendente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{editando ? "Salvar alterações" : "Salvar porção"}</Button>
      </DialogFooter>
    </form>
    </DialogContent>
    </Dialog>

    {sucesso && <p role="status" className="text-sm text-muted-foreground">{sucesso}</p>}
    <section className="space-y-3" aria-label="Porções cadastradas">
      <div className="flex flex-wrap items-end gap-3">
        <CampoBusca value={busca} onChange={setBusca} aria-label="Buscar porções" placeholder="Buscar porção, insumo ou categoria..." maxLength={120} containerClassName="w-full sm:max-w-sm" />
        <div className="flex w-full flex-col gap-1.5 sm:w-56"><label htmlFor="porcoes-ordenacao" className="text-sm font-medium">Ordenação</label><SelecaoFormulario id="porcoes-ordenacao" aria-label="Ordenação das porções" value={ordenacao} onValueChange={v => setOrdenacao(v as Ordenacao)}>
          <option value="manual">Ordem das categorias</option><option value="categoria-asc">Categorias: A–Z</option><option value="categoria-desc">Categorias: Z–A</option><option value="insumo-asc">Insumos: A–Z</option><option value="insumo-desc">Insumos: Z–A</option>
        </SelecaoFormulario></div>
        <p className="ml-auto flex min-h-[var(--ds-controle-altura)] items-center text-sm text-muted-foreground">{visiveis.length} {visiveis.length === 1 ? "porção" : "porções"}</p>
      </div>
      <div className="overflow-hidden rounded-[var(--ds-cartao-raio)] border bg-card">
        <Table identificationColumn={1}>
          <TableHeader><TableRow><SortableTableHead className="hidden sm:table-cell" active={ordenacao.startsWith("categoria-")} direction={ordenacao.endsWith("desc") ? "desc" : "asc"} onClick={() => alternarOrdenacao("categoria")}>Categoria</SortableTableHead><SortableTableHead active={ordenacao.startsWith("insumo-")} direction={ordenacao.endsWith("desc") ? "desc" : "asc"} onClick={() => alternarOrdenacao("insumo")}>Insumo</SortableTableHead><TableHead>1 porção</TableHead><TableHead className="text-right">Qtd. do insumo</TableHead>{(podeEditar || podeExcluir) && <TableHead className="text-right">Ações</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {visiveis.map(porcao => {
              const insumo = porId.get(porcao.insumoId);
              return <TableRow key={porcao.id}>
                <TableCell className="hidden whitespace-normal sm:table-cell">{insumo?.categoriaNome ?? "Sem categoria"}</TableCell>
                <TableCell className="whitespace-normal"><span className="font-medium">{insumo?.nome ?? "Insumo indisponível"}</span><span className="mt-1 block text-xs text-muted-foreground sm:hidden">{insumo?.categoriaNome ?? "Sem categoria"}</span>{!insumo?.ativo && <span className="mt-1 block text-xs text-muted-foreground">Insumo inativo</span>}</TableCell>
                <TableCell className="whitespace-normal">{nomeMedidaPorcao(medidaPorcao(porcao).quantidadeMedida, medidaPorcao(porcao).unidadeMedida)}</TableCell>
                <TableCell className="text-right tabular-nums">{quantidadeLocal(porcao.quantidade)} <span className="text-muted-foreground">{unidadeMedidaAbreviada[porcao.unidade]}</span>{insumo && insumo.unidade !== porcao.unidade && <span className="mt-1 block whitespace-normal text-xs text-muted-foreground">Unidade alterada; revise a porção</span>}</TableCell>
                {(podeEditar || podeExcluir) && <TableCell><GrupoAcoes nome={`Ações de ${porcao.nome}`}>
                  {podeEditar && <Button type="button" variant="editar" aria-label={`Editar ${porcao.nome} de ${insumo?.nome}`} disabled={pendente} onClick={() => editar(porcao)} />}
                  {podeExcluir && <Button type="button" variant="excluir" aria-label={`Remover ${porcao.nome} de ${insumo?.nome}`} disabled={pendente} onClick={() => { setRemovendo(porcao); setErroRemocao(""); }} />}
                </GrupoAcoes></TableCell>}
              </TableRow>;
            })}
            {!visiveis.length && <TableRow><TableCell colSpan={podeEditar || podeExcluir ? 5 : 4} className="py-10 text-center whitespace-normal text-muted-foreground">{busca ? "Nenhuma porção encontrada para esta busca." : podeCriar ? "Nenhuma porção cadastrada. Use Nova porção para cadastrar sua primeira medida." : "Nenhuma porção cadastrada."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </section>

    {ordemAberta && <OrdemCategoriasPorcoes categorias={categoriasComPorcoes} fechar={() => setOrdemAberta(false)} aoSalvar={itens => { setCategoriasAtuais(itens); setOrdenacao("manual"); setSucesso("Ordem das categorias atualizada."); }} />}

    <Dialog open={Boolean(removendo)} protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto && !trava.current) { setRemovendo(null); setErroRemocao(""); } }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pendente}>
        <DialogHeader><DialogTitle>Remover porção?</DialogTitle><DialogDescription>A porção “{removendo?.nome}” de {porId.get(removendo?.insumoId ?? "")?.nome} deixará de aparecer nas novas composições. As quantidades já preenchidas serão preservadas.</DialogDescription></DialogHeader>
        {erroRemocao && <p role="alert" className="text-sm text-destructive">{erroRemocao}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={() => setRemovendo(null)}>Cancelar</Button><Button type="button" variant="excluir" aria-label="Confirmar remoção da porção" disabled={pendente} aria-busy={pendente || undefined} onClick={() => void remover()} /></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
