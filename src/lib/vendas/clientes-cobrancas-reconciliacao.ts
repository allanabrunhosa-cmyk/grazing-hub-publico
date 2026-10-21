import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividades/registro";
import { normalizarEmailCliente } from "./cliente-identificadores";
import { conferirIdentidadeCliente, resolverClienteCanonico } from "./clientes-unicidade";
import { copiarEnderecoCobranca, LIMITE_COBRANCAS_CLIENTE } from "./cliente-cobranca";
import { LIMITE_ENTREGAS_CLIENTE } from "./cliente-entrega";
import { validarCliente, validarEntregaPadraoCliente, type EnderecoVenda, type EntregaPadraoCliente } from "./dominio";
import { hashCanonico } from "./historico-dominio";

/** Manutenção dirigida por configuração privada. Não modifica pedidos nem fontes originais. */
export const ORIGEM_RECONCILIACAO = "MANUTENCAO_CLIENTES_V1";
const ENTIDADE = "RECONCILIACAO_COBRANCAS", LOJA = "grazing-hub";
type Json = Record<string, unknown>;
type Entrega = Pick<EntregaPadraoCliente, "destinatario" | "endereco"> & { textoOriginal?: string };
type Perfil = Json & { id: string; versao: number; unificadoEmId: string | null; nome: string; tipo: string; documento: string | null; email: string | null; enderecos: unknown; entregaPadrao: unknown };
export type FonteReconciliacao = { tipo: "PEDIDO" | "IDENTIDADE_EXTERNA" | "HISTORICO_PEDIDO" | "CONTATO_CLIENTE"; id: string; pedidoId: string; pedidoIds?: string[]; sha256: string; dados: Json };
type ProvaIdentidade = { tipo: "PERFIL" | "HISTORICO_PEDIDO" | "CONTATO_CLIENTE"; id: string; sha256: string; caminho: string };
export type MapeamentoReconciliacao = { tipo: "PEDIDO" | "IDENTIDADE_EXTERNA"; id: string; sha256: string; caminho: string; cobranca?: EnderecoVenda; entrega?: Entrega; provaIdentidade?: ProvaIdentidade };
export type ConfiguracaoReconciliacao = {
  versao: 1; operacaoId: string; revisaoCodigo: string; atorSistema: string;
  alvo: { id: string; email: string; versao: number };
  nomeCliente: string; principal: EnderecoVenda;
  mapeamentos: MapeamentoReconciliacao[];
  politicaTitularSemProva?: "MANTER_PENDENTE";
  copiarCobrancasParaEntrega: boolean;
  reservaPrincipal?: { aliasId: string; versao: number; sha256: string; titularComprovado: EnderecoVenda };
};
type Alteracao = { id: string; versao: number; antes: Perfil; depois: Perfil; campos: Json };
export type PreviaReconciliacao = {
  versao: 1; operacaoId: string; configuracaoSha256: string; token: string; aplicavel: boolean;
  pendencias: { codigo: string; referencia: string }[]; fontes: FonteReconciliacao[];
  alteracoes: Alteracao[]; contagens: { pedidos: number; cobrancas: number; entregas: number; pedidosTitularPendente: number; cobrancasTitularPendente: number };
};
export type EvidenciaReconciliacao = { aprovacaoSha256: string; backupSha256: string; artefatoSha256: string };
type Banco = Pick<PrismaClient, "$transaction">;
function falha(codigo: string): never { throw Error(`RECONCILIACAO_${codigo}`); }
function obj(v: unknown): Json { if (!v || typeof v !== "object" || Array.isArray(v)) falha("OBJETO_INVALIDO"); return v as Json; }
function lista(v: unknown, max = 10_000): unknown[] { if (!Array.isArray(v) || v.length > max) falha("LISTA_INVALIDA"); return v; }
function texto(v: unknown, max = 160): string { if (typeof v !== "string" || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) falha("TEXTO_INVALIDO"); return v.trim(); }
function identificador(v: unknown): string { const s = texto(v); if (!/^[a-zA-Z0-9:_-]+$/.test(s)) falha("IDENTIFICADOR_INVALIDO"); return s; }
function hex(v: unknown): string { if (typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v)) falha("HASH_INVALIDO"); return v; }
function inteiro(v: unknown): number { if (!Number.isSafeInteger(v) || Number(v) < 1) falha("VERSAO_INVALIDA"); return Number(v); }
function json<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }
export function hashReconciliacao(v: unknown): string { return hashCanonico(json(v)); }
function somente(d: Json, campos: string[]) { if (Object.keys(d).some(k => !campos.includes(k))) falha("CAMPO_DESCONHECIDO"); }

function cobranca(v: unknown, principalReferencia?: EnderecoVenda): EnderecoVenda {
  const e = obj(v);
  if (e.tipo !== "PF" && e.tipo !== "PJ") falha("IDENTIDADE_COBRANCA_AUSENTE");
  const pendente = e.titularPendente === true;
  if (pendente && (!principalReferencia || e.tipo !== "PJ" || e.documento || e.razaoSocial || e.nomeCompleto || e.inscricaoEstadual || e.inscricaoMunicipal)) falha("TITULAR_PENDENTE_INVALIDO");
  const referencia = pendente ? principalReferencia! : e;
  const c = validarCliente({ id: "", versao: 0, nome: referencia.tipo === "PF" ? referencia.nomeCompleto : referencia.razaoSocial,
    tipo: referencia.tipo, documento: referencia.documento, razaoSocial: referencia.razaoSocial, inscricaoEstadual: referencia.inscricaoEstadual,
    email: null, telefone: null, contato: null, observacoes: null, ativo: true,
    enderecos: [...(pendente ? [principalReferencia] : []), { ...e, nome: pendente ? "Cobrança pendente" : "Principal" }] });
  const endereco = c.enderecos[pendente ? 1 : 0];
  if (!pendente && !endereco.documento || !endereco.cep || !endereco.uf) falha("COBRANCA_INCOMPLETA");
  return endereco;
}
function entrega(v: unknown): Entrega {
  const d = obj(v);
  if (d.textoOriginal !== undefined && (typeof d.textoOriginal !== "string" || d.textoOriginal.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(d.textoOriginal))) falha("ENTREGA_TEXTO_INVALIDO");
  const textoOriginal = typeof d.textoOriginal === "string" && d.textoOriginal.trim() ? d.textoOriginal : undefined;
  const validada = validarEntregaPadraoCliente({ destinatario: d.destinatario, endereco: d.endereco, ...(textoOriginal ? { textoOriginal } : {}) });
  if (!validada || !textoOriginal && !Object.entries(validada.endereco).some(([k, v]) => k !== "pais" && !!v)) falha("ENTREGA_SEM_ENDERECO");
  return { destinatario: validada.destinatario, endereco: validada.endereco, ...(textoOriginal ? { textoOriginal } : {}) };
}
export function validarConfiguracaoReconciliacao(v: unknown): ConfiguracaoReconciliacao {
  const d = obj(v); somente(d, ["versao", "operacaoId", "revisaoCodigo", "atorSistema", "alvo", "nomeCliente", "principal", "mapeamentos", "politicaTitularSemProva", "copiarCobrancasParaEntrega", "reservaPrincipal"]);
  const a = obj(d.alvo); somente(a, ["id", "email", "versao"]);
  if (d.versao !== 1 || typeof d.copiarCobrancasParaEntrega !== "boolean") falha("CONFIGURACAO_INVALIDA");
  if (d.politicaTitularSemProva !== undefined && d.politicaTitularSemProva !== "MANTER_PENDENTE") falha("POLITICA_TITULAR_INVALIDA");
  const principal = cobranca(d.principal);
  const email = normalizarEmailCliente(texto(a.email, 254));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falha("EMAIL_INVALIDO");
  const mapeamentos = lista(d.mapeamentos).map(v => {
    const m = obj(v); somente(m, ["tipo", "id", "sha256", "caminho", "cobranca", "entrega", "provaIdentidade"]);
    if (!["PEDIDO", "IDENTIDADE_EXTERNA"].includes(String(m.tipo)) || !!m.cobranca === !!m.entrega) falha("MAPEAMENTO_INVALIDO");
    if (m.cobranca && obj(m.cobranca).titularPendente === true && (d.politicaTitularSemProva !== "MANTER_PENDENTE" || m.provaIdentidade)) falha("POLITICA_TITULAR_PENDENTE_EXIGIDA");
    const caminho = texto(m.caminho, 1000); if (!caminho.startsWith("/") || /~(?![01])/u.test(caminho)) falha("CAMINHO_INVALIDO");
    let provaIdentidade: ProvaIdentidade | undefined;
    if (m.provaIdentidade) {
      const p = obj(m.provaIdentidade); somente(p, ["tipo", "id", "sha256", "caminho"]);
      if (!m.cobranca || !["PERFIL", "HISTORICO_PEDIDO", "CONTATO_CLIENTE"].includes(String(p.tipo))) falha("PROVA_IDENTIDADE_INVALIDA");
      provaIdentidade = { tipo: p.tipo as ProvaIdentidade["tipo"], id: identificador(p.id), sha256: hex(p.sha256), caminho: texto(p.caminho, 1000) };
    }
    return { tipo: m.tipo as MapeamentoReconciliacao["tipo"], id: identificador(m.id), sha256: hex(m.sha256), caminho,
      ...(m.cobranca ? { cobranca: cobranca(m.cobranca, principal) } : { entrega: entrega(m.entrega) }), ...(provaIdentidade ? { provaIdentidade } : {}) };
  });
  let reservaPrincipal: ConfiguracaoReconciliacao["reservaPrincipal"];
  if (d.reservaPrincipal) { const r = obj(d.reservaPrincipal); somente(r, ["aliasId", "versao", "sha256", "titularComprovado"]); reservaPrincipal = { aliasId: identificador(r.aliasId), versao: inteiro(r.versao), sha256: hex(r.sha256), titularComprovado: cobranca(r.titularComprovado) }; }
  const revisaoCodigo = texto(d.revisaoCodigo, 64); if (!/^[a-f0-9]{40,64}$/.test(revisaoCodigo)) falha("REVISAO_INVALIDA");
  return { versao: 1, operacaoId: identificador(d.operacaoId), revisaoCodigo, atorSistema: texto(d.atorSistema, 120),
    alvo: { id: identificador(a.id), email, versao: inteiro(a.versao) }, nomeCliente: texto(d.nomeCliente),
    principal, mapeamentos, copiarCobrancasParaEntrega: d.copiarCobrancasParaEntrega,
    ...(d.politicaTitularSemProva ? { politicaTitularSemProva: d.politicaTitularSemProva } : {}),
    ...(reservaPrincipal ? { reservaPrincipal } : {}) };
}
/** Ignora caixa e espaços repetidos; conserva pontuação, número, complemento e identidade. */
function normal(v: unknown) { return String(v ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR"); }
function chavePostal(e: Json) { return ["pais", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"].map(k => k === "cep" ? normal(e[k]).replace(/[ -]/g, "") : normal(e[k])); }
function chaveCobranca(e: EnderecoVenda) { return hashReconciliacao([e.tipo, e.documento, obj(e).titularPendente === true, ...chavePostal(e)]); }
function chaveEntrega(e: Entrega) { return hashReconciliacao([...chavePostal(e.endereco), normal(e.destinatario.nome), normal(e.destinatario.contato), e.textoOriginal ?? ""]); }
function ponteiro(dados: unknown, caminho: string): unknown {
  let atual = dados;
  for (const parte of caminho.slice(1).split("/").map(v => v.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (!atual || typeof atual !== "object" || !Object.hasOwn(atual, parte)) falha("PROVA_CAMINHO_AUSENTE");
    atual = (atual as Json)[parte];
  }
  if (atual === null || atual === "" || Array.isArray(atual) && !atual.length) falha("PROVA_VAZIA");
  return atual;
}
function camposRaiz(config: ConfiguracaoReconciliacao, enderecos: EnderecoVenda[], entregaPadrao: unknown): Json {
  return { nome: config.nomeCliente, tipo: config.principal.tipo, documento: config.principal.documento,
    razaoSocial: config.principal.tipo === "PJ" ? config.principal.razaoSocial : null,
    inscricaoEstadual: config.principal.tipo === "PJ" ? config.principal.inscricaoEstadual || null : null,
    enderecos, entregaPadrao };
}
function titularDaProva(m: MapeamentoReconciliacao, fonte: FonteReconciliacao, fontes: FonteReconciliacao[], perfis: Perfil[]) {
  const p = m.provaIdentidade;
  if (!p) {
    const origem = fonte.tipo === "IDENTIDADE_EXTERNA" ? obj(fonte.dados.dadosOrigem) : null, hub = origem?.hub ? obj(origem.hub) : null;
    return hub?.clienteId ? perfis.find(c => c.id === hub.clienteId) : null;
  }
  if (p.tipo === "PERFIL") {
    const titular = perfis.find(c => c.id === p.id);
    if (!titular || hashReconciliacao(titular) !== p.sha256 || !["/documento", "/enderecos/0/documento"].includes(p.caminho)) falha("PROVA_IDENTIDADE_DIVERGENTE");
    ponteiro(titular, p.caminho);
    const origem = fonte.tipo === "IDENTIDADE_EXTERNA" ? obj(fonte.dados.dadosOrigem) : null;
    const registro = origem?.registro ? obj(origem.registro) : null, comprador = registro?.comprador ? obj(registro.comprador) : null;
    const empresa = normal(comprador?.empresa);
    const candidatos = perfis.filter(c => empresa && c.tipo === "PJ" && [normal(c.nome), normal(c.razaoSocial)].includes(empresa));
    if (candidatos.length !== 1 || candidatos[0].id !== titular.id) falha("EMPRESA_ORIGEM_AMBIGUA");
    return titular;
  }
  const prova = fontes.find(f => f.tipo === p.tipo && f.id === p.id);
  if (!prova || prova.sha256 !== p.sha256 || ![prova.pedidoId, ...(prova.pedidoIds ?? [])].includes(fonte.pedidoId)) falha("PROVA_IDENTIDADE_DIVERGENTE");
  if (p.tipo === "HISTORICO_PEDIDO" && p.caminho !== "/depois/clienteId" || p.tipo === "CONTATO_CLIENTE" && p.caminho !== "/clienteId") falha("PROVA_IDENTIDADE_INVALIDA");
  const id = ponteiro(prova.dados, p.caminho);
  return perfis.find(c => c.id === id) ?? null;
}

/** Função pura. Fontes, perfis e resultados completos devem permanecer em arquivo privado. */
export function planejarReconciliacao(configuracao: unknown, perfis: Perfil[], fontes: FonteReconciliacao[]): PreviaReconciliacao {
  const config = validarConfiguracaoReconciliacao(configuracao), raiz = perfis.find(p => p.id === config.alvo.id);
  if (!raiz || raiz.unificadoEmId || raiz.versao !== config.alvo.versao || !perfis.some(p => normalizarEmailCliente(p.email) === config.alvo.email)) falha("ALVO_DIVERGENTE");
  const membros = new Set(perfis.map(p => p.id));
  if (perfis.some(p => p.id !== raiz.id && (!p.unificadoEmId || !membros.has(p.unificadoEmId)))) falha("FAMILIA_DIVERGENTE");
  if (new Set(fontes.map(f => `${f.tipo}:${f.id}`)).size !== fontes.length || fontes.some(f => hashReconciliacao(f.dados) !== f.sha256 || f.tipo !== "PEDIDO" && !fontes.some(p => p.tipo === "PEDIDO" && p.id === f.pedidoId))) falha("FONTES_DIVERGENTES");
  const pendencias: PreviaReconciliacao["pendencias"] = [], cob: EnderecoVenda[] = [], entregas: Entrega[] = [], pedidosCobertos = new Set<string>(), pedidosTitularPendente = new Set<string>(), fontesEntregaCobertas = new Set<string>();
  const adicionarCobranca = (e: EnderecoVenda) => { const chave = chaveCobranca(e); if (!cob.some(c => chaveCobranca(c) === chave)) cob.push(e); };
  const adicionarEntrega = (e: Entrega) => { if (!entregas.some(c => chaveEntrega(c) === chaveEntrega(e))) entregas.push(e); };
  const principal = { ...config.principal, nome: "Principal", ...(config.principal.tipo === "PF" ? { nomeCompleto: config.nomeCliente } : {}) };
  adicionarCobranca(principal);
  for (const e of lista(raiz.enderecos)) { try { adicionarCobranca(cobranca(e, principal)); } catch { pendencias.push({ codigo: "COBRANCA_CADASTRADA_INCOMPLETA", referencia: raiz.id }); } }
  if (raiz.entregaPadrao) {
    const d = obj(raiz.entregaPadrao), existentes = Array.isArray(d.enderecos) && d.enderecos.length ? d.enderecos : [d];
    const selecionado = Number.isSafeInteger(d.selecionado) ? Number(d.selecionado) : 0;
    if (selecionado < 0 || selecionado >= existentes.length) falha("ENTREGA_SELECIONADA_INVALIDA");
    for (const e of [existentes[selecionado], ...existentes.filter((_, i) => i !== selecionado)]) { try { adicionarEntrega(entrega(e)); } catch { pendencias.push({ codigo: "ENTREGA_CADASTRADA_INCOMPLETA", referencia: raiz.id }); } }
  }
  if (!raiz.entregaPadrao && config.copiarCobrancasParaEntrega) adicionarEntrega(entrega({ destinatario: { nome: principal.destinatario || (principal.tipo === "PJ" ? principal.razaoSocial : principal.nomeCompleto) || "", contato: "" }, endereco: copiarEnderecoCobranca(principal) }));
  const pedidos = fontes.filter(f => f.tipo === "PEDIDO");
  for (const f of pedidos) {
    if (!membros.has(String(f.dados.clienteId)) || !["CONFIRMADO", "HISTORICO"].includes(String(f.dados.status))) falha("PEDIDO_FORA_ESCOPO");
    if (f.dados.cobrancaSnapshot) { try { adicionarCobranca(cobranca(f.dados.cobrancaSnapshot)); pedidosCobertos.add(f.pedidoId); } catch { /* Legados exigem transcrição comprovada abaixo. */ } }
    if (f.dados.enderecoSnapshot) { try { adicionarEntrega(entrega({ endereco: f.dados.enderecoSnapshot, destinatario: f.dados.destinatarioSnapshot ?? { nome: "", contato: "" } })); } catch { pendencias.push({ codigo: "ENTREGA_SNAPSHOT_INCOMPLETA", referencia: f.id }); } }
  }
  for (const m of config.mapeamentos) {
    const fonte = fontes.find(f => f.tipo === m.tipo && f.id === m.id);
    if (!fonte || fonte.sha256 !== m.sha256 || !pedidos.some(p => p.id === fonte.pedidoId)) falha("PROVA_DIVERGENTE");
    ponteiro(fonte.dados, m.caminho);
    if (m.cobranca) {
      if (obj(m.cobranca).titularPendente === true) pedidosTitularPendente.add(fonte.pedidoId);
      else {
        const titular = titularDaProva(m, fonte, fontes, perfis), primeiro = titular && Array.isArray(titular.enderecos) ? titular.enderecos[0] : null;
        const documentoOrigem = titular?.documento || (primeiro && obj(primeiro).tipo === titular?.tipo ? obj(primeiro).documento : null);
        if (!titular || titular.tipo !== m.cobranca.tipo || documentoOrigem !== m.cobranca.documento) falha("IDENTIDADE_ORIGEM_DIVERGENTE");
      }
      adicionarCobranca(m.cobranca); pedidosCobertos.add(fonte.pedidoId);
    }
    if (m.entrega) {
      if (fonte.tipo === "IDENTIDADE_EXTERNA") {
        const origem = obj(fonte.dados.dadosOrigem), hub = origem.hub ? obj(origem.hub) : null;
        const shipping = hub?.entregaHistorica ? obj(hub.entregaHistorica) : null;
        const registro = origem.registro ? obj(origem.registro) : null;
        const comprovado = /^\/dadosOrigem\/hub\/entregaHistorica(?:\/|$)/.test(m.caminho) && shipping?.origem === "google-sheets-shipping" && shipping.modalidade === "ENTREGA_INFORMADA" && shipping.enderecoOriginal;
        const indice = /^\/dadosOrigem\/registro\/enderecos\/(\d+)(?:\/|$)/.exec(m.caminho);
        const end = indice && Array.isArray(registro?.enderecos) ? registro.enderecos[Number(indice[1])] : null;
        if (!comprovado && (!end || obj(end).entrega_confirmada !== true)) falha("ENTREGA_ORIGEM_NAO_COMPROVADA");
      } else if (!/^\/enderecoSnapshot(?:\/|$)/.test(m.caminho)) falha("ENTREGA_ORIGEM_NAO_COMPROVADA");
      adicionarEntrega(m.entrega); fontesEntregaCobertas.add(`${fonte.tipo}:${fonte.id}`);
    }
  }
  for (const f of fontes.filter(f => f.tipo === "IDENTIDADE_EXTERNA")) {
    const origem = obj(f.dados.dadosOrigem), hub = origem.hub ? obj(origem.hub) : null, shipping = hub?.entregaHistorica ? obj(hub.entregaHistorica) : null;
    if (shipping?.origem === "google-sheets-shipping" && shipping.modalidade === "ENTREGA_INFORMADA" && shipping.enderecoOriginal && !fontesEntregaCobertas.has(`${f.tipo}:${f.id}`)) pendencias.push({ codigo: "ENTREGA_SHIPPING_SEM_TRANSCRICAO", referencia: f.id });
  }
  for (const f of pedidos) if (!pedidosCobertos.has(f.id)) pendencias.push({ codigo: "COBRANCA_PEDIDO_SEM_PROVA", referencia: f.id });
  if (raiz.documento && raiz.documento !== principal.documento && !cob.slice(1).some(e => e.documento === raiz.documento)) pendencias.push({ codigo: "TITULAR_ANTERIOR_SEM_PROVA", referencia: raiz.id });
  if (config.copiarCobrancasParaEntrega) for (const e of cob) adicionarEntrega(entrega({ destinatario: { nome: e.destinatario || (e.tipo === "PJ" ? e.razaoSocial : e.nomeCompleto) || "", contato: "" }, endereco: copiarEnderecoCobranca(e) }));
  if (cob.length > LIMITE_COBRANCAS_CLIENTE) pendencias.push({ codigo: "LIMITE_COBRANCAS_EXCEDIDO", referencia: String(cob.length) });
  if (entregas.length > LIMITE_ENTREGAS_CLIENTE) pendencias.push({ codigo: "LIMITE_ENTREGAS_EXCEDIDO", referencia: String(entregas.length) });
  const enderecos = cob.map((e, i) => ({ ...e, nome: i === 0 ? "Principal" : `Cobrança ${i + 1}` }));
  const entregaPadrao = entregas.length ? { ...entregas[0], enderecos: entregas, selecionado: 0 } : null;
  const alteracoes: Alteracao[] = [], reserva = config.reservaPrincipal;
  const reservado = perfis.find(p => p.id !== raiz.id && p.documento === principal.documento);
  if (reservado && !reserva) pendencias.push({ codigo: "RESERVA_PRINCIPAL_REQUER_PROVA", referencia: reservado.id });
  if (reserva) {
    const alias = perfis.find(p => p.id === reserva.aliasId);
    if (!alias || alias.id === raiz.id || alias !== reservado || alias.versao !== reserva.versao || hashReconciliacao(alias) !== reserva.sha256 || reserva.titularComprovado.documento !== principal.documento || reserva.titularComprovado.tipo !== alias.tipo) falha("RESERVA_DIVERGENTE");
    const anteriores = lista(alias.enderecos), preservado = { ...reserva.titularComprovado, nome: "Principal" };
    const outros = anteriores.filter(e => { try { return chaveCobranca(cobranca(e)) !== chaveCobranca(preservado); } catch { return true; } });
    if (outros.length >= LIMITE_COBRANCAS_CLIENTE) pendencias.push({ codigo: "LIMITE_COBRANCAS_ALIAS_EXCEDIDO", referencia: alias.id });
    const campos = { documento: null, enderecos: [preservado, ...outros] };
    alteracoes.push({ id: alias.id, versao: alias.versao, antes: json(alias), depois: json({ ...alias, ...campos, versao: alias.versao + 1 }), campos });
  }
  const campos = camposRaiz(config, enderecos, entregaPadrao);
  alteracoes.push({ id: raiz.id, versao: raiz.versao, antes: json(raiz), depois: json({ ...raiz, ...campos, versao: raiz.versao + 1 }), campos });
  const corpo = { versao: 1 as const, operacaoId: config.operacaoId, configuracaoSha256: hashReconciliacao(config), aplicavel: !pendencias.length, pendencias, fontes, alteracoes,
    contagens: { pedidos: pedidos.length, cobrancas: enderecos.length, entregas: entregas.length, pedidosTitularPendente: pedidosTitularPendente.size, cobrancasTitularPendente: enderecos.filter(e => obj(e).titularPendente === true).length } };
  return { ...corpo, token: hashReconciliacao(corpo) };
}

async function carregar(tx: Prisma.TransactionClient, config: ConfiguracaoReconciliacao) {
  if (await resolverClienteCanonico(tx, config.alvo.id) !== config.alvo.id) falha("ALVO_NAO_CANONICO");
  const perfis: Perfil[] = [], ids = new Set([config.alvo.id]);
  for (let nivel = 0; nivel < 100; nivel++) {
    const linhas = await tx.clienteVenda.findMany({ where: { OR: [{ id: config.alvo.id }, { unificadoEmId: { in: [...ids] } }] }, orderBy: { id: "asc" }, take: 1001 });
    if (linhas.length > 1000) falha("FAMILIA_EXCEDIDA");
    for (const p of linhas) ids.add(p.id);
    if (linhas.length === perfis.length) break;
    perfis.splice(0, perfis.length, ...json(linhas) as unknown as Perfil[]);
    if (nivel === 99) falha("FAMILIA_CICLICA");
  }
  const pedidos = await tx.pedidoVenda.findMany({ where: { clienteId: { in: [...ids] }, status: { in: ["CONFIRMADO", "HISTORICO"] } },
    select: { id: true, clienteId: true, versao: true, status: true, atendimento: true, referenciaPedido: true, cobrancaSnapshot: true, destinatarioSnapshot: true, enderecoSnapshot: true }, orderBy: { id: "asc" }, take: 10_001 });
  if (pedidos.length > 10_000) falha("PEDIDOS_EXCEDIDOS");
  const fontes: FonteReconciliacao[] = pedidos.map(p => { const dados = json(p); return { tipo: "PEDIDO", id: p.id, pedidoId: p.id, dados, sha256: hashReconciliacao(dados) }; });
  if (pedidos.length) {
    const origens = await tx.identidadeExternaVenda.findMany({ where: { destinoId: { in: pedidos.map(p => p.id) }, origem: { not: ORIGEM_RECONCILIACAO } }, orderBy: { id: "asc" }, take: 20_001 });
    if (origens.length > 20_000) falha("FONTES_EXCEDIDAS");
    for (const o of origens) { const dados = json(o); fontes.push({ tipo: "IDENTIDADE_EXTERNA", id: o.id, pedidoId: o.destinoId, dados, sha256: hashReconciliacao(dados) }); }
    const historicos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId: { in: pedidos.map(p => p.id) }, tipo: "HISTORICO_CLIENTE_CORRIGIDO" }, orderBy: { id: "asc" }, take: 20_001 });
    if (historicos.length > 20_000) falha("FONTES_EXCEDIDAS");
    for (const h of historicos) { const dados = json(h); fontes.push({ tipo: "HISTORICO_PEDIDO", id: h.id, pedidoId: h.pedidoId, dados, sha256: hashReconciliacao(dados) }); }
    const contatos = await tx.contatoClienteVenda.findMany({ where: { OR: [{ clienteId: { in: [...ids] } }, { clienteOrigemId: { in: [...ids] } }] }, orderBy: { id: "asc" }, take: 10_001 });
    if (contatos.length > 10_000) falha("FONTES_EXCEDIDAS");
    for (const c of contatos) {
      const proveniencia = c.proveniencia && typeof c.proveniencia === "object" && !Array.isArray(c.proveniencia) ? c.proveniencia as Json : {};
      const numeros = Array.isArray(proveniencia.numerosOriginais) ? proveniencia.numerosOriginais : [];
      const relacionados = pedidos.filter(p => p.referenciaPedido && numeros.includes(p.referenciaPedido)).map(p => p.id);
      if (relacionados.length) { const dados = json(c); fontes.push({ tipo: "CONTATO_CLIENTE", id: c.id, pedidoId: relacionados[0], pedidoIds: relacionados, dados, sha256: hashReconciliacao(dados) }); }
    }
  }
  return { perfis, fontes };
}
export async function inspecionarFontesReconciliacao(configuracao: unknown, banco: Banco = prisma) {
  const config = validarConfiguracaoReconciliacao(configuracao);
  return banco.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return carregar(tx, config); }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}
export async function prepararReconciliacao(configuracao: unknown, banco: Banco = prisma) {
  const config = validarConfiguracaoReconciliacao(configuracao);
  return banco.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; const dados = await carregar(tx, config); return planejarReconciliacao(config, dados.perfis, dados.fontes); }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}
function chave(operacaoId: string, reversao = false) { return { origem_loja_entidade_chave: { origem: ORIGEM_RECONCILIACAO, loja: LOJA, entidade: ENTIDADE, chave: `${operacaoId}${reversao ? ":reversao" : ""}` } }; }
async function travar(tx: Prisma.TransactionClient, config: ConfiguracaoReconciliacao) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reconciliacao:${config.alvo.id}`}, 0))::text AS trava`;
}
function autorizar() { if (process.env.CLIENTES_RECONCILIACAO_AUTORIZADA !== "SIM") falha("NAO_AUTORIZADA"); }
async function auditar(tx: Prisma.TransactionClient, config: ConfiguracaoReconciliacao, token: string, alteracoes: Alteracao[], reversao = false) {
  await registrarAtividade(tx, { tipo: "SISTEMA", referencia: config.atorSistema }, { modulo: "cadastros", recurso: "clientes", acao: reversao ? "reverter_reconciliacao" : "reconciliar_cobrancas", entidade: "CLIENTE", entidadeId: config.alvo.id,
    resumo: reversao ? "Reconciliação cadastral revertida por operação técnica auditada." : "Cobranças e entregas reconciliadas por operação técnica auditada.", categoria: "CRITICA", origem: "AUTOMACAO", correlacaoId: config.operacaoId,
    deduplicacao: `clientes-reconciliacao:${token}:${reversao ? "reversao" : "aplicacao"}`, antes: { versao: alteracoes.find(a => a.id === config.alvo.id)!.versao }, depois: { versao: alteracoes.find(a => a.id === config.alvo.id)!.versao + 1 } });
}
async function gravarAlteracoes(tx: Prisma.TransactionClient, alteracoes: Alteracao[]) {
  const depois: Perfil[] = [];
  for (const a of alteracoes) {
    const campos = { ...a.campos, ...(Object.hasOwn(a.campos, "entregaPadrao") ? { entregaPadrao: a.campos.entregaPadrao === null ? Prisma.DbNull : a.campos.entregaPadrao } : {}) };
    const salvo = await tx.clienteVenda.updateMany({ where: { id: a.id, versao: a.versao }, data: { ...campos, versao: { increment: 1 } } as Prisma.ClienteVendaUpdateManyMutationInput });
    if (salvo.count !== 1) falha("VERSAO_CONCORRENTE");
    const atual = await tx.clienteVenda.findUniqueOrThrow({ where: { id: a.id } }); depois.push(json(atual) as unknown as Perfil);
  }
  return depois;
}
export async function aplicarReconciliacao(configuracao: unknown, token: string, banco: Banco = prisma, evidencia?: EvidenciaReconciliacao) {
  autorizar(); const config = validarConfiguracaoReconciliacao(configuracao); hex(token);
  if (evidencia) for (const h of Object.values(evidencia)) hex(h);
  return banco.$transaction(async tx => {
    await travar(tx, config);
    const existente = await tx.identidadeExternaVenda.findUnique({ where: chave(config.operacaoId) });
    if (existente) { const op = obj(existente.dadosOrigem); if (op.configuracaoSha256 !== hashReconciliacao(config) || op.token !== token) falha("OPERACAO_DIVERGENTE"); if (await tx.identidadeExternaVenda.findUnique({ where: chave(config.operacaoId, true) })) falha("OPERACAO_REVERTIDA"); return { operacaoId: config.operacaoId, jaAplicada: true, token }; }
    const dados = await carregar(tx, config), previa = planejarReconciliacao(config, dados.perfis, dados.fontes);
    if (previa.token !== token) falha("PREVIA_DIVERGENTE"); if (!previa.aplicavel) falha("PENDENCIAS_NAO_RESOLVIDAS");
    // Libera a reserva apenas dentro da família antes de atribuir a coluna única à raiz.
    const aliases = previa.alteracoes.slice(0, -1), principal = previa.alteracoes.at(-1)!;
    const depoisAliases = await gravarAlteracoes(tx, aliases);
    await conferirIdentidadeCliente(tx, { id: config.alvo.id, documento: config.principal.documento, email: config.alvo.email } as Parameters<typeof conferirIdentidadeCliente>[1]);
    const depoisRaiz = await gravarAlteracoes(tx, [principal]), depois = [...depoisAliases, ...depoisRaiz];
    await tx.identidadeExternaVenda.create({ data: { ...chave(config.operacaoId).origem_loja_entidade_chave, destinoId: config.alvo.id, resumoOrigem: previa.configuracaoSha256, versaoDestino: depoisRaiz[0].versao,
      dadosOrigem: json({ versao: 1, acao: "APLICAR", configuracao: config, configuracaoSha256: previa.configuracaoSha256, token, previa, antes: previa.alteracoes.map(a => a.antes), depois, ...(evidencia ? { evidencia } : {}), aplicadoEm: new Date().toISOString() }) as Prisma.InputJsonValue } });
    await auditar(tx, config, token, previa.alteracoes);
    return { operacaoId: config.operacaoId, jaAplicada: false, token, contagens: previa.contagens };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
async function planejarReversao(tx: Prisma.TransactionClient, config: ConfiguracaoReconciliacao) {
  const registro = await tx.identidadeExternaVenda.findUnique({ where: chave(config.operacaoId) });
  if (!registro) falha("OPERACAO_AUSENTE");
  const operacao = obj(registro.dadosOrigem);
  if (operacao.versao !== 1 || operacao.configuracaoSha256 !== hashReconciliacao(config)) falha("OPERACAO_DIVERGENTE");
  const antes = lista(operacao.antes) as Perfil[], depois = lista(operacao.depois) as Perfil[], alteracoes: Alteracao[] = [];
  // Libera primeiro o documento da raiz para devolver a reserva ao alias.
  for (const original of [...antes].reverse()) {
    const aplicado = depois.find(p => p.id === original.id), atual = await tx.clienteVenda.findUnique({ where: { id: original.id } });
    if (!aplicado || !atual || hashReconciliacao(atual) !== hashReconciliacao(aplicado)) falha("REVERSAO_ESTADO_DIVERGENTE");
    const camposAplicados = (obj(operacao.previa).alteracoes as Alteracao[]).find(a => a.id === original.id)?.campos;
    if (!camposAplicados) falha("OPERACAO_CORROMPIDA");
    const campos = Object.fromEntries(Object.keys(camposAplicados).map(k => [k, original[k]]));
    const perfil = json(atual) as unknown as Perfil;
    alteracoes.push({ id: original.id, versao: atual.versao, antes: perfil, depois: { ...perfil, ...campos, versao: atual.versao + 1 }, campos });
  }
  return { versao: 1 as const, operacaoId: config.operacaoId, configuracaoSha256: hashReconciliacao(config), alteracoes, token: hashReconciliacao({ operacaoId: config.operacaoId, aplicacaoToken: operacao.token, alteracoes }) };
}
export async function prepararReversaoReconciliacao(configuracao: unknown, banco: Banco = prisma) {
  const config = validarConfiguracaoReconciliacao(configuracao);
  return banco.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return planejarReversao(tx, config); }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}
export async function reverterReconciliacao(configuracao: unknown, token: string, banco: Banco = prisma, evidencia?: EvidenciaReconciliacao) {
  autorizar(); const config = validarConfiguracaoReconciliacao(configuracao); hex(token);
  if (evidencia) for (const h of Object.values(evidencia)) hex(h);
  return banco.$transaction(async tx => {
    await travar(tx, config);
    const existente = await tx.identidadeExternaVenda.findUnique({ where: chave(config.operacaoId, true) });
    if (existente) { const op = obj(existente.dadosOrigem); if (op.configuracaoSha256 !== hashReconciliacao(config) || op.token !== token) falha("OPERACAO_DIVERGENTE"); return { operacaoId: config.operacaoId, jaRevertida: true, token }; }
    const previa = await planejarReversao(tx, config); if (previa.token !== token) falha("PREVIA_DIVERGENTE");
    const depois = await gravarAlteracoes(tx, previa.alteracoes);
    await tx.identidadeExternaVenda.create({ data: { ...chave(config.operacaoId, true).origem_loja_entidade_chave, destinoId: config.alvo.id, resumoOrigem: previa.configuracaoSha256, versaoDestino: depois.find(p => p.id === config.alvo.id)!.versao,
      dadosOrigem: json({ versao: 1, acao: "REVERTER", configuracaoSha256: previa.configuracaoSha256, token, previa, antes: previa.alteracoes.map(a => a.antes), depois, ...(evidencia ? { evidencia } : {}), revertidoEm: new Date().toISOString() }) as Prisma.InputJsonValue } });
    await auditar(tx, config, token, previa.alteracoes, true);
    return { operacaoId: config.operacaoId, jaRevertida: false, token };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
