import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividades/registro";
import { chaveLocalEnderecoPostal, pendenciaEnderecoPostal } from "./cliente-enderecos";
import { entregasDoCliente, indiceEntregaCliente, LIMITE_ENTREGAS_CLIENTE } from "./cliente-entrega";
import { validarEntregaPadraoCliente, type EntregaCliente, type EntregaPadraoCliente } from "./dominio";
import { hashReconciliacao, ORIGEM_RECONCILIACAO, type EvidenciaReconciliacao } from "./clientes-cobrancas-reconciliacao";
import { inspecionarCadastroSaneamento, type PerfilSaneamento } from "./clientes-enderecos-saneamento";

type Json = Record<string, unknown>;
export type GrupoEquivalenciaEntrega = { id: string; entradas: { indice: number; sha256: string }[]; indiceManter: number; motivo: string; complementoFinal?: string; permitirCodigosLojaComoReferencia: boolean };
export type ConfiguracaoEquivalencias = { versao: 1; modo: "UNIFICAR_ENTREGAS_EQUIVALENTES"; operacaoId: string; revisaoCodigo: string; atorSistema: string; alvo: { id: string; versao: number; estadoSha256: string }; grupos: GrupoEquivalenciaEntrega[] };
export type DecisaoEquivalencia = { grupoId: string; indicesOriginais: number[]; indiceManterSolicitado: number; indiceManterEfetivo: number; indiceNovo: number | null; chaveLocal: string | null; complementoAntes: string; complementoDepois: string; motivo: string; permitirCodigosLojaComoReferencia: boolean; unidades: string[] };
export type PreviaEquivalencias = { versao: 1; modo: "UNIFICAR_ENTREGAS_EQUIVALENTES"; operacaoId: string; configuracaoSha256: string; token: string; aplicavel: boolean; temAlteracoes: boolean; pendencias: { codigo: string; grupoId: string }[]; antes: PerfilSaneamento; depois: PerfilSaneamento; campos: { entregaPadrao: EntregaPadraoCliente }; grupos: DecisaoEquivalencia[]; indices: { indiceOriginal: number; indiceNovo: number }[]; selecionadoAntes: number; selecionadoDepois: number; contagens: { grupos: number; entregasAntes: number; entregasDepois: number; entregasUnificadas: number; complementosAlterados: number } };
type Banco = Pick<PrismaClient, "$transaction">;
type Opcoes = { banco?: Banco; agora?: () => Date };
const MODO = "UNIFICAR_ENTREGAS_EQUIVALENTES", ENTIDADE = "RECONCILIACAO_COBRANCAS", LOJA = "grazing-hub";
function falha(c: string): never { throw Error(`EQUIVALENCIAS_${c}`); }
function obj(v: unknown): Json { if (!v || typeof v !== "object" || Array.isArray(v)) falha("OBJETO_INVALIDO"); return v as Json; }
function somente(v: Json, campos: string[]) { if (Object.keys(v).some(k => !campos.includes(k))) falha("CAMPO_DESCONHECIDO"); }
function texto(v: unknown, max = 160, vazio = false) { if (typeof v !== "string" || (!vazio && !v.trim()) || v.length > max || /[\u0000-\u001f]/.test(v)) falha("TEXTO_INVALIDO"); return v.trim(); }
function id(v: unknown) { const s = texto(v, 120); if (!/^[a-zA-Z0-9:_-]+$/.test(s)) falha("ID_INVALIDO"); return s; }
function hex(v: unknown) { if (typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v)) falha("HASH_INVALIDO"); return v; }
function indice(v: unknown) { if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) >= LIMITE_ENTREGAS_CLIENTE) falha("INDICE_INVALIDO"); return Number(v); }
function json<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export function validarConfiguracaoEquivalencias(entrada: unknown): ConfiguracaoEquivalencias {
  const d = obj(entrada), alvo = obj(d.alvo);
  somente(d, ["versao", "modo", "operacaoId", "revisaoCodigo", "atorSistema", "alvo", "grupos"]); somente(alvo, ["id", "versao", "estadoSha256"]);
  if (d.versao !== 1 || d.modo !== MODO || !Number.isSafeInteger(alvo.versao) || Number(alvo.versao) < 1 || !Array.isArray(d.grupos) || !d.grupos.length || d.grupos.length > LIMITE_ENTREGAS_CLIENTE / 2) falha("CONFIGURACAO_INVALIDA");
  const revisaoCodigo = texto(d.revisaoCodigo, 64); if (!/^[a-f0-9]{40,64}$/.test(revisaoCodigo)) falha("REVISAO_INVALIDA");
  const usados = new Set<number>(), gruposIds = new Set<string>();
  const grupos = d.grupos.map(entrada => {
    const g = obj(entrada); somente(g, ["id", "entradas", "indiceManter", "motivo", "complementoFinal", "permitirCodigosLojaComoReferencia"]);
    if (!Array.isArray(g.entradas) || g.entradas.length < 2 || g.entradas.length > LIMITE_ENTREGAS_CLIENTE || typeof g.permitirCodigosLojaComoReferencia !== "boolean") falha("GRUPO_INVALIDO");
    const grupoId = id(g.id); if (gruposIds.has(grupoId)) falha("GRUPO_REPETIDO"); gruposIds.add(grupoId);
    const entradas = g.entradas.map(entrada => { const e = obj(entrada); somente(e, ["indice", "sha256"]); const n = indice(e.indice); if (usados.has(n)) falha("GRUPOS_SOBREPOSTOS"); usados.add(n); return { indice: n, sha256: hex(e.sha256) }; }).sort((a, b) => a.indice - b.indice);
    const indiceManter = indice(g.indiceManter); if (!entradas.some(e => e.indice === indiceManter)) falha("SOBREVIVENTE_FORA_GRUPO");
    return { id: grupoId, entradas, indiceManter, motivo: texto(g.motivo, 1000), ...(Object.hasOwn(g, "complementoFinal") ? { complementoFinal: texto(g.complementoFinal, 160, true) } : {}), permitirCodigosLojaComoReferencia: g.permitirCodigosLojaComoReferencia };
  }).sort((a, b) => a.entradas[0].indice - b.entradas[0].indice);
  return { versao: 1, modo: MODO, operacaoId: id(d.operacaoId), revisaoCodigo, atorSistema: id(d.atorSistema), alvo: { id: id(alvo.id), versao: Number(alvo.versao), estadoSha256: hex(alvo.estadoSha256) }, grupos };
}

/** A revisão pode dispensar códigos comerciais de LOJA, nunca unidades físicas. */
function unidades(complemento: string, permitirLoja: boolean) {
  const aliases: Record<string, string> = { ED: "PREDIO", EDIFICIO: "PREDIO", PREDIO: "PREDIO", BL: "BLOCO", BLOCO: "BLOCO", TORRE: "TORRE", SL: "SALA", SALA: "SALA", AP: "APARTAMENTO", APT: "APARTAMENTO", APTO: "APARTAMENTO", APARTAMENTO: "APARTAMENTO", CJ: "CONJUNTO", CONJUNTO: "CONJUNTO", ANDAR: "ANDAR", PISO: "PISO", CASA: "CASA", LOTE: "LOTE", QUADRA: "QUADRA", LJ: "LOJA", LOJA: "LOJA" };
  const normal = complemento.replace(/\bN\s*\.?\s*[º°ªo]\s*\.?(?=\s|\d)/giu, " ").replace(/(\d+)\s*[º°ª](?=\s*(?:ANDAR|PISO)\b)\s*/giu, "$1 ").replace(/(\d+)\s*[º°ª]/g, "$1").normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().replace(/[.,:;()]/g, " ").replace(/\b(PREDIO|EDIFICIO|BLOCO|TORRE|SALA|APARTAMENTO|APTO|APT|CONJUNTO|ANDAR|PISO|CASA|LOTE|QUADRA|LOJA)(?=[A-Z0-9])/g, "$1 ").replace(/\b(BL|SL|AP|CJ|LJ)(?=\d|[IVX]+\b)/g, "$1 ").replace(/\s+/g, " ");
  const marcadores = [...normal.matchAll(/\b(PREDIO|EDIFICIO|ED|BLOCO|BL|TORRE|SALA|SL|APARTAMENTO|APTO|APT|AP|CONJUNTO|CJ|ANDAR|PISO|CASA|LOTE|QUADRA|LOJA|LJ)\b/g)], encontrados: string[] = [];
  let ambigua = false;
  for (const [i, m] of marcadores.entries()) {
    const tipo = aliases[m[1]]; if (permitirLoja && tipo === "LOJA") continue;
    const depois = normal.slice(m.index! + m[0].length, marcadores[i + 1]?.index).trim(), antes = normal.slice(0, m.index).trim();
    // Ordinais anteriores ao rótulo também identificam unidades físicas.
    const reverso = ["ANDAR", "PISO"].includes(tipo) ? /\b(\d+)$/.exec(antes) : null;
    const valor = reverso?.[1] ?? /^(?:(?:N|NUMERO)\s+)?([A-Z0-9]+(?:[-/][A-Z0-9]+)*)\b/.exec(depois)?.[1];
    if (!valor || /^(N|NO|NUMERO|DE|DA|DO|DOS|DAS|E|OU|AO)$/.test(valor)) { ambigua = true; continue; }
    const resto = reverso ? depois : depois.slice(depois.indexOf(valor) + valor.length).trim();
    // Listas e intervalos exigem revisão específica; nunca descartar a segunda unidade.
    if (/^(?:E|OU|A|ATE)\b|^\d|^[A-Z](?:\s|$)|^[&/+-]/.test(resto) || (reverso && /^(?:[IVX]+|NUMERO)\b/.test(resto))) ambigua = true;
    encontrados.push(`${tipo}:${valor}`);
  }
  return { unidades: [...new Set(encontrados)].sort(), ambigua };
}
function conferirUnidades(entradas: EntregaCliente[], final: string, permitirLoja: boolean) {
  const originais = entradas.map(e => unidades(e.endereco.complemento ?? "", permitirLoja)), novo = unidades(final, permitirLoja), anteriores = [...new Set(originais.flatMap(e => e.unidades))].sort(), finais = novo.unidades, porTipo = new Map<string, Set<string>>();
  if (novo.ambigua || originais.some(e => e.ambigua)) return { codigo: "UNIDADE_FISICA_AMBIGUA", unidades: anteriores };
  for (const u of anteriores) { const tipo = u.split(":")[0]; const valores = porTipo.get(tipo) ?? new Set<string>(); valores.add(u); porTipo.set(tipo, valores); }
  if ([...porTipo.values()].some(v => v.size > 1)) return { codigo: "UNIDADES_FISICAS_DIVERGENTES", unidades: anteriores };
  if (hashReconciliacao(anteriores) !== hashReconciliacao(finais)) return { codigo: "UNIDADE_FISICA_ALTERADA", unidades: anteriores };
  return { codigo: null, unidades: anteriores };
}
function conferirAlvo(config: ConfiguracaoEquivalencias, perfil: PerfilSaneamento) {
  if (perfil.id !== config.alvo.id || perfil.unificadoEmId || perfil.versao !== config.alvo.versao || hashReconciliacao(perfil) !== config.alvo.estadoSha256) falha("ESTADO_DIVERGENTE");
}

/** Somente grupos aprovados do livro de entrega. Não consulta nem altera pedidos. */
export function planejarEquivalencias(entrada: unknown, perfil: PerfilSaneamento): PreviaEquivalencias {
  const config = validarConfiguracaoEquivalencias(entrada); conferirAlvo(config, perfil);
  const originais = entregasDoCliente(perfil.entregaPadrao), selecionadoAntes = indiceEntregaCliente(perfil.entregaPadrao);
  if (!originais.length || originais.length > LIMITE_ENTREGAS_CLIENTE) falha("LIVRO_INVALIDO");
  const pendencias: PreviaEquivalencias["pendencias"] = [], grupos: DecisaoEquivalencia[] = [], substituicoes = new Map<number, { indices: number[]; valor: EntregaCliente; decisao: DecisaoEquivalencia }>(), absorvidos = new Set<number>();
  for (const g of config.grupos) {
    const indices = g.entradas.map(e => e.indice), entradas = g.entradas.map(e => { const atual = originais[e.indice]; if (!atual || hashReconciliacao(atual) !== e.sha256) falha("ENTRADA_DIVERGENTE"); return atual; });
    const manter = indices.includes(selecionadoAntes) ? selecionadoAntes : g.indiceManter, sobrevivente = json(originais[manter]), chaveLocal = chaveLocalEnderecoPostal(entradas[0].endereco), complementoAntes = sobrevivente.endereco.complemento ?? "", complementoDepois = g.complementoFinal ?? complementoAntes;
    if (!chaveLocal || entradas.some(e => chaveLocalEnderecoPostal(e.endereco) !== chaveLocal)) pendencias.push({ codigo: "LOCAIS_DIVERGENTES", grupoId: g.id });
    const fisicas = conferirUnidades(entradas, complementoDepois, g.permitirCodigosLojaComoReferencia);
    if (fisicas.codigo) pendencias.push({ codigo: fisicas.codigo, grupoId: g.id });
    sobrevivente.endereco.complemento = complementoDepois;
    try { validarEntregaPadraoCliente(sobrevivente); if (pendenciaEnderecoPostal(sobrevivente.endereco) || !sobrevivente.destinatario.nome.trim()) throw Error(); } catch { pendencias.push({ codigo: "SOBREVIVENTE_INVALIDO", grupoId: g.id }); }
    const decisao: DecisaoEquivalencia = { grupoId: g.id, indicesOriginais: indices, indiceManterSolicitado: g.indiceManter, indiceManterEfetivo: manter, indiceNovo: null, chaveLocal, complementoAntes, complementoDepois, motivo: g.motivo, permitirCodigosLojaComoReferencia: g.permitirCodigosLojaComoReferencia, unidades: fisicas.unidades };
    grupos.push(decisao); substituicoes.set(indices[0], { indices, valor: sobrevivente, decisao }); indices.slice(1).forEach(n => absorvidos.add(n));
  }
  const enderecos: EntregaCliente[] = [], mapa = new Map<number, number>();
  for (const [n, e] of originais.entries()) {
    if (absorvidos.has(n)) continue;
    const grupo = substituicoes.get(n), novo = enderecos.length;
    if (grupo) { grupo.indices.forEach(i => mapa.set(i, novo)); grupo.decisao.indiceNovo = novo; enderecos.push(grupo.valor); } else { mapa.set(n, novo); enderecos.push(json(e)); }
  }
  const selecionadoDepois = mapa.get(selecionadoAntes)!;
  const extras = Object.fromEntries(Object.entries(perfil.entregaPadrao ?? {}).filter(([k]) => !["destinatario", "endereco", "textoOriginal", "enderecos", "selecionado"].includes(k)));
  const entregaPadrao: EntregaPadraoCliente = { ...extras, ...enderecos[selecionadoDepois], enderecos, selecionado: selecionadoDepois }, campos = { entregaPadrao };
  const temAlteracoes = hashReconciliacao(perfil.entregaPadrao) !== hashReconciliacao(entregaPadrao);
  const corpo: Omit<PreviaEquivalencias, "token"> = { versao: 1, modo: MODO, operacaoId: config.operacaoId, configuracaoSha256: hashReconciliacao(config), aplicavel: !pendencias.length, temAlteracoes, pendencias, antes: json(perfil), depois: json({ ...perfil, ...campos, versao: perfil.versao + (temAlteracoes ? 1 : 0) }), campos, grupos,
    indices: [...mapa].sort(([a], [b]) => a - b).map(([indiceOriginal, indiceNovo]) => ({ indiceOriginal, indiceNovo })), selecionadoAntes, selecionadoDepois,
    contagens: { grupos: grupos.length, entregasAntes: originais.length, entregasDepois: enderecos.length, entregasUnificadas: originais.length - enderecos.length, complementosAlterados: grupos.filter(g => g.complementoAntes !== g.complementoDepois).length } };
  return { ...corpo, token: hashReconciliacao(corpo) };
}

export async function inspecionarFontesEquivalencias(clienteId: string, opcoes: Opcoes = {}) {
  const fonte = await inspecionarCadastroSaneamento(id(clienteId), opcoes), entregas = entregasDoCliente(fonte.perfil.entregaPadrao);
  return { perfil: fonte.perfil, estadoSha256: fonte.estadoSha256, entregas: entregas.map((entrega, indice) => ({ indice, sha256: hashReconciliacao(entrega), chaveLocal: chaveLocalEnderecoPostal(entrega.endereco) })), selecionado: indiceEntregaCliente(fonte.perfil.entregaPadrao) };
}
export async function prepararEquivalencias(entrada: unknown, opcoes: Opcoes = {}) { const config = validarConfiguracaoEquivalencias(entrada), { perfil } = await inspecionarFontesEquivalencias(config.alvo.id, opcoes); return planejarEquivalencias(config, perfil); }
function chave(config: ConfiguracaoEquivalencias, reversao = false) { return { origem_loja_entidade_chave: { origem: ORIGEM_RECONCILIACAO, loja: LOJA, entidade: ENTIDADE, chave: `equivalencias:${config.operacaoId}${reversao ? ":reversao" : ""}` } }; }
function autorizar(evidencia: EvidenciaReconciliacao) { if (process.env.CLIENTES_EQUIVALENCIAS_AUTORIZADAS !== "SIM") falha("NAO_AUTORIZADO"); const d = obj(evidencia); somente(d, ["aprovacaoSha256", "backupSha256", "artefatoSha256"]); hex(d.aprovacaoSha256); hex(d.backupSha256); hex(d.artefatoSha256); }
async function carregar(tx: Prisma.TransactionClient, clienteId: string) { const perfil = await tx.clienteVenda.findUnique({ where: { id: clienteId } }); if (!perfil || perfil.unificadoEmId) falha("ALVO_NAO_CANONICO"); return json(perfil) as unknown as PerfilSaneamento; }
async function travar(tx: Prisma.TransactionClient, config: ConfiguracaoEquivalencias) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sanear:${config.alvo.id}`}, 0))::text AS trava`; }
function conferirRegistro(config: ConfiguracaoEquivalencias, token: string, registro: { dadosOrigem: unknown }) { const d = obj(registro.dadosOrigem); if (d.modo !== MODO || d.configuracaoSha256 !== hashReconciliacao(config) || d.token !== token) falha("OPERACAO_DIVERGENTE"); return d; }
async function atualizar(tx: Prisma.TransactionClient, perfil: PerfilSaneamento, entregaPadrao: unknown, alterar: boolean) {
  if (alterar) { const r = await tx.clienteVenda.updateMany({ where: { id: perfil.id, versao: perfil.versao }, data: { entregaPadrao: entregaPadrao === null ? Prisma.DbNull : entregaPadrao as Prisma.InputJsonValue, versao: { increment: 1 } } }); if (r.count !== 1) falha("VERSAO_CONCORRENTE"); }
  return carregar(tx, perfil.id);
}
async function atividade(tx: Prisma.TransactionClient, config: ConfiguracaoEquivalencias, token: string, antes: number, depois: number, reversao: boolean) {
  await registrarAtividade(tx, { tipo: "SISTEMA", referencia: config.atorSistema }, { modulo: "cadastros", recurso: "clientes", acao: reversao ? "reverter_equivalencias_entregas" : "unificar_equivalencias_entregas", entidade: "CLIENTE", entidadeId: config.alvo.id,
    resumo: reversao ? "Unificação de entregas revertida por operação técnica auditada." : "Variações de entrega unificadas por operação técnica auditada.", categoria: "CRITICA", origem: "AUTOMACAO", correlacaoId: config.operacaoId, deduplicacao: `equivalencias-entregas:${reversao ? "reverter" : "aplicar"}:${token}`, antes: { versao: antes }, depois: { versao: depois } });
}
export async function aplicarEquivalencias(entrada: unknown, previa: PreviaEquivalencias, evidencia: EvidenciaReconciliacao, opcoes: Opcoes = {}) {
  autorizar(evidencia); const config = validarConfiguracaoEquivalencias(entrada), esperada = planejarEquivalencias(config, previa.antes); hex(previa.token);
  if (esperada.token !== previa.token || !esperada.aplicavel) falha("PREVIA_INVALIDA");
  return (opcoes.banco ?? prisma).$transaction(async tx => {
    await travar(tx, config); const existente = await tx.identidadeExternaVenda.findUnique({ where: chave(config) });
    if (existente) { conferirRegistro(config, esperada.token, existente); if (await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) })) falha("OPERACAO_REVERTIDA"); return { operacaoId: config.operacaoId, token: esperada.token, jaAplicado: true }; }
    const perfil = await carregar(tx, config.alvo.id), plano = planejarEquivalencias(config, perfil); if (plano.token !== esperada.token) falha("PREVIA_DIVERGENTE");
    const depois = await atualizar(tx, perfil, plano.campos.entregaPadrao, plano.temAlteracoes);
    await tx.identidadeExternaVenda.create({ data: { ...chave(config).origem_loja_entidade_chave, destinoId: perfil.id, resumoOrigem: plano.configuracaoSha256, versaoDestino: depois.versao,
      dadosOrigem: json({ versao: 1, modo: MODO, acao: "APLICAR", configuracao: config, configuracaoSha256: plano.configuracaoSha256, token: plano.token, previa: plano, antes: perfil, depois, evidencia, aplicadoEm: (opcoes.agora?.() ?? new Date()).toISOString() }) as Prisma.InputJsonValue } });
    await atividade(tx, config, plano.token, perfil.versao, depois.versao, false);
    return { operacaoId: config.operacaoId, token: plano.token, jaAplicado: false, contagens: plano.contagens };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
async function planoReversao(tx: Prisma.TransactionClient, config: ConfiguracaoEquivalencias) {
  if (await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) })) falha("OPERACAO_JA_REVERTIDA");
  const registro = await tx.identidadeExternaVenda.findUnique({ where: chave(config) }); if (!registro) falha("OPERACAO_AUSENTE");
  const d = obj(registro.dadosOrigem); if (d.modo !== MODO || d.configuracaoSha256 !== hashReconciliacao(config)) falha("OPERACAO_DIVERGENTE");
  const atual = await carregar(tx, config.alvo.id); if (hashReconciliacao(atual) !== hashReconciliacao(d.depois)) falha("REVERSAO_ESTADO_DIVERGENTE");
  const campos = { entregaPadrao: obj(d.antes).entregaPadrao }, temAlteracoes = hashReconciliacao(campos.entregaPadrao) !== hashReconciliacao(atual.entregaPadrao);
  const corpo = { versao: 1, modo: "REVERTER_ENTREGAS_EQUIVALENTES", operacaoId: config.operacaoId, configuracaoSha256: hashReconciliacao(config), antes: atual, campos, temAlteracoes, aplicacaoToken: d.token };
  return { ...corpo, token: hashReconciliacao(corpo) };
}
export async function prepararReversaoEquivalencias(entrada: unknown, opcoes: Opcoes = {}) { const config = validarConfiguracaoEquivalencias(entrada); return (opcoes.banco ?? prisma).$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return planoReversao(tx, config); }, { isolationLevel: "RepeatableRead", timeout: 30_000 }); }
export async function reverterEquivalencias(entrada: unknown, token: string, evidencia: EvidenciaReconciliacao, opcoes: Opcoes = {}) {
  autorizar(evidencia); const config = validarConfiguracaoEquivalencias(entrada); hex(token);
  return (opcoes.banco ?? prisma).$transaction(async tx => {
    await travar(tx, config); const existente = await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) }); if (existente) { conferirRegistro(config, token, existente); return { operacaoId: config.operacaoId, token, jaRevertido: true }; }
    const plano = await planoReversao(tx, config); if (plano.token !== token) falha("PREVIA_DIVERGENTE"); const depois = await atualizar(tx, plano.antes, plano.campos.entregaPadrao, plano.temAlteracoes);
    await tx.identidadeExternaVenda.create({ data: { ...chave(config, true).origem_loja_entidade_chave, destinoId: config.alvo.id, resumoOrigem: plano.configuracaoSha256, versaoDestino: depois.versao,
      dadosOrigem: json({ versao: 1, modo: MODO, acao: "REVERTER", configuracaoSha256: plano.configuracaoSha256, token, previa: plano, antes: plano.antes, depois, evidencia, revertidoEm: (opcoes.agora?.() ?? new Date()).toISOString() }) as Prisma.InputJsonValue } });
    await atividade(tx, config, token, plano.antes.versao, depois.versao, true); return { operacaoId: config.operacaoId, token, jaRevertido: false };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
