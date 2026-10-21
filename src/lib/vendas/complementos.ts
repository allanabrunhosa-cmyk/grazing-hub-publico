import type { OpcaoEntrada, ProdutoEntrada } from "./dominio";
import { classificacaoComercial } from "./classificacao";

export const ehComplemento = (p: Pick<ProdutoEntrada, "classificacoes" | "classificacao">) => classificacaoComercial(p) === "COMPLEMENTO";
export const precoPadraoComplemento = (p: Pick<ProdutoEntrada, "preco">) => p.preco;

export function precosOpcoes<T extends { preco: string; produtoId?: string | null; usarPrecoPadrao?: boolean }>(opcoes: T[], produtos: (Pick<ProdutoEntrada, "preco"> & { id: string })[]): T[] {
  return opcoes.map(o => { const p = o.usarPrecoPadrao ? produtos.find(p => p.id === o.produtoId) : undefined; return p ? { ...o, preco: p.preco } : o; });
}

function multiplicar(a: string, b: string) {
  const [ai, af = ""] = a.split("."), [bi, bf = ""] = b.split(".");
  const escala = af.length + bf.length;
  const valor = String(BigInt(ai + af) * BigInt(bi + bf)).padStart(escala + 1, "0");
  return escala ? `${valor.slice(0, -escala)}.${valor.slice(-escala)}`.replace(/\.?0+$/, "") || "0" : valor;
}
/** A composição substituta já é por escolha; multiplicadores legados só escalam a base. */
export function composicaoDaOpcao(o: OpcaoEntrada, produtos: ProdutoEntrada[]): ProdutoEntrada["componentes"] {
  if (o.composicao != null) return o.composicao;
  const componentes = produtos.find(p => p.id === o.produtoId)?.componentes ?? [];
  if (Number(o.quantidade) === 1) return componentes;
  return componentes.map(c => ({ ...c, quantidade: multiplicar(c.quantidade, o.quantidade), porcao: c.porcao ? { ...c.porcao, numeroPorcoes: multiplicar(c.porcao.numeroPorcoes, o.quantidade) } : null,
    observacaoPorcao: c.observacaoPorcao ? `${o.quantidade.replace(".", ",")} × (${c.observacaoPorcao})` : null }));
}
