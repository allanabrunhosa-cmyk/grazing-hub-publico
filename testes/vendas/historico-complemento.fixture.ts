import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { hashCanonico, type ItemHistorico } from "@/lib/vendas/historico-dominio";
import type { ComplementoRegistro, PacoteComplementarHistorico, RawComplementoHistorico } from "@/lib/vendas/historico-complemento";
import { pacote, registro } from "./historico-importacao.fixture";

/** Somente dados sintéticos. Dez blocos conhecidos e um extra com desconto. */
export function fixtureComplementoHistorico(opcoes: { extras?: number; repetidos?: boolean; fracionario?: boolean } = {}) {
  const r = registro("21923"), D = Prisma.Decimal;
  r.itens = Array.from({ length: 10 }, (_, indice): ItemHistorico => {
    const bloco = indice + 1, posicao = 10 + indice * 4, nome = opcoes.repetidos ? "Sabor sintético igual" : `Produto sintético ${bloco}`;
    const originais = [nome, "2", "9", "2"];
    originais.forEach((v, i) => { r.raw.valores[posicao + i] = v; });
    return { ...r.itens[0], bloco, colunas: [posicao, posicao + 1, posicao + 2, posicao + 3].map(i => `fonte-${i}`), originais, nome_original: nome, nome_normalizado: nome, chave_nome: nome.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, ""), quantidade: "2", preco_unitario_liquido: "9", desconto_linha: "2", liquido_linha: "18", bruto_linha_reconstruido: "20" };
  });
  // Colunas corretas continuam exigidas pelo validador principal.
  const coluna = (indice: number) => { let n = indice + 1, s = ""; while (n) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
  r.itens.forEach((item, indice) => { item.colunas = Array.from({ length: 4 }, (_, i) => coluna(10 + indice * 4 + i)); });
  const raw: RawComplementoHistorico = { id: "21923", number: "21923", line_items: r.itens.map((item, i) => ({ id: i + 1, name: item.nome_original!, quantity: 2, price: 9, subtotal: "20.00", total: "18.00", subtotal_tax: "0", total_tax: "0", product_id: 100 + i, variation_id: 0, meta_data: [{ key: "sabor", value: `variante sintética ${i}` }] })) };
  const quantidadeExtras = opcoes.extras ?? 1, q = opcoes.fracionario ? "0.125" : "2", preco = opcoes.fracionario ? "8" : "12.50", net = new D(q).times(preco), desconto = new D(5);
  for (let i = 0; i < quantidadeExtras; i++) raw.line_items.push({ id: 100 + i, name: `Extra sintético ${i + 1}`, quantity: q, price: preco, subtotal: net.plus(desconto).toFixed(2), total: net.toFixed(2), subtotal_tax: "0.00", total_tax: "0.00", product_id: 500 + i, variation_id: 0 });
  const bruto = new D(200).plus(net.plus(desconto).times(quantidadeExtras)), total = new D(180).plus(net.times(quantidadeExtras)).minus(5), naoDetalhado = bruto.minus(200);
  r.raw.valores[50] = bruto.toFixed(2); r.raw.valores[51] = "-5.00"; r.raw.valores[52] = total.toFixed(2);
  r.quantidade_blocos = 10; r.hash_linha = hashCanonico(r.raw.valores);
  r.totais = { ...r.totais, liquido_itens: "180", desconto_itens: "20", bruto_reconstruido: "200", subtotal_produtos_original: bruto.toFixed(2), frete_ajuste_original: "-5", total_original: total.toFixed(2), total_calculado_itens_mais_frete: "175", diferenca_produtos: naoDetalhado.toFixed(2), diferenca_total: total.minus(175).toFixed(2), valor_historico_nao_detalhado: naoDetalhado.toFixed(2), diferenca_total_apos_nao_detalhado: total.minus(175).minus(naoDetalhado).toFixed(2), frete_classificacao: "ajuste_legado_a_classificar", zero_final_preservado: total.isZero() };
  const p = pacote([r]), pacotePrincipalJson = JSON.stringify(p), fontePrincipal = { origem: r.origem, sha256: p.metadados.sha256, pacoteSha256: createHash("sha256").update(pacotePrincipalJson).digest("hex") };
  const fonteComplementar = { sistema: "woocommerce" as const, banco: "banco_sintetico", tabela: "orders_cache_sintetico", lidoEm: "2026-10-15T12:00:00Z", snapshotId: "snapshot-sintetico", arquivoSha256: "b".repeat(64) };
  const complemento = { versao: 1 as const, prova: { fontePrincipal, fonteComplementar, numeroOriginal: r.numero_original, hashLinhaPrincipal: r.hash_linha, rawSha256: hashCanonico(raw) }, raw };
  const envelope: PacoteComplementarHistorico = { versao: 1, fontePrincipal, fonteComplementar, pedidos: [{ numeroOriginal: r.numero_original, hashLinhaPrincipal: r.hash_linha, rawSha256: hashCanonico(raw), raw }] };
  return { pacote: p, registro: r, complemento, envelope, pacotePrincipalJson, complementoJson: JSON.stringify(envelope) };
}
export type ComplementoSintetico = ReturnType<typeof fixtureComplementoHistorico>["complemento"];
export function rehashComplementoSintetico(c: ComplementoSintetico | ComplementoRegistro) { c.prova.rawSha256 = hashCanonico(c.raw); }
