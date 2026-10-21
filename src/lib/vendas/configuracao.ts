import { simularConfiguracao, opcoesEfetivas, type ProdutoEntrada } from "./dominio";
import type { DadosProdutos } from "./consultas";
import { precosOpcoes } from "./complementos";

type DadosConfiguracao = Pick<DadosProdutos, "produtos" | "grupos" | "insumos">;
type Componente = ProdutoEntrada["componentes"][number];
const decimal = (s: string) => { const [inteira, fracao = ""] = s.split("."); return { valor: BigInt(inteira + fracao), escala: fracao.length }; };
const formatar = (valor: bigint, escala: number) => {
  if (!escala) return String(valor);
  const s = String(valor).padStart(escala + 1, "0");
  return `${s.slice(0, -escala)}.${s.slice(-escala)}`.replace(/\.?0+$/, "") || "0";
};
function multiplicar(a: string, b: string) { const x = decimal(a), y = decimal(b); return formatar(x.valor * y.valor, x.escala + y.escala); }
function somar(a: string, b: string) { const x = decimal(a), y = decimal(b), escala = Math.max(x.escala, y.escala); return formatar(x.valor * BigInt(10) ** BigInt(escala - x.escala) + y.valor * BigInt(10) ** BigInt(escala - y.escala), escala); }

/** Resolve somente a composição escolhida. Sem consumo, pedido ou movimentação. */
export function resolverConfiguracao(produto: ProdutoEntrada, dados: DadosConfiguracao, escolhas: Record<string, number>) {
  const grupos = produto.grupos.flatMap(vinculo => { const g = dados.grupos.find(g => g.id === vinculo.grupoId); return g ? [{ ...g, opcoes: opcoesEfetivas(precosOpcoes(g.opcoes, dados.produtos), vinculo), vinculo }] : []; });
  const resultado = simularConfiguracao(produto.preco, grupos, escolhas);
  if (grupos.length !== produto.grupos.length) resultado.erros.push("Há um grupo indisponível. Reabra o cadastro para conferir.");
  const componentes = new Map<string, Componente>();
  const pendencias: string[] = [];
  const selecionadas: { grupo: string; opcao: string; quantidade: number; totalCentavos: number }[] = [];
  let custo = 0;
  function incluir(p: Pick<ProdutoEntrada, "nome" | "componentes">, fator: string) {
    if (!p.componentes.length) pendencias.push(`${p.nome}: composição não cadastrada.`);
    for (const c of p.componentes) {
      const quantidade = multiplicar(c.quantidade, fator);
      const chave = JSON.stringify([c.insumoId, c.unidade, c.exibirFicha !== false]); const atual = componentes.get(chave);
      const porcao = c.observacaoPorcao ? (Number(fator) === 1 ? c.observacaoPorcao : `${fator.replace(".", ",")} × (${c.observacaoPorcao})`) : null;
      componentes.set(chave, { ...c, quantidade: atual ? somar(atual.quantidade, quantidade) : quantidade, observacaoPorcao: atual ? [atual.observacaoPorcao || `${atual.quantidade} ${atual.unidade}`, porcao || `${quantidade} ${c.unidade}`].join(" + ") : porcao });
      const insumo = dados.insumos.find(i => i.id === c.insumoId);
      if (!insumo?.ativo || insumo.unidade !== c.unidade || insumo.custo == null) pendencias.push(`${insumo?.nome ?? "Ingrediente"}: custo, situação ou unidade precisa de revisão.`);
      else custo += insumo.custo * Number(quantidade);
    }
  }
  if (produto.componentes.length || produto.tipo !== "PERSONALIZADO") incluir(produto, "1");
  for (const g of grupos.filter(g => g.ativo)) for (const o of g.opcoes.filter(o => o.ativo)) {
    const quantidade = escolhas[o.id] ?? 0;
    if (!Number.isSafeInteger(quantidade) || quantidade <= 0) continue;
    selecionadas.push({ grupo: g.nome, opcao: o.nome, quantidade, totalCentavos: Math.round(Number(o.preco) * 100) * quantidade });
    const p = dados.produtos.find(p => p.id === o.produtoId && p.ativo);
    if (!o.produtoId && o.composicao != null) incluir({ nome: o.nome, componentes: o.composicao }, String(quantidade));
    else if (!p) pendencias.push(`${o.nome}: composição não cadastrada ou complemento indisponível.`);
    else if (p.grupos.length) pendencias.push(`${o.nome}: o produto vinculado possui grupos próprios; revise o vínculo.`);
    else incluir({ ...p, componentes: o.composicao ?? p.componentes }, multiplicar(o.composicao ? "1" : o.quantidade, String(quantidade)));
  }
  if (!componentes.size && !pendencias.length) pendencias.push("Composição não cadastrada para esta configuração.");
  if (!Number.isFinite(custo)) pendencias.push("O custo excede a capacidade de cálculo; revise as quantidades.");
  return { ...resultado, valido: resultado.erros.length === 0, selecionadas, componentes: [...componentes.values()], pendencias: [...new Set(pendencias)], custo: pendencias.length || !Number.isFinite(custo) ? null : custo };
}
