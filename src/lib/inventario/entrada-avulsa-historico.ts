import type { UnidadeMedida } from "@/generated/prisma/browser";
import { DecimalEstoque } from "@/lib/estoque/quantidade";
import { calcularCompraSemNota, type ItemCompraSemNota, type CustoAdicionalEntrada } from "./entrada-avulsa";

export class ErroCorrecaoEntrada extends Error {}
/** A fronteira HTTP pode manter o prefixo legado percent-encoded nos params. */
export function identificadorEntradaNaRota(valor: string): string | null {
  if (typeof valor !== "string" || valor.length > 510) return null;
  try {
    const id = decodeURIComponent(valor);
    return /^(?:(?:compra|movimento):)?[a-zA-Z0-9_-]{1,160}$/.test(id) ? id : null;
  } catch { return null; }
}
export type ItemEntradaSnapshot = ItemCompraSemNota & {
  nome: string; localNome: string; unidade: UnidadeMedida; quantidadeEstoque: string;
  valorFinal: number; custoUnitario: number;
};
export type EntradaSnapshot = {
  tipo: "COMPRA_SIMPLES" | "OUTRO_MOTIVO"; data: string; observacao: string | null;
  fornecedorId: string | null; fornecedorNome: string | null;
  frete: number; desconto: number; custosAdicionais: CustoAdicionalEntrada[];
  valorTotal: number; itens: ItemEntradaSnapshot[]; dadosOriginais?: Record<string, string | boolean | null>;
  reconstruida?: boolean;
  cancelada?: boolean;
};
export type CorrecaoEntradaInput = {
  id: string; versao: number; chave: string; itens: ItemCompraSemNota[];
  observacao: string | null; frete: number; desconto: number; custosAdicionais: CustoAdicionalEntrada[];
};
export type DiferencaEntrada = { campo: string; anterior: string; novo: string };
export type VersaoEntradaDTO = { versao: number; autorNome: string; data: string; diferencas: DiferencaEntrada[]; ajustes: { movimentoId: string; quantidade: string; tipo: string }[] };
export type EntradaDetalheDTO = {
  bloqueio?: string;
  id: string; identificador: string; versao: number; criadoEm: string; responsavel: string;
  snapshot: EntradaSnapshot; versoes: VersaoEntradaDTO[];
};

export function validarItensEntrada(itens: ItemCompraSemNota[]) {
  if (!Array.isArray(itens) || !itens.length || itens.length > 100) throw new ErroCorrecaoEntrada("Informe de 1 a 100 itens.");
  const chaves = new Set<string>();
  for (const item of itens) {
    if (!item || !/^[a-zA-Z0-9_-]{1,160}$/.test(item.insumoId) || !/^[a-zA-Z0-9_-]{1,160}$/.test(item.localId)) throw new ErroCorrecaoEntrada("Selecione produto e local válidos.");
    const quantidade = new DecimalEstoque(item.quantidade ?? NaN);
    const fator = new DecimalEstoque(item.fatorConversao ?? 1);
    const convertida = quantidade.times(fator);
    if (![quantidade, fator].every(n => n.isFinite() && n.gt(0) && n.lt(1e9) && n.decimalPlaces() <= 6)
      || convertida.gte(1e12) || convertida.decimalPlaces() > 9 || !new DecimalEstoque(convertida.toNumber()).equals(convertida)) throw new ErroCorrecaoEntrada("Quantidade e fator aceitam até seis casas; a conversão deve caber em nove casas decimais sem perda de precisão.");
    if (!Number.isFinite(item.valorProdutos) || item.valorProdutos < 0 || item.valorProdutos >= 1e10 || new DecimalEstoque(item.valorProdutos).decimalPlaces() > 2) throw new ErroCorrecaoEntrada("Informe valores válidos com até duas casas decimais.");
    if (item.unidadeEntrada !== undefined && (typeof item.unidadeEntrada !== "string" || item.unidadeEntrada.length > 30 || /[\u0000-\u001f]/.test(item.unidadeEntrada))) throw new ErroCorrecaoEntrada("A unidade de entrada aceita até 30 caracteres.");
    const chave = `${item.insumoId}:${item.localId}`;
    if (chaves.has(chave)) throw new ErroCorrecaoEntrada("O mesmo insumo e local não podem aparecer duas vezes.");
    chaves.add(chave);
  }
}

export function calcularSnapshotEntrada(base: Omit<EntradaSnapshot, "itens" | "valorTotal">, itens: ItemCompraSemNota[], catalogo: { id: string; nome: string; unidade: UnidadeMedida }[], locais: { id: string; nome: string }[]): EntradaSnapshot {
  validarItensEntrada(itens);
  if (base.observacao !== null && (typeof base.observacao !== "string" || base.observacao.length > 2000)) throw new ErroCorrecaoEntrada("A observação aceita até 2.000 caracteres.");
  if (base.tipo === "OUTRO_MOTIVO" && !base.observacao?.trim()) throw new ErroCorrecaoEntrada("Descreva o motivo da entrada.");
  const compra = base.tipo === "COMPRA_SIMPLES" ? calcularCompraSemNota({ ...base, itens }) : null;
  if (compra && "erro" in compra) throw new ErroCorrecaoEntrada(compra.erro);
  return { ...base, observacao: base.observacao?.trim() || null,
    valorTotal: compra ? compra.composicao.valorTotal : itens.reduce((s, i) => s + i.valorProdutos, 0),
    itens: itens.map((item, indice) => {
      const produto = catalogo.find(i => i.id === item.insumoId);
      const local = locais.find(i => i.id === item.localId);
      if (!produto || !local) throw new ErroCorrecaoEntrada("Produto ou local indisponível.");
      const quantidadeEstoque = new DecimalEstoque(item.quantidade).times(item.fatorConversao ?? 1).toString();
      const valorFinal = compra?.composicao.itens[indice].valorFinal ?? item.valorProdutos;
      return { ...item, fatorConversao: item.fatorConversao ?? 1, unidadeEntrada: item.unidadeEntrada?.trim() || produto.unidade,
        nome: produto.nome, unidade: produto.unidade, localNome: local.nome, quantidadeEstoque,
        valorFinal, custoUnitario: new DecimalEstoque(valorFinal).div(quantidadeEstoque).toNumber() };
    }) };
}

/** Deltas líquidos: uma redução parcial não exige retirar a entrada inteira. */
export function planejarCorrecaoEntrada(antes: EntradaSnapshot, depois: EntradaSnapshot) {
  const mapa = new Map<string, { insumoId: string; localId: string; nome: string; unidade: string; quantidade: InstanceType<typeof DecimalEstoque>; valor: InstanceType<typeof DecimalEstoque> }>();
  for (const [snapshot, sinal] of [[antes, -1], [depois, 1]] as const) for (const i of snapshot.itens) {
    const chave = `${i.insumoId}:${i.localId}`;
    const delta = mapa.get(chave) ?? { insumoId: i.insumoId, localId: i.localId, nome: i.nome, unidade: i.unidade, quantidade: new DecimalEstoque(0), valor: new DecimalEstoque(0) };
    if (delta.unidade !== i.unidade) throw new ErroCorrecaoEntrada(`A unidade de ${i.nome} mudou desde a entrada. Concilie a conversão antes de corrigir.`);
    delta.quantidade = delta.quantidade.plus(new DecimalEstoque(i.quantidadeEstoque).times(sinal));
    delta.valor = delta.valor.plus(new DecimalEstoque(i.valorFinal).times(sinal));
    mapa.set(chave, delta);
  }
  return [...mapa.values()].filter(d => !d.quantidade.isZero() || !d.valor.isZero()).sort((a, b) => a.insumoId.localeCompare(b.insumoId) || a.localId.localeCompare(b.localId));
}

export function diferencasEntrada(antes: EntradaSnapshot, depois: EntradaSnapshot): DiferencaEntrada[] {
  const diferencas: DiferencaEntrada[] = [];
  const mostrar = (v: unknown) => v == null || v === "" ? "—" : String(v);
  const campo = (nome: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) diferencas.push({ campo: nome, anterior: mostrar(a), novo: mostrar(b) }); };
  campo("Observação", antes.observacao, depois.observacao);
  campo("Frete", antes.frete, depois.frete); campo("Desconto", antes.desconto, depois.desconto);
  campo("Custos adicionais", antes.custosAdicionais.map(c => `${c.descricao}: ${c.valor}`).join("; "), depois.custosAdicionais.map(c => `${c.descricao}: ${c.valor}`).join("; "));
  for (let i = 0; i < Math.max(antes.itens.length, depois.itens.length); i++) {
    const a = antes.itens[i], b = depois.itens[i];
    const nome = `Item ${i + 1}`;
    if (!a || !b) { campo(nome, a ? `${a.nome}: ${a.quantidade} ${a.unidadeEntrada}` : null, b ? `${b.nome}: ${b.quantidade} ${b.unidadeEntrada}` : null); continue; }
    campo(`${nome} · Produto`, a.insumoId === b.insumoId ? a.nome : `${a.nome} (${a.insumoId})`, a.insumoId === b.insumoId ? a.nome : `${b.nome} (${b.insumoId})`);
    campo(`${nome} · Local`, a.localNome, b.localNome); campo(`${nome} · Quantidade`, a.quantidade, b.quantidade);
    campo(`${nome} · Unidade`, a.unidadeEntrada, b.unidadeEntrada); campo(`${nome} · Conversão`, a.fatorConversao, b.fatorConversao);
    campo(`${nome} · Valor dos produtos`, a.valorProdutos, b.valorProdutos); campo(`${nome} · Valor rateado`, a.valorFinal, b.valorFinal);
  }
  return diferencas;
}
