"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { Combobox, ComboboxContent, ComboboxItem } from "@/components/ui/combobox";
import { CadastroRapidoInsumoDialog } from "@/components/cadastro-rapido-insumo-dialog";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import type { ComponenteRow, InsumoCriado, InsumoOption } from "./types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { CampoBuscaInsumo } from "@/components/campo-busca-insumo";
import { CampoNumeroPorcoes } from "@/components/campo-numero-porcoes";
import { MAXIMO_INGREDIENTES_PREPARACAO } from "@/lib/insumos/limites-preparacao";
import { calcularPorcao, validarQuantidadePorcao, type PorcaoComposicao } from "@/lib/insumos/porcoes";
import { ListaOrdenavel } from "../vendas/lista-ordenavel";

function criarOpcao(i: InsumoOption) { return { ...i, value: i.id, label: i.nome }; }
type OpcaoIngrediente = ReturnType<typeof criarOpcao>;
const textoQuantidade = (n: number) => n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
const moeda = (n: number | null) => n == null ? "Pendente" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function aplicarPorcao(item: ComponenteRow, porcao: PorcaoComposicao): ComponenteRow {
  const calculada = calcularPorcao(porcao);
  return "erro" in calculada ? { ...item, porcao } : { ...item, porcao, unidade: porcao.unidadeInsumo, quantidade: Number(calculada.quantidade), quantidadePorcao: calculada.quantidade, observacaoPorcao: calculada.observacaoPorcao };
}

export function ComposicaoPicker({ candidatos, itens, onChange, disabled, podeCadastrarInsumo, ordenar = false, configurarFicha = false, exibirEspecificacao = false }: {
  candidatos: InsumoOption[]; itens: ComponenteRow[]; onChange: (itens: ComponenteRow[]) => void;
  disabled?: boolean; podeCadastrarInsumo?: boolean; ordenar?: boolean; configurarFicha?: boolean; exibirEspecificacao?: boolean;
}) {
  const [selecionado, setSelecionado] = useState<OpcaoIngrediente | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [porcao, setPorcao] = useState<PorcaoComposicao | null>(null);
  const [criados, setCriados] = useState<InsumoCriado[]>([]);
  const atingiuLimite = itens.length >= MAXIMO_INGREDIENTES_PREPARACAO;
  const candidatosDisponiveis: InsumoOption[] = useMemo(() => [...candidatos, ...criados.filter(c => !candidatos.some(i => i.id === c.id)).map(c => ({ ...c, tipo: "INSUMO" as const, custoMedio: c.custoMedio, custoUnitario: c.custoMedio }))], [candidatos, criados]);
  const opcoes = useMemo(() => candidatosDisponiveis.filter(c => !itens.some(i => i.componenteId === c.id)).map(criarOpcao), [candidatosDisponiveis, itens]);
  const calculada = porcao ? calcularPorcao(porcao) : validarQuantidadePorcao(quantidade);
  const quantidadeEfetiva = "erro" in calculada ? null : calculada.quantidade;
  const descricao = "observacaoPorcao" in calculada && typeof calculada.observacaoPorcao === "string" ? calculada.observacaoPorcao : undefined;
  const candidato = candidatosDisponiveis.find(c => c.id === selecionado?.value);
  const draft: ComponenteRow | null = candidato && quantidadeEfetiva ? { componenteId: candidato.id, nome: candidato.nome, tipo: candidato.tipo, unidade: candidato.unidade, quantidade: Number(quantidadeEfetiva), observacaoPorcao: null } : null;

  function limpar() { setSelecionado(null); setQuantidade(""); setPorcao(null); }
  function mudarPorcaoRascunho(referencia: PorcaoComposicao) {
    setPorcao(referencia);
    const resultado = calcularPorcao(referencia);
    setQuantidade("erro" in resultado ? "" : resultado.quantidade.replace(".", ","));
  }
  function adicionar() {
    if (disabled || atingiuLimite || !candidato || !quantidadeEfetiva) return;
    const item: ComponenteRow = { componenteId: candidato.id, nome: candidato.nome, especificacao: candidato.especificacao, tipo: candidato.tipo, unidade: candidato.unidade, quantidade: Number(quantidadeEfetiva), quantidadePorcao: quantidadeEfetiva, custoUnitario: candidato.custoUnitario ?? candidato.custoMedio ?? null, observacaoPorcao: null };
    onChange([...itens, porcao ? aplicarPorcao(item, porcao) : item]);
    limpar();
  }
  function custoPorcao(item: ComponenteRow) {
    const c = candidatosDisponiveis.find(i => i.id === item.componenteId);
    if ((c && c.unidade !== item.unidade) || (item.porcao && "erro" in calcularPorcao(item.porcao))) return null;
    const custo = (item.tipo === "INSUMO" ? c?.custoMedio : c?.custoUnitario) ?? item.custoUnitario;
    return custo == null || custo <= 0 || item.quantidade <= 0 ? null : custo * item.quantidade;
  }
  const custos = itens.map(custoPorcao);
  const total = !custos.length || custos.some(c => c == null) ? null : custos.reduce<number>((soma, c) => soma + c!, 0);
  function mudarQuantidade(item: ComponenteRow, valor: string) {
    onChange(itens.map(i => i.componenteId !== item.componenteId ? i : { ...i, porcao: null, quantidade: Number(valor.replace(",", ".")), quantidadePorcao: valor.replace(",", "."), observacaoPorcao: null }));
  }

  return <div className="space-y-3 rounded-lg border bg-muted/20 px-2 py-3 text-left">
    {itens.map(item => <input key={item.componenteId} type="hidden" name="componentes" value={JSON.stringify({ componenteId: item.componenteId, quantidade: item.quantidade, observacaoPorcao: item.observacaoPorcao?.trim() || null, ...(item.porcao ? { porcao: item.porcao } : {}) })} />)}
    <p className="text-xs text-muted-foreground">Ingredientes: {itens.length}/{MAXIMO_INGREDIENTES_PREPARACAO}</p>
    <div className="grid items-start gap-2 @xl:grid-cols-[minmax(8rem,1fr)_3.5rem_6.5rem_6rem_3.5rem_var(--ds-controle-altura)]">
      <div className="min-w-0 space-y-1.5">
        <span className="block text-xs font-medium">Ingrediente</span>
        <Combobox items={opcoes} itemToStringLabel={i => i.nome} itemToStringValue={i => i.id} value={selecionado} onValueChange={v => { setSelecionado(v as OpcaoIngrediente | null); setQuantidade(""); setPorcao(null); }} disabled={disabled || atingiuLimite}>
          <CampoBuscaInsumo selecionado={selecionado} placeholder="Buscar ingrediente..." ariaLabel="Ingrediente" />
          <ComboboxContent className="w-[min(32rem,var(--available-width))] min-w-[min(var(--anchor-width),var(--available-width))]">
            {(i: OpcaoIngrediente) => <ComboboxItem key={i.value} value={i} className="py-2"><IdentificacaoInsumo nome={i.nome} className="min-w-0 flex-1" nomeClassName="truncate font-medium" /><span className="shrink-0 text-xs text-muted-foreground">{unidadeMedidaAbreviada[i.unidade]}</span></ComboboxItem>}
          </ComboboxContent>
        </Combobox>
      </div>
      <div className="min-w-0 space-y-1.5">
        <span className="block text-xs font-medium">Porção</span>
        <CampoNumeroPorcoes insumoId={selecionado?.value ?? ""} unidade={selecionado?.unidade ?? "UN"} referencia={porcao} onChange={p => p ? mudarPorcaoRascunho(p) : setPorcao(null)} ariaLabel="Quantidade de porções" disabled={disabled || atingiuLimite} />
      </div>
      <div className="min-w-0 space-y-1.5"><span className="block text-xs font-medium">Descrição</span><Input value={descricao ?? ""} readOnly disabled={disabled} placeholder="—" aria-label="Descrição da porção do ingrediente" title={descricao} /></div>
      <div className="min-w-0 space-y-1.5">
        <span className="block text-xs font-medium">Qtd.</span>
        <InputComSufixo sufixo={selecionado ? unidadeMedidaAbreviada[selecionado.unidade] : "—"} value={quantidade} onChange={e => { setQuantidade(e.target.value); setPorcao(null); }} placeholder="Qtd." aria-label="Quantidade do ingrediente" min="0.001" max="999999999.999" inputMode="decimal" restricao="decimal" casasDecimais={3} maxLength={13} disabled={disabled || atingiuLimite} className="pl-2 pr-10 tabular-nums" />
      </div>
      <div className="min-w-0 space-y-1.5"><span className="block text-xs font-medium">Custo</span><p className="flex min-h-[var(--ds-controle-altura)] items-center text-xs font-medium tabular-nums" aria-label="Custo do ingrediente"><span className="truncate" title={moeda(draft ? custoPorcao(draft) : null)}>{moeda(draft ? custoPorcao(draft) : null)}</span></p></div>
      <div className="space-y-1.5"><span aria-hidden className="hidden text-xs @xl:block">&nbsp;</span><Button type="button" data-dialogo-altera variant="outline" size="icon" aria-label="Adicionar ingrediente" onClick={adicionar} disabled={disabled || atingiuLimite || !selecionado || !quantidadeEfetiva}><Check className="size-4" /></Button></div>
    </div>
    {(quantidade || porcao?.numeroPorcoes) && "erro" in calculada && <p role="alert" className="text-xs text-destructive">{calculada.erro}</p>}
    {podeCadastrarInsumo && !disabled && <CadastroRapidoInsumoDialog exibirEspecificacao={exibirEspecificacao} aoSalvar={c => { setCriados(atuais => [...atuais.filter(i => i.id !== c.id), c]); setSelecionado(criarOpcao({ ...c, tipo: "INSUMO", custoMedio: c.custoMedio, custoUnitario: c.custoMedio })); setQuantidade(""); setPorcao(null); }} />}

    {!itens.length ? <p className="text-xs text-muted-foreground">Nenhum ingrediente adicionado.</p> : <div className="space-y-1.5">
      <div className="mx-px hidden gap-2 px-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground @xl:grid @xl:grid-cols-[minmax(8rem,1fr)_3.5rem_6.5rem_6rem_3.5rem_var(--ds-controle-altura)]"><span className="flex items-start gap-1">{ordenar && !disabled && <span aria-hidden className="w-9 shrink-0" />}Ingrediente</span><span>Porção</span><span>Descrição</span><span>Qtd.</span><span>Custo</span><span aria-hidden className="w-[var(--ds-acao-tamanho)] pointer-coarse:min-w-11" /></div>
      <div role="list" aria-label="Ingredientes da receita"><ListaOrdenavel itens={itens} chave={i => i.componenteId} nome={i => i.nome} mudar={onChange} disabled={disabled || !ordenar} className="space-y-1.5">{(item, _, alca) => {
        const atual = candidatosDisponiveis.find(c => c.id === item.componenteId);
        const resultado = item.porcao && calcularPorcao(item.porcao);
        const descricaoPorcao = resultado ? "erro" in resultado ? "" : resultado.observacaoPorcao : item.observacaoPorcao ?? "";
        const quantidadeExibida = resultado && "erro" in resultado ? "" : item.quantidadePorcao !== undefined ? item.quantidadePorcao.replace(".", ",") : item.quantidade ? textoQuantidade(item.quantidade).replace(".", ",") : "";
        return <div role="listitem" key={item.componenteId} className="grid items-start gap-2 rounded-md border bg-background px-2 py-2 text-sm @xl:grid-cols-[minmax(8rem,1fr)_3.5rem_6.5rem_6rem_3.5rem_var(--ds-controle-altura)]">
          <div className="flex min-h-[var(--ds-controle-altura)] min-w-0 items-center gap-1" title={item.nome}>
            {alca}<div className="flex min-w-0 flex-1 items-center gap-3"><IdentificacaoInsumo nome={item.nome} especificacao={exibirEspecificacao ? item.especificacao : undefined} className="min-w-0 flex-1" nomeClassName="line-clamp-2 font-medium" especificacaoClassName="truncate" />
              {configurarFicha && <Button type="button" data-dialogo-altera variant="ghost" size="icon-sm" aria-label={`Exibir ${item.nome} na ficha técnica`} aria-pressed={item.exibirFicha !== false} title={`FM — Ficha de montagem ${item.exibirFicha !== false ? "ativada" : "desativada"}. Inclui o ingrediente na ficha técnica; não altera estoque ou custo.`} className={`text-[11px] ${item.exibirFicha !== false ? "bg-success-bg text-success" : "text-muted-foreground"}`} disabled={disabled} onClick={() => onChange(itens.map(i => i.componenteId === item.componenteId ? { ...i, exibirFicha: i.exibirFicha === false } : i))}>FM</Button>}
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            <span className="block text-[10px] uppercase text-muted-foreground @xl:hidden">Porção</span>
            <CampoNumeroPorcoes insumoId={item.componenteId} unidade={atual?.unidade ?? item.unidade} referencia={item.porcao} onChange={p => onChange(itens.map(i => i.componenteId === item.componenteId ? p ? aplicarPorcao(i, p) : { ...i, porcao: null, observacaoPorcao: null } : i))} ariaLabel={`Quantidade de porções de ${item.nome}`} disabled={disabled} />
          </div>
          <div className="min-w-0 space-y-1">
            <span className="block text-[10px] uppercase text-muted-foreground @xl:hidden">Descrição</span>
            <Input value={descricaoPorcao} readOnly disabled={disabled} placeholder="—" aria-label={`Descrição da porção de ${item.nome}`} title={descricaoPorcao} />
          </div>
          <div className="min-w-0 space-y-1">
            <span className="block text-[10px] uppercase text-muted-foreground @xl:hidden">Qtd.</span>
            <InputComSufixo sufixo={unidadeMedidaAbreviada[item.unidade]} min="0.001" max="999999999.999" inputMode="decimal" restricao="decimal" casasDecimais={3} maxLength={13} required className="pl-2 pr-10 tabular-nums" value={quantidadeExibida} aria-label={`Quantidade de ${item.nome}`} disabled={disabled} onChange={e => mudarQuantidade(item, e.target.value)} />
            {resultado && "erro" in resultado && <p role="alert" className="text-xs text-destructive">{resultado.erro}</p>}
          </div>
          <div className="min-w-0 space-y-1"><span className="block text-[10px] uppercase text-muted-foreground @xl:hidden">Custo</span><p className="flex min-h-[var(--ds-controle-altura)] items-center text-xs font-medium tabular-nums" aria-label={`Custo de ${item.nome}`}><span className="truncate" title={moeda(custoPorcao(item))}>{moeda(custoPorcao(item))}</span></p></div>
          <div className="flex min-h-[var(--ds-controle-altura)] items-center"><Button type="button" data-dialogo-altera variant="excluir" size="icon-sm" aria-label={`Remover ingrediente ${item.nome}`} disabled={disabled} onClick={() => onChange(itens.filter(i => i.componenteId !== item.componenteId))} /></div>
        </div>;
      }}</ListaOrdenavel></div>
      <p className="text-right text-xs text-muted-foreground">Custo total: <span className="font-medium text-foreground">{moeda(total)}</span></p>
    </div>}
    {atingiuLimite && <p role="status" className="text-xs text-muted-foreground">Limite de {MAXIMO_INGREDIENTES_PREPARACAO} ingredientes atingido.</p>}
  </div>;
}
