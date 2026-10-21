import path from "node:path";
import { lstat } from "node:fs/promises";
import { hashCanonico } from "../src/lib/vendas/historico-dominio";
import { lerJsonCorrecao, objetoCorrecao, prepararSaidaCorrecao, salvarJsonCorrecao, shaArquivoCorrecao } from "./clientes-historicos-arquivos";

export { prepararSaidaCorrecao as prepararSaidaEntregas, salvarJsonCorrecao as salvarJsonEntregas, shaArquivoCorrecao as shaArquivoEntregas };
type Objeto = Record<string, unknown>;
const hex = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);
const finalidade = "ENTREGAS_HISTORICAS";
function erro(codigo: string): never { throw Error(`ENTREGAS_HISTORICAS_ARQUIVO_${codigo}`); }
function objeto(v: unknown): Objeto { try { return objetoCorrecao(v); } catch { return erro("OBJETO_INVALIDO"); } }
function fresco(v: unknown, agora: number) {
  const instante = typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isFinite(instante) || instante > agora + 300_000 || agora - instante > 7_200_000) erro("PROVA_EXPIRADA");
}
export async function lerJsonEntregas(arquivo: string, maximo = 30_000_000) {
  if ((await lstat(arquivo)).size > maximo) erro("TAMANHO_RECUSADO");
  const antes = await shaArquivoCorrecao(arquivo);
  if (antes.bytes > maximo) erro("TAMANHO_RECUSADO");
  const conteudo = await lerJsonCorrecao(arquivo, maximo), depois = await shaArquivoCorrecao(arquivo);
  if (antes.sha256 !== depois.sha256 || antes.bytes !== depois.bytes) erro("MUDOU_DURANTE_LEITURA");
  return { conteudo, ...depois };
}

export const TABELAS_BASELINE_ENTREGAS = ["PedidoVenda", "ItemPedidoVenda", "ClienteVenda", "ContaBancaria", "LancamentoFinanceiro", "MovimentacaoBancaria", "SaldoEstoque", "MovimentacaoEstoque", "ReservaPedido", "CreditoClienteMovimento", "PagamentoExternoPedido", "RepassePagamentoPedido", "LiquidacaoCartao", "FaturaCartao", "TratamentoFinanceiroPedido"] as const;

/** Destino explícito. Nenhuma variável de ambiente é carregada de arquivo. */
export function destinoBancoEntregas() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); } catch { return erro("BANCO_RECUSADO"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) || url.pathname !== "/grazing_hub" || !url.username || !url.password || url.hash || [...url.searchParams].some(([chave, valor]) => chave !== "schema" || valor !== "public")) erro("BANCO_RECUSADO");
  return hashCanonico({ host: url.hostname, porta: url.port || "5432", banco: "grazing_hub", schema: "public" });
}

/** A baseline contém apenas contagens e hashes. As tabelas alteradas de propósito ficam fora. */
export function conferirBaselineEntregas(valor: unknown, destinoSha256: string, agora = Date.now()) {
  const b = objeto(valor), c = objeto(b.checkpoint), tabelas = objeto(b.tabelas);
  if (Object.keys(b).some(k => !["versao", "finalidade", "destinoBancoSha256", "checkpoint", "tabelas"].includes(k)) || b.versao !== 1 || b.finalidade !== finalidade || b.destinoBancoSha256 !== destinoSha256 || c.db !== "grazing_hub" || ![true, "on"].includes(c.readonly as boolean | string) || typeof c.snapshot !== "string" || !c.snapshot || String(c.isolamento).replaceAll("_", " ").toLowerCase() !== "repeatable read") erro("BASELINE_INVALIDA");
  if (Object.keys(c).some(k => !["db", "instante", "snapshot", "readonly", "isolamento"].includes(k)) || hashCanonico(Object.keys(tabelas).sort()) !== hashCanonico([...TABELAS_BASELINE_ENTREGAS].sort())) erro("BASELINE_COBERTURA_INVALIDA");
  fresco(c.instante, agora);
  for (const nome of TABELAS_BASELINE_ENTREGAS) {
    const t = objeto(tabelas[nome]), f = objeto(t.fingerprint);
    if (Object.keys(t).some(k => k !== "fingerprint") || Object.keys(f).some(k => !["quantidade", "digest"].includes(k)) || !/^\d+$/u.test(String(f.quantidade)) || !/^[a-f0-9]{32}$/u.test(String(f.digest))) erro("BASELINE_COBERTURA_INVALIDA");
  }
}

export async function conferirGuardasEntregas(arquivo: string, esperado: string, entradaSha256: string, agora = Date.now()) {
  if (!hex(esperado) || !hex(entradaSha256)) erro("HASH_INVALIDO");
  const lido = await lerJsonEntregas(arquivo), g = lido.conteudo, base = path.dirname(arquivo), destinoSha256 = destinoBancoEntregas();
  if (lido.sha256 !== esperado || g.versao !== 1 || g.finalidade !== finalidade || g.entradaSha256 !== entradaSha256 || g.destinoBancoSha256 !== destinoSha256) erro("GUARDA_DIVERGENTE");
  fresco(g.geradoEm, agora);
  async function referencia(valor: unknown) {
    const r = objeto(valor);
    if (typeof r.arquivo !== "string" || !r.arquivo.startsWith(base + path.sep) || !hex(r.sha256)) erro("REFERENCIA_DIVERGENTE");
    const resultado = await lerJsonEntregas(r.arquivo);
    if (resultado.sha256 !== r.sha256) erro("REFERENCIA_DIVERGENTE");
    return resultado;
  }
  const m = await referencia(g.backupManifesto), v = await referencia(g.validacaoDump), b = await referencia(g.baseline);
  const manifesto = m.conteudo, validacao = v.conteudo;
  fresco(manifesto.geradoEm, agora); fresco(validacao.geradoEm, agora);
  if (manifesto.versao !== 1 || manifesto.finalidade !== finalidade || manifesto.database !== "grazing_hub" || manifesto.destinoBancoSha256 !== destinoSha256 || manifesto.formato !== "custom" || manifesto.completo !== true || typeof manifesto.arquivo !== "string" || !manifesto.arquivo.startsWith(base + path.sep) || !hex(manifesto.sha256) || !Number.isSafeInteger(manifesto.bytes) || Number(manifesto.bytes) < 1000) erro("BACKUP_INVALIDO");
  const dump = await shaArquivoCorrecao(manifesto.arquivo);
  if (dump.sha256 !== manifesto.sha256 || dump.bytes !== manifesto.bytes) erro("DUMP_DIVERGENTE");
  if (validacao.versao !== 1 || validacao.finalidade !== finalidade || validacao.database !== "grazing_hub" || validacao.destinoBancoSha256 !== destinoSha256 || validacao.dumpSha256 !== dump.sha256 || validacao.bytes !== dump.bytes || validacao.ferramenta !== "pg_restore" || validacao.codigoSaidaListagem !== 0 || validacao.codigoSaidaLeituraIntegral !== 0 || !["/dev/null", "NUL"].includes(String(validacao.destinoSql)) || validacao.bancoRestaurado !== false || validacao.sqlExposto !== false) erro("VALIDACAO_DUMP_INVALIDA");
  conferirBaselineEntregas(b.conteudo, destinoSha256, agora);
  return { backupHubSha256: dump.sha256, validacaoDumpSha256: v.sha256, baselineSha256: b.sha256, conferenciaSha256: entradaSha256 };
}

export const CODIGO_ENTREGAS_HISTORICAS = ["Dockerfile", "scripts/entregas-historicas-enriquecer.ts", "scripts/entregas-historicas-arquivos.ts", "scripts/clientes-historicos-arquivos.ts", "src/lib/vendas/entregas-historicas.ts", "src/lib/vendas/entregas-historicas-dominio.ts", "src/lib/vendas/historico-dominio.ts", "src/lib/vendas/persistencia.ts", "src/lib/atividades/registro.ts", "src/lib/prisma.ts", "prisma/schema.prisma"] as const;

export async function conferirCodigoEntregas(verificacoes: string, publicacao: string, revisao: string, entradaSha256: string) {
  const v = (await lerJsonEntregas(verificacoes)).conteudo, p = (await lerJsonEntregas(publicacao)).conteudo, codigo = objeto(v.codigo), destinoSha256 = destinoBancoEntregas();
  if (!/^[a-f0-9]{40}$/u.test(revisao) || v.finalidade !== finalidade || p.finalidade !== finalidade || v.destinoBancoSha256 !== destinoSha256 || p.destinoBancoSha256 !== destinoSha256 || v.revisao !== revisao || p.revisao !== revisao || v.entradaSha256 !== entradaSha256 || p.entradaSha256 !== entradaSha256 || hashCanonico(Object.keys(codigo).sort()) !== hashCanonico([...CODIGO_ENTREGAS_HISTORICAS].sort()) || hashCanonico(codigo) !== hashCanonico(p.codigo) || !Array.isArray(v.verificacoes)) erro("CODIGO_NAO_COMPROVADO");
  for (const arquivo of CODIGO_ENTREGAS_HISTORICAS) if ((await shaArquivoCorrecao(path.resolve(arquivo), false)).sha256 !== codigo[arquivo]) erro("CODIGO_DIVERGENTE");
  for (const nome of ["lint", "tipos", "build", "integracao", "reconciliacao", "simulacao"]) {
    const itens = v.verificacoes.map(objeto).filter(r => r.nome === nome), item = itens[0];
    if (itens.length !== 1 || item.resultado !== "APROVADO" || typeof item.log !== "string" || !hex(item.sha256)) erro("VERIFICACAO_NAO_COMPROVADA");
    const log = await shaArquivoCorrecao(item.log as string);
    if (log.bytes < 1 || log.sha256 !== item.sha256) erro("VERIFICACAO_NAO_COMPROVADA");
  }
}
