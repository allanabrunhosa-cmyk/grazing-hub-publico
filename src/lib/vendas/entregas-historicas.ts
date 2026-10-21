import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { definirContextoAtividade } from "@/lib/atividades/registro";
import { historico, type Autor } from "./persistencia";
import { hashCanonico, ORIGEM_HISTORICA, LOJA_HISTORICA } from "./historico-dominio";
import { criarEntregaHistorica, hashEntradaFonteEntregasHistoricas, validarFonteEntregasHistoricas, validarPostalEntregasHistoricas, type EntregaHistorica } from "./entregas-historicas-dominio";

type Objeto = Record<string, unknown>;
type Tx = Prisma.TransactionClient;
export type ContextoEntregasHistoricas = { usuarioId: string; sessaoVersao: number; loteId: string; guardas: { backupHubSha256: string; validacaoDumpSha256: string; baselineSha256: string; conferenciaSha256: string } };
type Entrada = ContextoEntregasHistoricas & { fonte: unknown; fonteSha256: string; postal?: unknown; postalSha256?: string };
export type FonteVinculadaEntrega = { id: string; destinoId: string; chave: string; origem: string; loja: string; entidade: string; dadosOrigem: unknown; pedido: { id: string; status: string; origem: string; referenciaOrigem: string | null; referenciaEstabelecimento: string | null; referenciaPedido: string | null } | null };
type LinhaPlano = { fonteId: string; numeroOriginal: string; situacao: "APLICAR" | "MANTER" | "CONFLITO"; antesPresente: boolean; antes: unknown; depois: EntregaHistorica; dadosOrigem: unknown; hashDadosOrigem: string; hashDepois: string };
type BackupMetadados = { versao: 1; loteId: string; entradaSha256: string; linhas: { fonteId: string; numeroOriginal: string; antesPresente: boolean; antes: unknown; hashDadosOrigem: string; hashDepois: string }[] };
type Recibo = { tipo: "ENRIQUECIMENTO_ENTREGAS_HISTORICAS_V1"; loteId: string; entradaSha256: string; backupMetadadosSha256: string; linhas: BackupMetadados["linhas"]; contagens: Contagens };
type Contagens = { fonte: number; comShipping: number; semShipping: number; vinculados: number; semVinculo: number; aplicar: number; manter: number; conflitos: number; entregasInformadas: number; retiradas: number; comCep: number; comBairro: number; comCidadeUf: number; postalAproveitado: number; conflitoPostal: number };
const objeto = (v: unknown): Objeto => v && typeof v === "object" && !Array.isArray(v) ? v as Objeto : {};
function falhar(codigo: string): never { throw Error(`ENTREGAS_HISTORICAS_${codigo}`); }
const hex = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);

/** Plano puro: nenhuma ligação por nome, endereço, valor ou número nativo. */
export function planejarEnriquecimentoEntregas(entrada: Pick<Entrada, "fonte" | "fonteSha256" | "postal" | "postalSha256" | "loteId">, vinculadas: FonteVinculadaEntrega[]) {
  const fonte = validarFonteEntregasHistoricas(entrada.fonte), postal = entrada.postal === undefined ? undefined : validarPostalEntregasHistoricas(entrada.postal);
  const entradaSha256 = hashEntradaFonteEntregasHistoricas(fonte, entrada.fonteSha256, postal, entrada.postalSha256);
  const conteudoSha256 = hashCanonico(fonte), porNumero = new Map<string, FonteVinculadaEntrega[]>();
  for (const f of vinculadas) if (f.origem === ORIGEM_HISTORICA && f.loja === LOJA_HISTORICA && f.entidade === "PEDIDO_HISTORICO") { const atuais = porNumero.get(f.chave) ?? []; atuais.push(f); porNumero.set(f.chave, atuais); }
  const linhas: LinhaPlano[] = [], contagens: Contagens = { fonte: fonte.linhas.length, comShipping: fonte.linhas.filter(l => l.endereco?.trim()).length, semShipping: fonte.linhas.filter(l => !l.endereco?.trim()).length, vinculados: 0, semVinculo: 0, aplicar: 0, manter: 0, conflitos: 0, entregasInformadas: 0, retiradas: 0, comCep: 0, comBairro: 0, comCidadeUf: 0, postalAproveitado: 0, conflitoPostal: 0 };
  for (const linha of fonte.linhas) {
    const candidatas = porNumero.get(linha.numero) ?? [];
    if (!candidatas.length) { contagens.semVinculo++; continue; }
    const f = candidatas[0], p = f.pedido, dados = objeto(f.dadosOrigem), hub = objeto(dados.hub), antesPresente = Object.hasOwn(hub, "entregaHistorica"), antes = antesPresente ? hub.entregaHistorica : null;
    const depois = criarEntregaHistorica(fonte, linha, entrada.fonteSha256, postal, entrada.postalSha256, conteudoSha256);
    const vinculoSeguro = candidatas.length === 1 && p && p.id === f.destinoId && p.status === "HISTORICO" && p.origem === "HISTORICO_LEGADO" && p.referenciaOrigem === ORIGEM_HISTORICA && p.referenciaEstabelecimento === LOJA_HISTORICA && p.referenciaPedido === linha.numero;
    const estruturaSegura = f.dadosOrigem !== null && typeof f.dadosOrigem === "object" && !Array.isArray(f.dadosOrigem) && Object.hasOwn(dados, "hub") && dados.hub !== null && typeof dados.hub === "object" && !Array.isArray(dados.hub);
    const igual = antesPresente && hashCanonico(antes) === hashCanonico(depois);
    const situacao = !vinculoSeguro || !estruturaSegura || antesPresente && !igual ? "CONFLITO" : igual ? "MANTER" : "APLICAR";
    contagens.vinculados++; contagens[situacao === "CONFLITO" ? "conflitos" : situacao === "MANTER" ? "manter" : "aplicar"]++;
    if (situacao !== "CONFLITO") {
      contagens[depois.modalidade === "RETIRADA" ? "retiradas" : "entregasInformadas"]++;
      if (depois.cep) contagens.comCep++; if (depois.bairro) contagens.comBairro++; if (depois.cidade && depois.uf) contagens.comCidadeUf++;
      if (depois.postal?.compativel) contagens.postalAproveitado++; else if (depois.postal) contagens.conflitoPostal++;
    }
    linhas.push({ fonteId: f.id, numeroOriginal: linha.numero, situacao, antesPresente, antes, depois, dadosOrigem: f.dadosOrigem, hashDadosOrigem: hashCanonico(f.dadosOrigem), hashDepois: hashCanonico(depois) });
  }
  const backupMetadados: BackupMetadados = { versao: 1, loteId: entrada.loteId, entradaSha256, linhas: linhas.filter(l => l.situacao === "APLICAR").map(({ fonteId, numeroOriginal, antesPresente, antes, hashDadosOrigem, hashDepois }) => ({ fonteId, numeroOriginal, antesPresente, antes, hashDadosOrigem, hashDepois })) };
  const token = hashCanonico({ loteId: entrada.loteId, entradaSha256, contagens, linhas: linhas.map(l => ({ fonteId: l.fonteId, numeroOriginal: l.numeroOriginal, situacao: l.situacao, hashDadosOrigem: l.hashDadosOrigem, hashDepois: l.hashDepois })) });
  return { token, entradaSha256, loteId: entrada.loteId, contagens, backupMetadados, linhas };
}

const protegidas = ["ContaBancaria", "LancamentoFinanceiro", "MovimentacaoBancaria", "SaldoEstoque", "MovimentacaoEstoque", "ReservaPedido", "CreditoClienteMovimento", "PagamentoExternoPedido", "RepassePagamentoPedido", "LiquidacaoCartao", "FaturaCartao", "TratamentoFinanceiroPedido", "PedidoVenda", "ItemPedidoVenda", "ClienteVenda"] as const;
async function fotografar(tx: Tx) {
  const resultado: Record<string, { quantidade: string; digest: string }> = {};
  for (const tabela of protegidas) {
    const r = await tx.$queryRaw<{ quantidade: string; digest: string }[]>(Prisma.sql`SELECT count(*)::text AS quantidade, md5(coalesce(string_agg(to_jsonb(t)::text, '|' ORDER BY to_jsonb(t)::text), '')) AS digest FROM ${Prisma.raw(`"${tabela}"`)} t`);
    if (!r[0] || !/^[0-9]+$/u.test(r[0].quantidade) || !/^[a-f0-9]{32}$/u.test(r[0].digest)) falhar("FINGERPRINT_INVALIDO");
    resultado[tabela] = r[0];
  }
  return resultado;
}
async function transacao<T>(entrada: ContextoEntregasHistoricas, leitura: boolean, operacao: (tx: Tx, autor: Autor) => Promise<T>) {
  if (!entrada || typeof entrada.usuarioId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/u.test(entrada.usuarioId) || !Number.isSafeInteger(entrada.sessaoVersao) || entrada.sessaoVersao < 0 || !/^[a-zA-Z0-9:_-]{8,160}$/u.test(entrada.loteId) || !entrada.guardas || !["backupHubSha256", "validacaoDumpSha256", "baselineSha256", "conferenciaSha256"].every(k => hex(entrada.guardas[k as keyof typeof entrada.guardas]))) falhar("CONTEXTO_INVALIDO");
  return prisma.$transaction(async tx => {
    if (leitura) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const trava = await tx.$queryRaw<{ obtida: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('vendas-importacao-historica')) AS obtida`;
    if (trava[0]?.obtida !== true) falhar("MANUTENCAO_CONCORRENTE");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    if (!leitura) await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${entrada.usuarioId} FOR UPDATE`;
    const u = await tx.usuario.findUnique({ where: { id: entrada.usuarioId }, select: { id: true, nome: true, ativo: true, excluidoEm: true, senhaDefinida: true, sessaoVersao: true, perfilAcesso: { select: { sistema: true } } } });
    if (!u?.ativo || u.excluidoEm || !u.senhaDefinida || u.sessaoVersao !== entrada.sessaoVersao || u.perfilAcesso?.sistema !== "ADMINISTRADOR") falhar("ADMINISTRADOR_VIGENTE_EXIGIDO");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
    await definirContextoAtividade(tx, "AUTOMACAO", entrada.loteId);
    const antes = leitura ? null : await fotografar(tx), r = await operacao(tx, { userId: u.id, nome: u.nome, versao: u.sessaoVersao });
    if (antes && hashCanonico(antes) !== hashCanonico(await fotografar(tx))) falhar("DADOS_OPERACIONAIS_ALTERADOS");
    return r;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 600000, maxWait: 10000 });
}
async function fontes(tx: Tx): Promise<FonteVinculadaEntrega[]> {
  const identidades = await tx.identidadeExternaVenda.findMany({ where: { origem: ORIGEM_HISTORICA, loja: LOJA_HISTORICA, entidade: "PEDIDO_HISTORICO" }, select: { id: true, destinoId: true, chave: true, origem: true, loja: true, entidade: true, dadosOrigem: true }, orderBy: { id: "asc" } });
  const pedidos = await tx.pedidoVenda.findMany({ where: { id: { in: identidades.map(i => i.destinoId) } }, select: { id: true, status: true, origem: true, referenciaOrigem: true, referenciaEstabelecimento: true, referenciaPedido: true } });
  const mapa = new Map(pedidos.map(p => [p.id, p])); return identidades.map(f => ({ ...f, pedido: mapa.get(f.destinoId) ?? null }));
}
async function execucao(tx: Tx, loteId: string) {
  const eventos = await tx.historicoCadastroVenda.findMany({ where: { entidade: "IMPORTACAO", registroId: loteId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const aplicacoes = eventos.filter(e => objeto(e.depois).tipo === "ENRIQUECIMENTO_ENTREGAS_HISTORICAS_V1");
  if (aplicacoes.length > 1) falhar("RECIBO_AMBIGUO");
  const evento = aplicacoes[0];
  return evento ? { id: evento.id, recibo: evento.depois as unknown as Recibo, revertida: eventos.some(e => objeto(e.depois).tipo === "REVERSAO_ENTREGAS_HISTORICAS_V1" && objeto(e.depois).reciboId === evento.id) } : null;
}
async function preparar(tx: Tx, entrada: Entrada) {
  const plano = planejarEnriquecimentoEntregas(entrada, await fontes(tx));
  if (entrada.guardas.conferenciaSha256 !== plano.entradaSha256) falhar("GUARDAS_FONTE_DIVERGENTES");
  const anterior = await execucao(tx, entrada.loteId);
  if (anterior && (anterior.recibo.entradaSha256 !== plano.entradaSha256 || anterior.revertida)) falhar("LOTE_DIVERGENTE_OU_REVERTIDO");
  return { ...plano, repeticao: !!anterior };
}
export async function prepararEnriquecimentoEntregasHistoricas(entrada: Entrada) {
  return transacao(entrada, true, async tx => {
    const { token, entradaSha256, loteId, contagens, backupMetadados, repeticao } = await preparar(tx, entrada);
    return { token, entradaSha256, loteId, contagens, backupMetadados, repeticao };
  });
}
export async function aplicarEnriquecimentoEntregasHistoricas(entrada: Entrada & { tokenPrevia: string; backupMetadadosSha256: string }) {
  if (process.env.ENTREGAS_HISTORICAS_AUTORIZADAS !== "SIM") falhar("APLICACAO_NAO_AUTORIZADA");
  return transacao(entrada, false, async (tx, autor) => {
    const p = await preparar(tx, entrada);
    if (p.repeticao) { if (p.contagens.aplicar || p.contagens.conflitos) falhar("REPETICAO_DIVERGENTE"); return { aplicados: 0, loteId: entrada.loteId, entradaSha256: p.entradaSha256, contagens: p.contagens }; }
    if (!hex(entrada.tokenPrevia) || p.token !== entrada.tokenPrevia || p.contagens.conflitos || !hex(entrada.backupMetadadosSha256) || hashCanonico(p.backupMetadados) !== entrada.backupMetadadosSha256) falhar("PREVIA_OU_BACKUP_DIVERGENTE");
    for (const l of p.linhas.filter(l => l.situacao === "APLICAR")) {
      const n = await tx.$executeRaw`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=jsonb_set("dadosOrigem",'{hub,entregaHistorica}',${JSON.stringify(l.depois)}::jsonb,true),"updatedAt"=CURRENT_TIMESTAMP WHERE id=${l.fonteId} AND origem=${ORIGEM_HISTORICA} AND loja=${LOJA_HISTORICA} AND entidade='PEDIDO_HISTORICO' AND chave=${l.numeroOriginal} AND "dadosOrigem"=${JSON.stringify(l.dadosOrigem)}::jsonb`;
      if (n !== 1) falhar("CAS_METADADOS_DIVERGENTE");
    }
    const recibo: Recibo = { tipo: "ENRIQUECIMENTO_ENTREGAS_HISTORICAS_V1", loteId: entrada.loteId, entradaSha256: p.entradaSha256, backupMetadadosSha256: entrada.backupMetadadosSha256, linhas: p.backupMetadados.linhas, contagens: p.contagens };
    await historico(tx, autor, "IMPORTACAO", entrada.loteId, null, recibo);
    return { aplicados: p.contagens.aplicar, loteId: entrada.loteId, entradaSha256: p.entradaSha256, contagens: p.contagens };
  });
}
async function prepararReversao(tx: Tx, entrada: ContextoEntregasHistoricas) {
  const e = await execucao(tx, entrada.loteId);
  if (!e) falhar("LOTE_NAO_ENCONTRADO");
  if (entrada.guardas.conferenciaSha256 !== e.recibo.entradaSha256) falhar("GUARDAS_FONTE_DIVERGENTES");
  const atuais = await fontes(tx), mapa = new Map(atuais.map(f => [f.id, f]));
  const linhas = e.recibo.linhas.map(l => {
    const atual = mapa.get(l.fonteId), hub = objeto(objeto(atual?.dadosOrigem).hub);
    const pedido = atual?.pedido;
    if (!e.revertida && (!atual || atual.chave !== l.numeroOriginal || !pedido || pedido.id !== atual.destinoId || pedido.status !== "HISTORICO" || pedido.origem !== "HISTORICO_LEGADO" || pedido.referenciaOrigem !== ORIGEM_HISTORICA || pedido.referenciaEstabelecimento !== LOJA_HISTORICA || pedido.referenciaPedido !== l.numeroOriginal || hashCanonico(hub.entregaHistorica ?? null) !== l.hashDepois)) falhar("REVERSAO_METADADOS_ALTERADOS");
    return { ...l, dadosOrigem: atual?.dadosOrigem ?? null };
  });
  const token = hashCanonico({ loteId: entrada.loteId, reciboId: e.id, revertida: e.revertida, linhas });
  return { token, entradaSha256: e.recibo.entradaSha256, loteId: entrada.loteId, repeticao: e.revertida, linhas, reciboId: e.id };
}
export async function prepararReversaoEntregasHistoricas(entrada: ContextoEntregasHistoricas) {
  return transacao(entrada, true, async tx => { const { linhas, ...p } = await prepararReversao(tx, entrada); return { ...p, contagens: { reverter: p.repeticao ? 0 : linhas.length } }; });
}
export async function reverterEnriquecimentoEntregasHistoricas(entrada: ContextoEntregasHistoricas & { tokenPrevia: string }) {
  if (process.env.ENTREGAS_HISTORICAS_AUTORIZADAS !== "SIM") falhar("APLICACAO_NAO_AUTORIZADA");
  return transacao(entrada, false, async (tx, autor) => {
    const p = await prepararReversao(tx, entrada);
    if (p.repeticao) return { revertidos: 0, loteId: entrada.loteId, entradaSha256: p.entradaSha256 };
    if (!hex(entrada.tokenPrevia) || entrada.tokenPrevia !== p.token) falhar("PREVIA_REVERSAO_DIVERGENTE");
    for (const l of p.linhas) {
      const dados = l.antesPresente ? Prisma.sql`jsonb_set("dadosOrigem",'{hub,entregaHistorica}',${JSON.stringify(l.antes)}::jsonb,true)` : Prisma.sql`"dadosOrigem" #- '{hub,entregaHistorica}'`;
      const n = await tx.$executeRaw`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=${dados},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${l.fonteId} AND origem=${ORIGEM_HISTORICA} AND loja=${LOJA_HISTORICA} AND entidade='PEDIDO_HISTORICO' AND chave=${l.numeroOriginal} AND "dadosOrigem"=${JSON.stringify(l.dadosOrigem)}::jsonb`;
      if (n !== 1) falhar("CAS_REVERSAO_DIVERGENTE");
    }
    await historico(tx, autor, "IMPORTACAO", entrada.loteId, null, { tipo: "REVERSAO_ENTREGAS_HISTORICAS_V1", reciboId: p.reciboId, entradaSha256: p.entradaSha256, revertidos: p.linhas.length });
    return { revertidos: p.linhas.length, loteId: entrada.loteId, entradaSha256: p.entradaSha256 };
  });
}
