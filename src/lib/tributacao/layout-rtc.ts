import { Prisma } from "@/generated/prisma/client";
import type { LayoutFiscalRTC } from "./tipos";

export type ValoresLayoutRtc = {
  produtos: { produtoLiquido: string; unitarioLiquido: string; totalItem: string }[];
  valorLiquidoProdutosTotal: string; valorTotalDocumento: string;
};
export type SnapshotLayoutRtc = ValoresLayoutRtc & { layout: LayoutFiscalRTC };
const nomesProduto = ["valorProdutoLiquido", "valorUnitarioLiquido", "valorTotalItem"] as const;
const nomesDocumento = ["valorLiquidoProdutosTotal", "valorTotalDocumento"] as const;
const proibidos = new Set(["__proto__", "prototype", "constructor"]);
function caminho(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){0,2}$/.test(v) && v.length <= 80 && !v.split(".").some(p => proibidos.has(p));
}
function independentes(v: string[]) {
  return v.every((a, i) => v.every((b, j) => i === j || a !== b && !a.startsWith(b + ".") && !b.startsWith(a + ".")));
}
export function layoutRtcComprovado(v: LayoutFiscalRTC | undefined): v is LayoutFiscalRTC {
  if (!v || v.codigo !== "NT2026.008" || v.homologacaoComprovada !== true || typeof v.evidenciaHomologacao !== "string" || v.evidenciaHomologacao.trim().length < 15 || !v.campos) return false;
  return [...nomesProduto, ...nomesDocumento].every(n => caminho(v.campos[n])) && independentes(nomesProduto.map(n => v.campos[n]!)) && independentes(nomesDocumento.map(n => v.campos[n]!));
}
function decimal(v: string, unitario = false) {
  if (typeof v !== "string" || !(unitario ? /^\d{1,11}(?:\.\d{1,10})?$/ : /^\d{1,13}(?:\.\d{1,2})?$/).test(v)) throw new Error("Valor do layout RTC fora da precisão fiscal.");
  const n = Number(v);
  if (!Number.isFinite(n) || !new Prisma.Decimal(String(n)).equals(v)) throw new Error("Valor RTC não representável no contrato numérico do provedor.");
  return n;
}
function ler(o: Record<string, unknown>, p: string): unknown {
  let v: unknown = o;
  for (const k of p.split(".")) {
    if (!v || typeof v !== "object" || Array.isArray(v) || !Object.hasOwn(v, k)) return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}
function escrever(o: Record<string, unknown>, p: string, valor: number) {
  const ks = p.split("."); let atual = o;
  for (const [i, k] of ks.entries()) {
    if (i === ks.length - 1) {
      if (Object.hasOwn(atual, k)) throw new Error("Campo RTC colide com campo já existente do documento; preservar valores comerciais e tributários.");
      atual[k] = valor;
    } else {
      if (!Object.hasOwn(atual, k)) atual[k] = {};
      const v = atual[k];
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Caminho RTC incompatível com o documento.");
      atual = v as Record<string, unknown>;
    }
  }
}
function valores(v: SnapshotLayoutRtc, documento: Record<string, unknown>) {
  if (!layoutRtcComprovado(v.layout) || !Array.isArray(documento.Produtos) || !Array.isArray(v.produtos) || documento.Produtos.length !== v.produtos.length || !v.produtos.length) throw new Error("Layout RTC 2027 sem homologação, campos ou itens comprovados.");
  const produtos = documento.Produtos;
  const liquido = v.produtos.reduce((s, p) => s.plus(p.produtoLiquido), new Prisma.Decimal(0));
  const bruto = v.produtos.reduce((s, p) => s.plus(p.totalItem), new Prisma.Decimal(0));
  if (!liquido.equals(v.valorLiquidoProdutosTotal) || !bruto.equals(v.valorTotalDocumento) || !bruto.equals(String(documento.ValorTotal))) throw new Error("Totais RTC não fecham com produtos e total comercial.");
  return [
    ...v.produtos.flatMap((p, i) => {
      const produto = produtos[i] as Record<string, unknown>;
      const brutoProduto = new Prisma.Decimal(String(produto.ValorTotal));
      const brutoItem = brutoProduto.minus(String(produto.ValorDesconto ?? 0)).plus(String(produto.ValorFrete ?? 0)).plus(String(produto.ValorOutrasDespesas ?? 0));
      if (!brutoItem.equals(p.totalItem) || new Prisma.Decimal(p.produtoLiquido).gt(brutoProduto) || new Prisma.Decimal(p.unitarioLiquido).mul(String(produto.Quantidade)).minus(p.produtoLiquido).abs().gt("0.01")) throw new Error("Valores líquidos RTC inconsistentes com preço ou quantidade comercial.");
      return [
        { objeto: produto, campo: v.layout.campos.valorProdutoLiquido!, valor: decimal(p.produtoLiquido) },
        { objeto: produto, campo: v.layout.campos.valorUnitarioLiquido!, valor: decimal(p.unitarioLiquido, true) },
        { objeto: produto, campo: v.layout.campos.valorTotalItem!, valor: decimal(p.totalItem) },
      ];
    }),
    { objeto: documento, campo: v.layout.campos.valorLiquidoProdutosTotal!, valor: decimal(v.valorLiquidoProdutosTotal) },
    { objeto: documento, campo: v.layout.campos.valorTotalDocumento!, valor: decimal(v.valorTotalDocumento) },
  ];
}
/** Campos da API provados em homologação e versionados; nenhum nome é presumido. */
export function aplicarLayoutRtc<T extends Record<string, unknown>>(documento: T, snapshot: SnapshotLayoutRtc): T {
  const copia: T = structuredClone(documento);
  for (const v of valores(snapshot, copia)) escrever(v.objeto, v.campo, v.valor);
  return copia;
}
export function validarLayoutRtc(documento: Record<string, unknown>, snapshot: SnapshotLayoutRtc): void {
  for (const v of valores(snapshot, documento)) {
    const existente = ler(v.objeto, v.campo);
    if ((typeof existente !== "string" && typeof existente !== "number") || !new Prisma.Decimal(String(existente)).equals(String(v.valor))) throw new Error("Campo calculado RTC diverge do snapshot fiscal imutável.");
  }
}
