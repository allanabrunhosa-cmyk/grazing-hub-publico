import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { ItemHistorico, PacoteHistorico, RegistroHistorico } from "./historico-dominio";

const Decimal = Prisma.Decimal.clone({ precision: 50 });
const ORIGEM = "grazing-legado-orders";
export const ORIGEM_COMPLEMENTO_HISTORICO = "woocommerce-line-items-comprovados";
type Objeto = { [campo: string]: unknown };
export type WooItemHistorico = Objeto & {
  id: number; name: string; quantity: number | string; price: number | string;
  subtotal: string; total: string; subtotal_tax: string; total_tax: string;
  product_id: number; variation_id: number;
};
export type RawComplementoHistorico = Objeto & { id: string; number: string; line_items: WooItemHistorico[] };
export type FontePrincipalComplemento = { origem: string; sha256: string; pacoteSha256: string };
export type FonteWooComplemento = { sistema: "woocommerce"; banco: string; tabela: string; lidoEm: string; snapshotId: string; arquivoSha256: string };
export type ProvaComplementoRegistro = {
  fontePrincipal: FontePrincipalComplemento; fonteComplementar: FonteWooComplemento;
  numeroOriginal: string; hashLinhaPrincipal: string; rawSha256: string;
};
export type ComplementoRegistro = {
  versao: 1; itens: ItemHistorico[]; hash_sha256: string; prova: ProvaComplementoRegistro;
  raw: RawComplementoHistorico;
  cotejo: { correspondencias: { bloco: number; wooItemId: number }[]; subtotalBruto: string; liquidoItens: string; descontoItens: string; totalComFrete: string };
};
export type PacoteComplementarHistorico = {
  versao: 1; fontePrincipal: FontePrincipalComplemento; fonteComplementar: FonteWooComplemento;
  pedidos: { numeroOriginal: string; hashLinhaPrincipal: string; rawSha256: string; raw: RawComplementoHistorico }[];
};

function falhar(codigo: string): never { throw Error(`HISTORICO_COMPLEMENTO_${codigo}`); }
function objeto(v: unknown): Objeto {
  if (!v || typeof v !== "object" || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return falhar("OBJETO_INVALIDO");
  return v as Objeto;
}
function texto(v: unknown, maximo = 200, padrao?: RegExp): string {
  if (typeof v !== "string" || !v.trim() || v.length > maximo || (padrao && !padrao.test(v))) return falhar("TEXTO_INVALIDO");
  return v;
}
const sha = (v: unknown) => texto(v, 64, /^[a-f0-9]{64}$/);
function canonico(v: unknown, pais = new Set<object>()): unknown {
  if (v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) return v;
  if (!v || typeof v !== "object" || pais.has(v)) return falhar("RAW_JSON_INVALIDO");
  pais.add(v);
  const saida = Array.isArray(v) ? v.map(x => canonico(x, pais)) : Object.fromEntries(Object.keys(objeto(v)).sort().map(k => [k, canonico((v as Objeto)[k], pais)]));
  pais.delete(v); return saida;
}
function hash(v: unknown): string { return createHash("sha256").update(JSON.stringify(canonico(v))).digest("hex"); }
function clonar<T>(v: T): T { return JSON.parse(JSON.stringify(canonico(v))) as T; }
const nome = (v: string) => v.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR");
function monetario(v: unknown, negativo = false): Prisma.Decimal {
  if (typeof v !== "string" || !(negativo ? /^-?\d{1,12}(?:\.\d{1,2})?$/ : /^\d{1,12}(?:\.\d{1,2})?$/).test(v)) return falhar("VALOR_INVALIDO");
  return new Decimal(v);
}
function quantidade(v: unknown): Prisma.Decimal {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
  if (typeof s !== "string" || !/^\d{1,12}(?:\.\d{1,6})?$/.test(s)) return falhar("QUANTIDADE_INVALIDA");
  const q = new Decimal(s); if (q.lte(0)) return falhar("QUANTIDADE_INVALIDA"); return q;
}
function id(v: unknown, zero = false): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < (zero ? 0 : 1)) return falhar("ID_INVALIDO"); return v;
}
function principal(v: unknown): FontePrincipalComplemento {
  const x = objeto(v); if (x.origem !== ORIGEM) return falhar("ORIGEM_INVALIDA");
  return { origem: ORIGEM, sha256: sha(x.sha256), pacoteSha256: sha(x.pacoteSha256) };
}
function fonte(v: unknown): FonteWooComplemento {
  const x = objeto(v); if (x.sistema !== "woocommerce") return falhar("FONTE_INVALIDA");
  const lidoEm = texto(x.lidoEm, 40, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/);
  if (!Number.isFinite(Date.parse(lidoEm))) return falhar("LEITURA_INVALIDA");
  return { sistema: "woocommerce", banco: texto(x.banco), tabela: texto(x.tabela), lidoEm, snapshotId: texto(x.snapshotId), arquivoSha256: sha(x.arquivoSha256) };
}
type Linha = { raw: WooItemHistorico; nome: string; q: Prisma.Decimal; unitario: Prisma.Decimal; bruto: Prisma.Decimal; liquido: Prisma.Decimal; desconto: Prisma.Decimal };
function linha(v: unknown): Linha {
  const x = objeto(v); id(x.id); id(x.product_id, true); id(x.variation_id, true);
  const nomeOriginal = texto(x.name, 2000), q = quantidade(x.quantity), bruto = monetario(x.subtotal), liquido = monetario(x.total);
  if (bruto.lt(liquido)) return falhar("DESCONTO_NEGATIVO");
  if (!monetario(x.subtotal_tax).isZero() || !monetario(x.total_tax).isZero()) return falhar("TRIBUTO_NAO_REPRESENTAVEL");
  const unitario = liquido.div(q);
  if (unitario.decimalPlaces() > 2 || !unitario.times(q).eq(liquido)) return falhar("UNITARIO_NAO_REPRESENTAVEL");
  const precoWoo = typeof x.price === "number" && Number.isFinite(x.price) ? String(x.price) : x.price;
  if (!monetario(precoWoo).eq(unitario)) return falhar("PRECO_WOO_DIVERGENTE");
  return { raw: clonar(x) as WooItemHistorico, nome: nome(nomeOriginal), q, unitario, bruto, liquido, desconto: bruto.minus(liquido) };
}

/** Revalida o snapshot bruto. Itens e flags declarados no intermediário não comprovam nada. */
export function validarComplementoRegistro(registro: RegistroHistorico, valor: unknown): ComplementoRegistro {
  const c = objeto(valor), p = objeto(c.prova), raw = objeto(c.raw);
  if (c.versao !== 1) return falhar("VERSAO_INVALIDA");
  const prova: ProvaComplementoRegistro = { fontePrincipal: principal(p.fontePrincipal), fonteComplementar: fonte(p.fonteComplementar), numeroOriginal: texto(p.numeroOriginal, 30, /^\d+$/), hashLinhaPrincipal: sha(p.hashLinhaPrincipal), rawSha256: sha(p.rawSha256) };
  if (registro.origem !== ORIGEM || prova.numeroOriginal !== registro.numero_original || prova.hashLinhaPrincipal !== registro.hash_linha || hash(registro.raw.valores) !== registro.hash_linha || registro.raw.valores.length !== 59 || registro.raw.valores[8]?.trim() !== registro.numero_original) return falhar("VINCULO_PRINCIPAL_DIVERGENTE");
  const rawId = texto(raw.id, 30, /^\d+$/), rawNumero = texto(raw.number, 30, /^\d+$/);
  if (rawId === "0" || rawNumero !== registro.numero_original || hash(raw) !== prova.rawSha256) return falhar("RAW_DIVERGENTE");
  if (!Array.isArray(raw.line_items) || raw.line_items.length <= 10 || raw.line_items.length > 1000) return falhar("ITENS_INVALIDOS");
  const linhas = raw.line_items.map(linha).sort((a, b) => a.raw.id - b.raw.id), ids = new Set(linhas.map(l => l.raw.id));
  if (ids.size !== linhas.length) return falhar("ITEM_DUPLICADO");
  const usados = new Set<number>(), correspondencias: { bloco: number; wooItemId: number }[] = [];
  for (let bloco = 1; bloco <= 10; bloco++) {
    const posicao = 10 + (bloco - 1) * 4, valores = registro.raw.valores.slice(posicao, posicao + 4);
    const nomeOriginal = texto(valores[0], 2000), q = quantidade(valores[1]), unitario = monetario(valores[2]), desconto = valores[3] === null || valores[3] === "" ? new Decimal(0) : monetario(valores[3]);
    const liquido = q.times(unitario), bruto = liquido.plus(desconto);
    const match = linhas.find(l => !usados.has(l.raw.id) && l.nome === nome(nomeOriginal) && l.q.eq(q) && l.unitario.eq(unitario) && l.liquido.eq(liquido) && l.bruto.eq(bruto) && l.desconto.eq(desconto));
    if (!match) return falhar("CONHECIDO_NAO_COMPROVADO");
    usados.add(match.raw.id); correspondencias.push({ bloco, wooItemId: match.raw.id });
  }
  const extras = linhas.filter(l => !usados.has(l.raw.id));
  if (extras.some(l => l.raw.product_id <= 0)) return falhar("PRODUTO_EXTRA_NAO_IDENTIFICADO");
  const bruto = linhas.reduce((n, l) => n.plus(l.bruto), new Decimal(0)), liquido = linhas.reduce((n, l) => n.plus(l.liquido), new Decimal(0)), descontos = linhas.reduce((n, l) => n.plus(l.desconto), new Decimal(0));
  const frete = monetario(registro.raw.valores[51], true), subtotalFonte = monetario(registro.raw.valores[50], true), totalFonte = monetario(registro.raw.valores[52], true);
  if (!bruto.eq(subtotalFonte) || !liquido.plus(frete).eq(totalFonte)) return falhar("FECHAMENTO_DIVERGENTE");
  const itens: ItemHistorico[] = extras.map((l, indice) => ({
    bloco: 11 + indice, colunas: [], linha: registro.linha,
    originais: [l.raw.name, String(l.raw.quantity), String(l.raw.price), l.desconto.toFixed(2)],
    nome_original: l.raw.name, nome_normalizado: l.raw.name.normalize("NFKC").trim().replace(/\s+/gu, " "), chave_nome: l.nome.normalize("NFKD").replace(/\p{M}/gu, ""),
    quantidade: l.q.toString(), preco_unitario_liquido: l.unitario.toFixed(2), desconto_linha: l.desconto.toFixed(2), desconto_ausente: false,
    liquido_linha: l.liquido.toFixed(2), bruto_linha_reconstruido: l.bruto.toFixed(2), incompleto: false, produto_externo_nao_identificado: l.nome === "produto externo",
    consumo_apurado: null, custo_historico_comprovado: null,
    complemento: { origem: ORIGEM_COMPLEMENTO_HISTORICO, chave: `${ORIGEM_COMPLEMENTO_HISTORICO}:${rawId}:${l.raw.id}`, pedidoWooId: rawId, itemWooId: l.raw.id, produtoWooId: l.raw.product_id, variacaoWooId: l.raw.variation_id, raw: l.raw, rawSha256: hash(l.raw) },
  }));
  // Datas de leitura e hashes de arquivos agregados só pertencem à prova. Uma
  // releitura dos mesmos itens não altera a versão comercial do pedido.
  const hash_sha256 = hash({ versao: 1, origem: ORIGEM_COMPLEMENTO_HISTORICO, numeroOriginal: registro.numero_original, hashLinhaPrincipal: registro.hash_linha, rawSha256: prova.rawSha256 });
  if (c.hash_sha256 !== undefined && c.hash_sha256 !== hash_sha256) return falhar("HASH_VERSAO_DIVERGENTE");
  return { versao: 1, itens, hash_sha256, prova, raw: clonar(raw) as RawComplementoHistorico, cotejo: { correspondencias, subtotalBruto: bruto.toFixed(2), liquidoItens: liquido.toFixed(2), descontoItens: descontos.toFixed(2), totalComFrete: liquido.plus(frete).toFixed(2) } };
}

/** O chamador confere os hashes físicos; esta função preserva e vincula a cópia. */
export function aplicarComplementoPacote(pacote: PacoteHistorico, valor: unknown, contexto: { fonteSha256: string; pacoteSha256: string }): PacoteHistorico {
  const envelope = objeto(valor), fp = principal(envelope.fontePrincipal), fc = fonte(envelope.fonteComplementar);
  if (envelope.versao !== 1 || fp.sha256 !== sha(contexto.fonteSha256) || fp.sha256 !== pacote.metadados.sha256 || fp.pacoteSha256 !== sha(contexto.pacoteSha256)) return falhar("HASH_FONTE_DIVERGENTE");
  if (!Array.isArray(envelope.pedidos) || envelope.pedidos.length < 1 || envelope.pedidos.length > pacote.registros.length) return falhar("PEDIDOS_INVALIDOS");
  if (pacote.registros.some(r => r.complemento !== undefined)) return falhar("PRINCIPAL_JA_COMPLEMENTADO");
  const resultado = clonar(pacote), mapa = new Map(resultado.registros.map(r => [r.numero_original, r])), usados = new Set<string>();
  for (const valor of envelope.pedidos) {
    const p = objeto(valor), numeroOriginal = texto(p.numeroOriginal, 30, /^\d+$/), r = mapa.get(numeroOriginal);
    if (!r || usados.has(numeroOriginal)) return falhar("PEDIDO_AUSENTE_OU_DUPLICADO");
    usados.add(numeroOriginal);
    r.complemento = validarComplementoRegistro(r, { versao: 1, prova: { fontePrincipal: fp, fonteComplementar: fc, numeroOriginal, hashLinhaPrincipal: p.hashLinhaPrincipal, rawSha256: p.rawSha256 }, raw: p.raw });
  }
  return resultado;
}

/** Verifica hashes dos arquivos antes de anexar complementos à cópia validada. */
export async function validarPacoteComplementarHistorico(entrada: { pacotePrincipalJson: string; complementoJson: string }): Promise<{
  pacote: PacoteHistorico; pacotePrincipalSha256: string; complementoSha256: string; versaoDerivadaSha256: string;
  contagens: { pedidosPrimarios: number; itensPrimarios: number; unidadesPrimarias: string; pedidosComplementados: number; itensComplementares: number; unidadesComplementares: string };
}> {
  const principalSha256 = createHash("sha256").update(entrada.pacotePrincipalJson).digest("hex"), complementoSha256 = createHash("sha256").update(entrada.complementoJson).digest("hex");
  const primario = objeto(JSON.parse(entrada.pacotePrincipalJson));
  if (!Array.isArray(primario.registros) || primario.registros.some(r => objeto(r).complemento !== undefined)) return falhar("PRINCIPAL_JA_COMPLEMENTADO");
  const { validarPacoteHistorico } = await import("./historico-dominio");
  const validado = validarPacoteHistorico(primario), pacote = aplicarComplementoPacote(validado, JSON.parse(entrada.complementoJson), { fonteSha256: validado.metadados.sha256, pacoteSha256: principalSha256 });
  let itensComplementares = 0, unidadesComplementares = new Decimal(0);
  for (const r of pacote.registros) {
    if (!r.complemento) continue;
    const complemento = r.complemento as ComplementoRegistro;
    itensComplementares += complemento.itens.length;
    unidadesComplementares = complemento.itens.reduce((n, i) => n.plus(i.quantidade!), unidadesComplementares);
  }
  const versoes = pacote.registros.filter(r => r.complemento !== undefined).map(r => ({ numeroOriginal: r.numero_original, hash: (r.complemento as ComplementoRegistro).hash_sha256 })).sort((a, b) => a.numeroOriginal.localeCompare(b.numeroOriginal));
  return { pacote, pacotePrincipalSha256: principalSha256, complementoSha256, versaoDerivadaSha256: hash({ principal: pacote.registros.map(r => ({ numeroOriginal: r.numero_original, hashLinha: r.hash_linha })), complementos: versoes }),
    contagens: { pedidosPrimarios: pacote.metadados.registros, itensPrimarios: pacote.metadados.itens, unidadesPrimarias: pacote.metadados.unidades, pedidosComplementados: versoes.length, itensComplementares, unidadesComplementares: unidadesComplementares.toString() } };
}
