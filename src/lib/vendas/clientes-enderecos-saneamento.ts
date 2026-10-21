import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividades/registro";
import { consultarCnpjVenda, type FonteConsultaCnpjVenda } from "./cnpj";
import { cnpjNumericoValido } from "./clientes-identidade";
import { chaveEnderecoPostal, pendenciaEnderecoPostal } from "./cliente-enderecos";
import { cobrancasDoCliente, copiarEnderecoCobranca, LIMITE_COBRANCAS_CLIENTE } from "./cliente-cobranca";
import { entregasDoCliente, indiceEntregaCliente, LIMITE_ENTREGAS_CLIENTE } from "./cliente-entrega";
import { validarCliente, validarEntregaPadraoCliente, validarIdentidadeCobranca, validarLivroEnderecosClienteCompleto, type EnderecoVenda, type EntregaCliente, type EntregaPadraoCliente } from "./dominio";
import { hashReconciliacao, ORIGEM_RECONCILIACAO, type EvidenciaReconciliacao } from "./clientes-cobrancas-reconciliacao";

type Json = Record<string, unknown>;
export type PerfilSaneamento = Json & { id: string; versao: number; unificadoEmId: string | null; nome: string; tipo: "PF" | "PJ"; documento: string | null; razaoSocial: string | null; inscricaoEstadual: string | null; enderecos: EnderecoVenda[]; entregaPadrao: EntregaPadraoCliente | null; ativo: boolean };
export type ConfiguracaoSaneamento = { versao: 1; modo: "SANEAR_ENDERECOS"; operacaoId: string; revisaoCodigo: string; atorSistema: string;
  alvo: { id: string; versao: number; estadoSha256: string }; politicaIncompletos: "REMOVER"; copiarCobrancasParaEntrega: boolean };
export type ConsultaSaneamento = { cnpj: string; fonte: FonteConsultaCnpjVenda; consultadoEm: string; resultado: Awaited<ReturnType<typeof consultarCnpjVenda>>; resultadoSha256: string };
export type DecisaoSaneamento = { indiceOriginal: number; indiceNovo: number | null; acao: "MANTER" | "UNIFICAR_POSTAL" | "REMOVER_INCOMPLETO"; motivos: string[] };
export type PreviaSaneamento = { versao: 1; modo: "SANEAR_ENDERECOS"; operacaoId: string; configuracaoSha256: string; token: string; aplicavel: boolean; temAlteracoes: boolean;
  pendencias: { codigo: string; referencia: string }[]; consultas: ConsultaSaneamento[]; antes: PerfilSaneamento; campos: Json; depois: PerfilSaneamento;
  cobrancas: DecisaoSaneamento[]; entregas: DecisaoSaneamento[]; copiasCobranca: { indiceCobranca: number; indiceEntrega: number }[];
  contagens: { cobrancasAntes: number; cobrancasDepois: number; cobrancasIncompletas: number; cobrancasUnificadas: number; entregasAntes: number; entregasDepois: number; entregasIncompletas: number; entregasUnificadas: number; copiasIncluidas: number } };
type Banco = Pick<PrismaClient, "$transaction">;
type Opcoes = { banco?: Banco; consultar?: typeof consultarCnpjVenda; agora?: () => Date };
const ENTIDADE = "RECONCILIACAO_COBRANCAS", LOJA = "grazing-hub";
const obj = (v: unknown): Json => { if (!v || typeof v !== "object" || Array.isArray(v)) falha("OBJETO_INVALIDO"); return v as Json; };
function falha(c: string): never { throw Error(`SANEAMENTO_${c}`); }
function texto(v: unknown, max = 160) { if (typeof v !== "string" || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) falha("TEXTO_INVALIDO"); return v.trim(); }
function id(v: unknown, max = 120) { const s = texto(v, max); if (!/^[a-zA-Z0-9:_-]+$/.test(s)) falha("ID_INVALIDO"); return s; }
function hex(v: unknown) { if (typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v)) falha("HASH_INVALIDO"); return v; }
function json<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }
function somente(v: Json, campos: string[]) { if (Object.keys(v).some(k => !campos.includes(k))) falha("CAMPO_DESCONHECIDO"); }
const numeroDocumento = (v: unknown) => typeof v === "string" ? v.replace(/[.\s/-]/g, "") : "";
const comparar = (a: unknown, b: unknown) => hashReconciliacao(a).localeCompare(hashReconciliacao(b), "en");
export function validarConfiguracaoSaneamento(v: unknown): ConfiguracaoSaneamento {
  const d = obj(v), alvo = obj(d.alvo);
  somente(d, ["versao", "modo", "operacaoId", "revisaoCodigo", "atorSistema", "alvo", "politicaIncompletos", "copiarCobrancasParaEntrega"]); somente(alvo, ["id", "versao", "estadoSha256"]);
  if (d.versao !== 1 || d.modo !== "SANEAR_ENDERECOS" || d.politicaIncompletos !== "REMOVER" || typeof d.copiarCobrancasParaEntrega !== "boolean" || !Number.isSafeInteger(alvo.versao) || Number(alvo.versao) < 1) falha("CONFIGURACAO_INVALIDA");
  const revisaoCodigo = texto(d.revisaoCodigo, 64); if (!/^[a-f0-9]{40,64}$/.test(revisaoCodigo)) falha("REVISAO_INVALIDA");
  return { versao: 1, modo: "SANEAR_ENDERECOS", operacaoId: id(d.operacaoId), revisaoCodigo, atorSistema: id(d.atorSistema),
    alvo: { id: id(alvo.id), versao: Number(alvo.versao), estadoSha256: hex(alvo.estadoSha256) }, politicaIncompletos: "REMOVER", copiarCobrancasParaEntrega: d.copiarCobrancasParaEntrega };
}
function conferirAlvo(config: ConfiguracaoSaneamento, perfil: PerfilSaneamento) {
  if (perfil.id !== config.alvo.id || perfil.unificadoEmId || perfil.versao !== config.alvo.versao || hashReconciliacao(perfil) !== config.alvo.estadoSha256) falha("ESTADO_DIVERGENTE");
  if (!["PF", "PJ"].includes(perfil.tipo) || !Array.isArray(perfil.enderecos)) falha("CADASTRO_INVALIDO");
}
function cobrancasAtuais(perfil: PerfilSaneamento) { return cobrancasDoCliente(perfil); }
function cnpjsDoPerfil(perfil: PerfilSaneamento) {
  return [...new Set(cobrancasAtuais(perfil).filter(e => e.tipo === "PJ" && cnpjNumericoValido(numeroDocumento(e.documento))).map(e => numeroDocumento(e.documento)))].sort();
}
async function consultarPerfil(perfil: PerfilSaneamento, opcoes: Opcoes): Promise<ConsultaSaneamento[]> {
  const provas: ConsultaSaneamento[] = [];
  for (const cnpj of cnpjsDoPerfil(perfil)) {
    const resultado = await (opcoes.consultar ?? consultarCnpjVenda)(cnpj);
    const fonte = fonteConsulta(resultado);
    provas.push({ cnpj, fonte, consultadoEm: (opcoes.agora?.() ?? new Date()).toISOString(), resultado: json(resultado), resultadoSha256: hashReconciliacao({ fonte, resultado }) });
  }
  return provas;
}
function fonteConsulta(resultado: ConsultaSaneamento["resultado"]): FonteConsultaCnpjVenda {
  // Compatibilidade com provas sintéticas/legadas; o serviço identifica todo cadastro público válido.
  const fonte = resultado.fonte ?? "BRASILAPI_CNPJ_V1";
  if (!["BRASILAPI_CNPJ_V1", "MINHA_RECEITA_CNPJ_V1"].includes(fonte)) falha("FONTE_CONSULTA_INVALIDA");
  return fonte;
}
function validarConsultas(perfil: PerfilSaneamento, consultas: ConsultaSaneamento[]) {
  const documentos = cnpjsDoPerfil(perfil);
  if (!Array.isArray(consultas) || consultas.length !== documentos.length || new Set(consultas.map(c => c.cnpj)).size !== consultas.length || consultas.some(c => !documentos.includes(c.cnpj) || !["BRASILAPI_CNPJ_V1", "MINHA_RECEITA_CNPJ_V1"].includes(c.fonte) || c.fonte !== fonteConsulta(c.resultado) || !Number.isFinite(Date.parse(c.consultadoEm)) || hashReconciliacao({ fonte: c.fonte, resultado: c.resultado }) !== c.resultadoSha256)) falha("CONSULTAS_DIVERGENTES");
}
function motivosCobranca(e: EnderecoVenda) {
  const motivos: string[] = [], postal = pendenciaEnderecoPostal(e);
  if (postal) motivos.push(postal);
  if (e.tipo === "PJ" && !cnpjNumericoValido(numeroDocumento(e.documento))) motivos.push("CNPJ não comprovado ou inválido.");
  try { validarIdentidadeCobranca(e, true); } catch { motivos.push("Titular de cobrança incompleto ou inválido."); }
  return motivos;
}
function motivoEntrega(e: EntregaCliente) { const postal = pendenciaEnderecoPostal(e.endereco); return [...(postal ? [postal] : []), ...(!e.destinatario.nome.trim() ? ["Destinatário não informado."] : [])]; }
type Candidato<T> = { original: number; valor: T; chave: string; prioridade: number[] };
function ordenar<T>(a: Candidato<T>, b: Candidato<T>) {
  for (let i = 0; i < a.prioridade.length; i++) if (a.prioridade[i] !== b.prioridade[i]) return a.prioridade[i] - b.prioridade[i];
  return comparar(a.valor, b.valor) || a.original - b.original;
}
function selecionar<T>(candidatos: Candidato<T>[], decisoes: DecisaoSaneamento[]) {
  const escolhidos: Candidato<T>[] = [], porChave = new Map<string, number>();
  for (const c of [...candidatos].sort(ordenar)) {
    const existente = porChave.get(c.chave), indice = existente ?? escolhidos.length;
    if (existente === undefined) { escolhidos.push(c); porChave.set(c.chave, indice); }
    if (c.original >= 0) decisoes.push({ indiceOriginal: c.original, indiceNovo: indice, acao: existente === undefined ? "MANTER" : "UNIFICAR_POSTAL", motivos: [] });
  }
  return { escolhidos, porChave };
}
/** Apenas livros atuais e respostas públicas. Não lê nem altera pedidos ou provas históricas. */
export function planejarSaneamento(configuracao: unknown, perfil: PerfilSaneamento, consultas: ConsultaSaneamento[]): PreviaSaneamento {
  const config = validarConfiguracaoSaneamento(configuracao); conferirAlvo(config, perfil); validarConsultas(perfil, consultas);
  const pendencias: PreviaSaneamento["pendencias"] = [];
  for (const c of consultas) if (c.resultado.erro || !c.resultado.cadastro) pendencias.push({ codigo: "CONSULTA_CNPJ_INDISPONIVEL", referencia: c.cnpj });
  const cobrancas: DecisaoSaneamento[] = [], entregas: DecisaoSaneamento[] = [], candidatos: Candidato<EnderecoVenda>[] = [];
  const atuais = cobrancasAtuais(perfil);
  if (!atuais.length) pendencias.push({ codigo: "PRINCIPAL_AUSENTE", referencia: perfil.id });
  for (const [indice, anterior] of atuais.entries()) {
    let e = json({ ...anterior, pais: anterior.pais ?? "Brasil" }), oficial = false;
    const cnpj = numeroDocumento(e.documento), prova = e.tipo === "PJ" ? consultas.find(c => c.cnpj === cnpj) : null;
    if (prova?.resultado.cadastro) { e = { ...e, ...prova.resultado.cadastro.endereco, documento: cnpj, razaoSocial: prova.resultado.cadastro.razaoSocial, titularPendente: false }; oficial = true; }
    const motivos = motivosCobranca(e);
    if (motivos.length) {
      cobrancas.push({ indiceOriginal: indice, indiceNovo: null, acao: "REMOVER_INCOMPLETO", motivos });
      if (indice === 0) pendencias.push({ codigo: "PRINCIPAL_INCOMPLETA", referencia: perfil.id });
    } else candidatos.push({ original: indice, valor: e, chave: chaveEnderecoPostal(e)!, prioridade: [indice === 0 ? 0 : 1, oficial ? 0 : 1, e.documento ? 0 : 1] });
  }
  const cobrancasSelecionadas = selecionar(candidatos, cobrancas), enderecos = cobrancasSelecionadas.escolhidos.map((c, indice) => ({ ...c.valor, nome: indice === 0 ? "Principal" : `Cobrança ${indice + 1}` }));
  // Não promover outra empresa para a Principal nem modificar a identidade geral.
  if (cobrancasSelecionadas.escolhidos[0]?.original !== 0) pendencias.push({ codigo: "PRINCIPAL_NAO_PRESERVADA", referencia: perfil.id });
  const oficiais = new Map(candidatos.filter(c => c.valor.tipo === "PJ" && consultas.some(p => p.cnpj === c.valor.documento && p.resultado.cadastro)).sort(ordenar).map(c => [c.chave, copiarEnderecoCobranca(c.valor)] as const).reverse());
  const anterioresEntrega = entregasDoCliente(perfil.entregaPadrao), selecionadoAntes = indiceEntregaCliente(perfil.entregaPadrao), candidatosEntrega: Candidato<EntregaCliente>[] = [];
  for (const [indice, anterior] of anterioresEntrega.entries()) {
    let e: EntregaCliente | null;
    try { e = validarEntregaPadraoCliente(anterior); } catch { e = null; }
    const motivos = e ? motivoEntrega(e) : ["Entrega inválida."];
    if (!e || motivos.length) { entregas.push({ indiceOriginal: indice, indiceNovo: null, acao: "REMOVER_INCOMPLETO", motivos }); continue; }
    const chave = chaveEnderecoPostal(e.endereco)!, postalOficial = oficiais.get(chave);
    const opcao = postalOficial ? { ...e, endereco: postalOficial } : e;
    candidatosEntrega.push({ original: indice, valor: opcao, chave, prioridade: [indice === 0 ? 0 : 1, postalOficial ? 0 : 1, opcao.destinatario.contato ? 0 : 1] });
  }
  const entregasSelecionadas = selecionar(candidatosEntrega, entregas), opcoesEntrega = entregasSelecionadas.escolhidos.map(c => c.valor), copiasCobranca: PreviaSaneamento["copiasCobranca"] = [];
  if (config.copiarCobrancasParaEntrega) for (const [indiceCobranca, e] of enderecos.entries()) {
    const chave = chaveEnderecoPostal(e)!;
    if (entregasSelecionadas.porChave.has(chave)) continue;
    const copia = { destinatario: { nome: e.destinatario?.trim() || (e.tipo === "PJ" ? e.razaoSocial : e.nomeCompleto) || "", contato: "" }, endereco: copiarEnderecoCobranca(e) };
    if (motivoEntrega(copia).length) { pendencias.push({ codigo: "COPIA_COBRANCA_INCOMPLETA", referencia: String(indiceCobranca) }); continue; }
    entregasSelecionadas.porChave.set(chave, opcoesEntrega.length); copiasCobranca.push({ indiceCobranca, indiceEntrega: opcoesEntrega.length }); opcoesEntrega.push(copia);
  }
  const selecionado = entregas.find(e => e.indiceOriginal === selecionadoAntes)?.indiceNovo ?? 0;
  const entregaPadrao = opcoesEntrega.length ? { ...opcoesEntrega[selecionado], enderecos: opcoesEntrega, selecionado } : null;
  if (enderecos.length > LIMITE_COBRANCAS_CLIENTE || opcoesEntrega.length > LIMITE_ENTREGAS_CLIENTE) pendencias.push({ codigo: "LIMITE_ENDERECOS_EXCEDIDO", referencia: perfil.id });
  const campos: Json = { enderecos, entregaPadrao, ...(perfil.tipo === "PJ" && enderecos[0]?.razaoSocial ? { razaoSocial: enderecos[0].razaoSocial } : {}) };
  if (!pendencias.length) {
    try { const validado = validarCliente({ id: perfil.id, versao: perfil.versao, nome: perfil.nome, tipo: perfil.tipo, documento: perfil.documento, razaoSocial: campos.razaoSocial ?? perfil.razaoSocial, inscricaoEstadual: perfil.inscricaoEstadual, email: null, telefone: null, contato: null, observacoes: null, ativo: perfil.ativo, ...campos }); validarLivroEnderecosClienteCompleto(validado); }
    catch { pendencias.push({ codigo: "CADASTRO_FINAL_INVALIDO", referencia: perfil.id }); }
  }
  const temAlteracoes = Object.entries(campos).some(([k, v]) => hashReconciliacao(v) !== hashReconciliacao(perfil[k]));
  const corpo = { versao: 1 as const, modo: "SANEAR_ENDERECOS" as const, operacaoId: config.operacaoId, configuracaoSha256: hashReconciliacao(config), aplicavel: !pendencias.length, temAlteracoes, pendencias,
    consultas: json(consultas), antes: json(perfil), campos, depois: json({ ...perfil, ...campos, versao: perfil.versao + (temAlteracoes ? 1 : 0) }), cobrancas: cobrancas.sort((a, b) => a.indiceOriginal - b.indiceOriginal), entregas: entregas.sort((a, b) => a.indiceOriginal - b.indiceOriginal), copiasCobranca,
    contagens: { cobrancasAntes: atuais.length, cobrancasDepois: enderecos.length, cobrancasIncompletas: cobrancas.filter(d => d.acao === "REMOVER_INCOMPLETO").length, cobrancasUnificadas: cobrancas.filter(d => d.acao === "UNIFICAR_POSTAL").length, entregasAntes: anterioresEntrega.length, entregasDepois: opcoesEntrega.length, entregasIncompletas: entregas.filter(d => d.acao === "REMOVER_INCOMPLETO").length, entregasUnificadas: entregas.filter(d => d.acao === "UNIFICAR_POSTAL").length, copiasIncluidas: copiasCobranca.length } };
  return { ...corpo, token: hashReconciliacao(corpo) };
}
async function carregar(tx: Prisma.TransactionClient, clienteId: string): Promise<PerfilSaneamento> {
  const perfil = await tx.clienteVenda.findUnique({ where: { id: clienteId } }); if (!perfil || perfil.unificadoEmId) falha("ALVO_NAO_CANONICO"); return json(perfil) as unknown as PerfilSaneamento;
}
export async function inspecionarCadastroSaneamento(clienteId: string, opcoes: Opcoes = {}) {
  id(clienteId);
  return (opcoes.banco ?? prisma).$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; const perfil = await carregar(tx, clienteId); return { perfil, estadoSha256: hashReconciliacao(perfil), cnpjs: cnpjsDoPerfil(perfil) }; }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}
export async function prepararSaneamento(configuracao: unknown, opcoes: Opcoes = {}) {
  const config = validarConfiguracaoSaneamento(configuracao), { perfil } = await inspecionarCadastroSaneamento(config.alvo.id, opcoes); conferirAlvo(config, perfil);
  const consultas = await consultarPerfil(perfil, opcoes); // A transação de leitura já terminou.
  return planejarSaneamento(config, perfil, consultas);
}
function chave(config: ConfiguracaoSaneamento, reversao = false) { return { origem_loja_entidade_chave: { origem: ORIGEM_RECONCILIACAO, loja: LOJA, entidade: ENTIDADE, chave: `sanear:${config.operacaoId}${reversao ? ":reversao" : ""}` } }; }
function autorizar() { if (process.env.CLIENTES_SANEAMENTO_AUTORIZADO !== "SIM") falha("NAO_AUTORIZADO"); }
function conferirEvidencia(v: EvidenciaReconciliacao) { const d = obj(v); somente(d, ["aprovacaoSha256", "backupSha256", "artefatoSha256"]); for (const k of ["aprovacaoSha256", "backupSha256", "artefatoSha256"]) hex(d[k]); }
async function travar(tx: Prisma.TransactionClient, config: ConfiguracaoSaneamento) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sanear:${config.alvo.id}`}, 0))::text AS trava`; }
function conferirRegistro(config: ConfiguracaoSaneamento, token: string, registro: { dadosOrigem: unknown }) { const d = obj(registro.dadosOrigem); if (d.modo !== "SANEAR_ENDERECOS" || d.configuracaoSha256 !== hashReconciliacao(config) || d.token !== token) falha("OPERACAO_DIVERGENTE"); return d; }
async function atividade(tx: Prisma.TransactionClient, config: ConfiguracaoSaneamento, token: string, antes: number, depois: number, reversao = false) {
  await registrarAtividade(tx, { tipo: "SISTEMA", referencia: config.atorSistema }, { modulo: "cadastros", recurso: "clientes", acao: reversao ? "reverter_saneamento_enderecos" : "sanear_enderecos", entidade: "CLIENTE", entidadeId: config.alvo.id,
    resumo: reversao ? "Saneamento do cadastro revertido por operação técnica auditada." : "Endereços cadastrais saneados por operação técnica auditada.", categoria: "CRITICA", origem: "AUTOMACAO", correlacaoId: config.operacaoId,
    deduplicacao: `sanear-enderecos:${reversao ? "reversao" : "aplicar"}:${token}`, antes: { versao: antes }, depois: { versao: depois } });
}
async function atualizar(tx: Prisma.TransactionClient, perfil: PerfilSaneamento, campos: Json, alterar: boolean) {
  if (alterar) {
    const dados = { ...campos, ...(Object.hasOwn(campos, "entregaPadrao") ? { entregaPadrao: campos.entregaPadrao === null ? Prisma.DbNull : campos.entregaPadrao } : {}) };
    const r = await tx.clienteVenda.updateMany({ where: { id: perfil.id, versao: perfil.versao }, data: { ...dados, versao: { increment: 1 } } as Prisma.ClienteVendaUpdateManyMutationInput });
    if (r.count !== 1) falha("VERSAO_CONCORRENTE");
  }
  return carregar(tx, perfil.id);
}
export async function aplicarSaneamento(configuracao: unknown, previaEntrada: PreviaSaneamento, evidencia: EvidenciaReconciliacao, opcoes: Opcoes = {}) {
  autorizar(); const config = validarConfiguracaoSaneamento(configuracao); hex(previaEntrada.token); conferirEvidencia(evidencia);
  const esperada = planejarSaneamento(config, previaEntrada.antes, previaEntrada.consultas);
  if (esperada.token !== previaEntrada.token || !esperada.aplicavel) falha("PREVIA_INVALIDA");
  const banco = opcoes.banco ?? prisma;
  const existente = await banco.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; const registro = await tx.identidadeExternaVenda.findUnique({ where: chave(config) }); if (registro && await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) })) falha("OPERACAO_REVERTIDA"); return registro; });
  if (existente) { conferirRegistro(config, esperada.token, existente); return { operacaoId: config.operacaoId, jaAplicado: true, token: esperada.token }; }
  const atuais = await consultarPerfil(esperada.antes, opcoes); // Rede fora da transação de escrita.
  if (atuais.some(c => c.resultado.erro || !c.resultado.cadastro) || atuais.some(c => c.resultadoSha256 !== esperada.consultas.find(p => p.cnpj === c.cnpj)?.resultadoSha256)) falha("CONSULTA_PUBLICA_DIVERGENTE");
  return banco.$transaction(async tx => {
    await travar(tx, config);
    const aplicado = await tx.identidadeExternaVenda.findUnique({ where: chave(config) });
    if (aplicado) { conferirRegistro(config, esperada.token, aplicado); if (await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) })) falha("OPERACAO_REVERTIDA"); return { operacaoId: config.operacaoId, jaAplicado: true, token: esperada.token }; }
    const perfil = await carregar(tx, config.alvo.id), plano = planejarSaneamento(config, perfil, esperada.consultas);
    if (plano.token !== esperada.token) falha("PREVIA_DIVERGENTE");
    const depois = await atualizar(tx, perfil, plano.campos, plano.temAlteracoes);
    await tx.identidadeExternaVenda.create({ data: { ...chave(config).origem_loja_entidade_chave, destinoId: perfil.id, resumoOrigem: plano.configuracaoSha256, versaoDestino: depois.versao,
      dadosOrigem: json({ versao: 1, modo: "SANEAR_ENDERECOS", acao: "APLICAR", configuracao: config, configuracaoSha256: plano.configuracaoSha256, token: plano.token, previa: plano, antes: perfil, depois, consultasRevalidadas: atuais, evidencia, aplicadoEm: (opcoes.agora?.() ?? new Date()).toISOString() }) as Prisma.InputJsonValue } });
    await atividade(tx, config, plano.token, perfil.versao, depois.versao);
    return { operacaoId: config.operacaoId, jaAplicado: false, token: plano.token, contagens: plano.contagens };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
async function planoReversao(tx: Prisma.TransactionClient, config: ConfiguracaoSaneamento) {
  if (await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) })) falha("OPERACAO_JA_REVERTIDA");
  const registro = await tx.identidadeExternaVenda.findUnique({ where: chave(config) }); if (!registro) falha("OPERACAO_AUSENTE");
  const d = obj(registro.dadosOrigem);
  if (d.modo !== "SANEAR_ENDERECOS" || d.configuracaoSha256 !== hashReconciliacao(config)) falha("OPERACAO_DIVERGENTE");
  const atual = await carregar(tx, config.alvo.id); if (hashReconciliacao(atual) !== hashReconciliacao(d.depois)) falha("REVERSAO_ESTADO_DIVERGENTE");
  const anterior = obj(d.antes), camposAplicados = obj(obj(d.previa).campos), campos = Object.fromEntries(Object.keys(camposAplicados).map(k => [k, anterior[k]]));
  const temAlteracoes = Object.entries(campos).some(([k, v]) => hashReconciliacao(v) !== hashReconciliacao(atual[k]));
  const corpo = { versao: 1, modo: "REVERTER_SANEAMENTO_ENDERECOS", operacaoId: config.operacaoId, configuracaoSha256: hashReconciliacao(config), antes: atual, campos, temAlteracoes, aplicacaoToken: d.token };
  return { ...corpo, token: hashReconciliacao(corpo) };
}
export async function prepararReversaoSaneamento(configuracao: unknown, opcoes: Opcoes = {}) {
  const config = validarConfiguracaoSaneamento(configuracao);
  return (opcoes.banco ?? prisma).$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return planoReversao(tx, config); }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}
export async function reverterSaneamento(configuracao: unknown, token: string, evidencia: EvidenciaReconciliacao, opcoes: Opcoes = {}) {
  autorizar(); const config = validarConfiguracaoSaneamento(configuracao); hex(token); conferirEvidencia(evidencia);
  return (opcoes.banco ?? prisma).$transaction(async tx => {
    await travar(tx, config);
    const existente = await tx.identidadeExternaVenda.findUnique({ where: chave(config, true) });
    if (existente) { conferirRegistro(config, token, existente); return { operacaoId: config.operacaoId, jaRevertido: true, token }; }
    const plano = await planoReversao(tx, config); if (plano.token !== token) falha("PREVIA_DIVERGENTE");
    const depois = await atualizar(tx, plano.antes, plano.campos, plano.temAlteracoes);
    await tx.identidadeExternaVenda.create({ data: { ...chave(config, true).origem_loja_entidade_chave, destinoId: config.alvo.id, resumoOrigem: plano.configuracaoSha256, versaoDestino: depois.versao,
      dadosOrigem: json({ versao: 1, modo: "SANEAR_ENDERECOS", acao: "REVERTER", configuracaoSha256: plano.configuracaoSha256, token, previa: plano, antes: plano.antes, depois, evidencia, revertidoEm: (opcoes.agora?.() ?? new Date()).toISOString() }) as Prisma.InputJsonValue } });
    await atividade(tx, config, token, plano.antes.versao, depois.versao, true);
    return { operacaoId: config.operacaoId, jaRevertido: false, token };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
