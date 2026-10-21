"use client";

import {
  Combobox, ComboboxCollection, ComboboxContent, ComboboxGroup,
  ComboboxGroupLabel, ComboboxInput, ComboboxInputGroup, ComboboxItem,
} from "@/components/ui/combobox";

type OpcaoProduto = { value: string; label: string; indisponivel: boolean; categorias: string[]; motivoIndisponivel?: string; secao?: { id: string; nome: string } };
type Categoria = { id: string; nome: string };

export function agruparProdutosPedido(opcoes: OpcaoProduto[], categorias: Categoria[]) {
  const secoes = [...new Map(opcoes.flatMap(o => o.secao ? [[o.secao.id, o.secao] as const] : [])).values()];
  return [...categorias, { id: "", nome: "Sem categoria" }, ...secoes]
    .map(categoria => ({
      ...categoria,
      items: opcoes.filter(opcao => (opcao.secao?.id ?? opcao.categorias.find(id => categorias.some(c => c.id === id)) ?? "") === categoria.id),
    }))
    .filter(grupo => grupo.items.length > 0);
}

export function ProdutoPedidoCombobox({ opcoes, categorias, value, indice, onChange }: {
  opcoes: OpcaoProduto[];
  categorias: Categoria[];
  value: string;
  indice: number;
  onChange: (produtoId: string) => void;
}) {
  const grupos = agruparProdutosPedido(opcoes, categorias);

  return <Combobox items={grupos} value={opcoes.find(opcao => opcao.value === value) ?? null}
    onValueChange={opcao => onChange((opcao as OpcaoProduto | null)?.value ?? "")}
    isItemEqualToValue={(a, b) => a.value === b.value}
    filter={(opcao, consulta) => `${opcao.label} ${opcao.secao?.nome ?? ""}`.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(consulta.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, ""))}>
    <ComboboxInputGroup><ComboboxInput placeholder="Buscar produto..." aria-label={`Produto ${indice + 1}`} /></ComboboxInputGroup>
    <ComboboxContent className="w-[min(36rem,var(--available-width))] min-w-[min(var(--anchor-width),var(--available-width))]">
      {(grupo: typeof grupos[number]) => <ComboboxGroup key={grupo.id} items={grupo.items}>
        <ComboboxGroupLabel className="pt-2 font-semibold">{grupo.nome}</ComboboxGroupLabel>
        <ComboboxCollection>{(opcao: OpcaoProduto) => <ComboboxItem key={opcao.value} value={opcao} disabled={opcao.indisponivel} title={opcao.motivoIndisponivel ?? opcao.label} className="items-start py-2">
          <span className="min-w-0 whitespace-normal break-words leading-snug">{opcao.label}{opcao.motivoIndisponivel && <span className="block text-xs text-muted-foreground">{opcao.motivoIndisponivel}</span>}</span>
          {opcao.indisponivel && <span className="text-xs text-muted-foreground">Indisponível para nova confirmação</span>}
        </ComboboxItem>}</ComboboxCollection>
      </ComboboxGroup>}
    </ComboboxContent>
  </Combobox>;
}
