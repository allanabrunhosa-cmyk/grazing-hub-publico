import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decifrar } from "@/lib/crypto";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { conferirAcessoAdministrativoBrasilNfe } from "./configuracao";
import { ClienteBrasilNfe, ErroHttpBrasilNfe } from "./cliente";
import { ErroConfiguracaoBrasilNfe, validarVersaoBrasilNfe } from "./configuracao-dominio";
import { MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE, type AtualizacaoNumeracaoBrasilNfeDto, type ComandoAtualizacaoNumeracaoBrasilNfe, type NumeracaoFiscalBrasilNfeDto, type RegistroNumeracaoBrasilNfe } from "./numeracao-dto";
import { projetarNumeracaoFiscalBrasilNfe, restaurarRegistroNumeracaoBrasilNfe } from "./numeracao-dominio";
import { conferirCatalogoPosteriorBrasilNfe, conferirContadorAtualizacaoBrasilNfe, ErroAtualizacaoNumeracaoBrasilNfe, validarAtualizacaoNumeracaoBrasilNfe, VALIDADE_CONSULTA_NUMERACAO_BRASILNFE_MS } from "./numeracao-validacao";
import { sanitizarMetadadosErroBrasilNfe } from "./diagnostico-http";
import type { NumeracoesBrasilNfeSanitizadas } from "./tipos-http";
import { transmissaoBrasilNfeLiberada } from "./bloqueio-transmissao";

export type { NumeracaoFiscalBrasilNfeDto } from "./numeracao-dto";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const TIPOS = { inicio: "NUMERACAO_CONSULTA_INICIADA", resultado: "NUMERACAO_CONSULTADA" } as const;
const ATUALIZACAO = { inicio: "NUMERACAO_ATUALIZACAO_INICIADA", envio: "NUMERACAO_ATUALIZACAO_ENVIO", resultado: "NUMERACAO_ATUALIZACAO_RESULTADO" } as const;
const LEASE_ATUALIZACAO_MS = 90_000;
// O HTTP continua limitado a 10s. A transação inclui as guardas locais e esse único POST.
const PRAZO_TRANSACAO_ATUALIZACAO_MS = 20_000;
type Identidade = Awaited<ReturnType<typeof lerIdentidade>>;
type RegistroAtualizacao = AtualizacaoNumeracaoBrasilNfeDto & { esquema: "grazing.brasilnfe.numeracao.atualizacao"; versao: 1; versaoConfiguracao: number; emitenteHash: string; hashComando: string; anterior?: NumeracoesBrasilNfeSanitizadas };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const dataIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
const cnpj = (v: string | null | undefined) => (v ?? "").replace(/[.\/-]/g, "");

function restaurarAtualizacao(valor: unknown): RegistroAtualizacao | null {
  const r = objeto(valor);
  if (r.esquema !== "grazing.brasilnfe.numeracao.atualizacao" || r.versao !== 1 || !Number.isSafeInteger(r.versaoConfiguracao) || (r.versaoConfiguracao as number) < 1
    || typeof r.emitenteHash !== "string" || !/^[a-f\d]{64}$/.test(r.emitenteHash) || typeof r.hashComando !== "string" || !/^[a-f\d]{64}$/.test(r.hashComando)
    || !["EM_ANDAMENTO", "CONFIRMADA", "PENDENTE_CONFERENCIA", "RECUSADA"].includes(r.situacao as string) || !dataIso(r.solicitadoEm)
    || (r.confirmadoEm !== null && !dataIso(r.confirmadoEm)) || (r.motivo !== null && !Object.values(MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE).includes(r.motivo as never))) return null;
  try { validarAtualizacaoNumeracaoBrasilNfe({ versao: r.versaoConfiguracao, modelo: r.modelo, ambiente: r.ambiente, serie: r.serie, proximoNumero: r.proximoNumero,
    padrao: r.padrao, operacaoId: r.operacaoId, consultadoEm: r.solicitadoEm, confirmarAtualizacao: true }); } catch { return null; }
  let anterior: NumeracoesBrasilNfeSanitizadas | undefined;
  if (r.anterior !== undefined) {
    const restaurado = restaurarRegistroNumeracaoBrasilNfe({ esquema: "grazing.brasilnfe.numeracao", versao: 1, versaoConfiguracao: r.versaoConfiguracao, emitenteHash: r.emitenteHash, consultadoEm: r.solicitadoEm, resultado: r.anterior, falha: null });
    if (!restaurado?.resultado) return null;
    anterior = restaurado.resultado;
  }
  return { esquema: "grazing.brasilnfe.numeracao.atualizacao", versao: 1, versaoConfiguracao: r.versaoConfiguracao as number, emitenteHash: r.emitenteHash, hashComando: r.hashComando,
    situacao: r.situacao as RegistroAtualizacao["situacao"], operacaoId: r.operacaoId as string, solicitadoEm: r.solicitadoEm, confirmadoEm: r.confirmadoEm as string | null,
    modelo: r.modelo as 55 | 65, ambiente: r.ambiente as 1 | 2, serie: r.serie as string, proximoNumero: r.proximoNumero as string, padrao: r.padrao as boolean,
    falha: sanitizarMetadadosErroBrasilNfe(r.falha), motivo: r.motivo as string | null, ...(anterior ? { anterior } : {}) };
}
function dtoAtualizacao(r: RegistroAtualizacao, identidade: Identidade): AtualizacaoNumeracaoBrasilNfeDto {
  const expirada = r.situacao === "EM_ANDAMENTO" && Date.now() - Date.parse(r.solicitadoEm) >= LEASE_ATUALIZACAO_MS;
  return { situacao: expirada ? "PENDENTE_CONFERENCIA" : r.situacao, operacaoId: r.operacaoId, solicitadoEm: r.solicitadoEm, confirmadoEm: r.confirmadoEm,
    contexto: r.versaoConfiguracao === identidade.config?.versao && r.emitenteHash === identidade.emitenteHash ? "ATUAL" : "ANTERIOR",
    modelo: r.modelo, ambiente: r.ambiente, serie: r.serie, proximoNumero: r.proximoNumero, padrao: r.padrao, falha: r.falha,
    motivo: expirada ? MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE.RESULTADO_INCERTO : r.motivo };
}
async function exigirEmissaoParada(tx?: Prisma.TransactionClient) {
  // O escopo de uma nota não é uma chave global. A administração exige suspensão
  // durável dos dois ambientes, conferida sob as mesmas travas da habilitação.
  if (transmissaoBrasilNfeLiberada()) throw new ErroConfiguracaoBrasilNfe("A atualização de numeração fica indisponível enquanto a transmissão estiver habilitada.");
  if (!tx) return;
  const eventos = await tx.eventoConfiguracaoBrasilNfe.findMany({ where: { configuracaoId: "singleton", tipo: "EMISSAO_MANUAL_HABILITACAO" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { dados: true } });
  const vistos = new Set<string>();
  for (const e of eventos) { const d = objeto(e.dados); if (!["HOMOLOGACAO", "PRODUCAO"].includes(d.ambiente as string)) throw new ErroConfiguracaoBrasilNfe("Histórico de habilitação inválido. Conferir antes de administrar numeração."); if (vistos.has(d.ambiente as string)) continue; vistos.add(d.ambiente as string); if (d.habilitada !== false) throw new ErroConfiguracaoBrasilNfe("Suspenda novos envios nos dois ambientes antes de alterar a numeração."); }
}
async function travarAdministracao(tx: Prisma.TransactionClient, sessao: SessaoAtual) {
  const usuarioId = await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
  return usuarioId;
}
async function lerFinalAtualizacao(tx: Prisma.TransactionClient, operacaoId: string) {
  const evento = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: ATUALIZACAO.resultado, dados: { path: ["operacaoId"], equals: operacaoId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
  if (!evento) return null;
  const r = restaurarAtualizacao(evento.dados);
  if (!r) throw new ErroConfiguracaoBrasilNfe("Histórico administrativo de numeração inválido. Requer conferência antes de outra atualização.");
  return r;
}
async function ultimaAtualizacao(tx: Prisma.TransactionClient) {
  const evento = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: ATUALIZACAO.inicio }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
  if (!evento) return null;
  const inicio = restaurarAtualizacao(evento.dados);
  if (!inicio) throw new ErroConfiguracaoBrasilNfe("Histórico administrativo de numeração inválido. Requer conferência antes de outra atualização.");
  return await lerFinalAtualizacao(tx, inicio.operacaoId) ?? inicio;
}
/** Executada sob as mesmas travas antes da intenção e novamente antes do único POST. */
async function conferirOperacaoVigente(tx: Prisma.TransactionClient, registro: RegistroAtualizacao) {
  const final = await lerFinalAtualizacao(tx, registro.operacaoId);
  const vigente = await ultimaAtualizacao(tx);
  if (final || !vigente || vigente.operacaoId !== registro.operacaoId || vigente.hashComando !== registro.hashComando
    || vigente.versaoConfiguracao !== registro.versaoConfiguracao || vigente.emitenteHash !== registro.emitenteHash || vigente.situacao !== "EM_ANDAMENTO") {
    throw new ErroAtualizacaoNumeracaoBrasilNfe("OPERACAO_ENCERRADA");
  }
  const idade = Date.now() - Date.parse(vigente.solicitadoEm);
  if (idade < 0 || idade >= LEASE_ATUALIZACAO_MS) throw new ErroAtualizacaoNumeracaoBrasilNfe("OPERACAO_EXPIRADA");
}
async function conferirDocumentosEmAndamento(tx: Prisma.TransactionClient) {
  const ativos = await tx.documentoFiscalSaida.findMany({ where: { OR: [{ acao: { not: null } }, { leaseToken: { not: null } }, { status: { in: ["PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"] } }] }, take: 1, select: { id: true } });
  if (ativos.length) throw new ErroAtualizacaoNumeracaoBrasilNfe("DOCUMENTO_EM_ANDAMENTO");
}
async function maiorNumeroProprio(tx: Prisma.TransactionClient, comando: ComandoAtualizacaoNumeracaoBrasilNfe, emitenteCnpj: string) {
  const documentos = await tx.documentoFiscalSaida.findMany({ where: { ambiente: comando.ambiente === 1 ? "PRODUCAO" : "HOMOLOGACAO", modeloDocumento: comando.modelo }, take: 10001,
    select: { numero: true, serie: true, chaveFiscal: true, payload: true, status: true, protocolo: true } });
  if (documentos.length > 10000) throw new ErroConfiguracaoBrasilNfe("O histórico local excede o limite de conferência. Nenhuma atualização será enviada.");
  let maior = 0;
  for (const d of documentos) {
    const consumido = ["AUTORIZADO", "CANCELADO", "DENEGADO"].includes(d.status) || typeof d.protocolo === "string" && /^\d{1,30}$/.test(d.protocolo);
    if (!consumido) continue; // Rejeição sem protocolo, inclusive181, não comprova consumo de número.
    const chave = d.chaveFiscal, emitenteSnapshot = objeto(objeto(d.payload).emitente).cnpj;
    const chaveValida = typeof chave === "string" && /^\d{44}$/.test(chave);
    const snapshotCnpj = typeof emitenteSnapshot === "string" ? cnpj(emitenteSnapshot) : "";
    const snapshotValido = /^\d{14}$/.test(snapshotCnpj);
    const proprio = chaveValida && chave.slice(6, 20) === emitenteCnpj;
    const snapshotProprio = snapshotValido && snapshotCnpj === emitenteCnpj;
    const contradicao = proprio && snapshotValido && !snapshotProprio || snapshotProprio && chaveValida && !proprio;
    if (contradicao) throw new ErroAtualizacaoNumeracaoBrasilNfe("HISTORICO_LOCAL_INCOMPLETO");
    const outroEmitente = chaveValida && !proprio || snapshotValido && !snapshotProprio;
    if (outroEmitente) continue;
    const serieChave = proprio ? chave!.slice(22, 25) : null;
    const numeroChave = proprio ? chave!.slice(25, 34).replace(/^0+/, "") || "0" : null;
    const serieCampo = typeof d.serie === "string" && /^\d{1,3}$/.test(d.serie) ? d.serie : null;
    if (!serieCampo && !serieChave) throw new ErroAtualizacaoNumeracaoBrasilNfe("HISTORICO_LOCAL_INCOMPLETO");
    if (Number(serieCampo ?? serieChave) !== Number(comando.serie) && (serieChave === null || Number(serieChave) !== Number(comando.serie))) continue;
    if (!proprio && !snapshotProprio) throw new ErroAtualizacaoNumeracaoBrasilNfe("HISTORICO_LOCAL_INCOMPLETO");
    if (proprio && (Number(chave!.slice(20, 22)) !== comando.modelo || d.serie !== null && (!/^\d{1,3}$/.test(d.serie) || Number(d.serie) !== Number(serieChave))
      || d.numero !== null && (!/^[1-9]\d{0,8}$/.test(d.numero) || Number(d.numero) !== Number(numeroChave)))) throw new ErroConfiguracaoBrasilNfe("A identidade de um documento local diverge da chave. Confira o histórico fiscal antes de alterar numeração.");
    const numero = d.numero ?? numeroChave;
    if (typeof numero !== "string" || !/^[1-9]\d{0,8}$/.test(numero)) throw new ErroConfiguracaoBrasilNfe("Documento local sem numeração comprovada. Confira o histórico fiscal antes de alterar o contador.");
    maior = Math.max(maior, Number(numero));
  }
  return maior;
}
async function conferirLeitura(tx: Prisma.TransactionClient, sessao: SessaoAtual) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0) || (u.perfilAcesso?.sistema !== "ADMINISTRADOR"
    && !["vendas.fiscal", "financeiro.fiscal.painel", "configuracoes.brasilnfe"].some(recurso => permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, (u.permissoesPersonalizadas ?? {}) as Excecoes, recurso, "visualizar")))) throw new ErroConfiguracaoBrasilNfe("Seu acesso não permite consultar a numeração fiscal.");
}
async function lerIdentidade(tx: Prisma.TransactionClient) {
  const config = await tx.configuracaoBrasilNfe.findUnique({ where: { id: "singleton" } });
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
  return { config, loja, emitenteHash: createHash("sha256").update(JSON.stringify(loja)).digest("hex") };
}
async function projetar(tx: Prisma.TransactionClient, identidade: Awaited<ReturnType<typeof lerIdentidade>>): Promise<NumeracaoFiscalBrasilNfeDto> {
  const [evento, autorizacoes] = await Promise.all([
    tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: TIPOS.resultado }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } }),
    tx.documentoFiscalSaida.findMany({ where: { modeloDocumento: { in: [55, 65] }, status: { in: ["AUTORIZADO", "CANCELADO"] }, protocolo: { not: null } }, orderBy: { createdAt: "desc" }, take: 1001,
      select: { id: true, ambiente: true, modeloDocumento: true, chaveFiscal: true, numero: true, serie: true, protocolo: true,
        eventos: { where: { tipo: "RETORNO", dados: { path: ["status"], equals: "AUTORIZADO" } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } }),
  ]);
  const dados = projetarNumeracaoFiscalBrasilNfe({ versao: identidade.config?.versao ?? 0, emitenteHash: identidade.emitenteHash,
    emitente: { cnpj: identidade.loja?.cnpj ?? null, nome: identidade.loja?.nome ?? null }, registro: evento?.dados, autorizacoes: autorizacoes.slice(0, 1000), historicoLimitado: autorizacoes.length > 1000 });
  const historico = await tx.eventoConfiguracaoBrasilNfe.findMany({ where: { configuracaoId: "singleton", tipo: ATUALIZACAO.inicio }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { dados: true } });
  const historicoAtualizacoes: AtualizacaoNumeracaoBrasilNfeDto[] = [];
  for (const evento of historico) {
    const registro = restaurarAtualizacao(evento.dados);
    if (registro) historicoAtualizacoes.push(dtoAtualizacao(await lerFinalAtualizacao(tx, registro.operacaoId) ?? registro, identidade));
  }
  return { ...dados, atualizacao: historicoAtualizacoes.find(r => r.contexto === "ATUAL") ?? null, historicoAtualizacoes };
}

function clienteAdministrativo(identidade: Identidade) {
  return new ClienteBrasilNfe({ token: decifrar(identidade.config!.tokenCifrado!, "grazing-hub-brasilnfe-token-v1"), userToken: decifrar(identidade.config!.userTokenCifrado!, "grazing-hub-brasilnfe-usertoken-v1") });
}
async function conferirIdentidadeAtual(tx: Prisma.TransactionClient, anterior: Identidade) {
  const atual = await lerIdentidade(tx);
  if (atual.config?.versao !== anterior.config?.versao || atual.emitenteHash !== anterior.emitenteHash
    || atual.config?.tokenCifrado !== anterior.config?.tokenCifrado || atual.config?.userTokenCifrado !== anterior.config?.userTokenCifrado) throw new ErroAtualizacaoNumeracaoBrasilNfe("CONFIGURACAO_ALTERADA");
  return atual;
}
async function gravarConsulta(tx: Prisma.TransactionClient, identidade: Identidade, usuarioId: string, resultado: NumeracoesBrasilNfeSanitizadas) {
  const r = restaurarRegistroNumeracaoBrasilNfe({ esquema: "grazing.brasilnfe.numeracao", versao: 1, versaoConfiguracao: identidade.config!.versao, emitenteHash: identidade.emitenteHash,
    consultadoEm: new Date().toISOString(), resultado, falha: null });
  if (!r) throw new ErroConfiguracaoBrasilNfe("Resultado da consulta de numeração inválido.");
  await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: "singleton", usuarioId, tipo: TIPOS.resultado, dados: json(r) } });
}
async function gravarAtualizacao(tx: Prisma.TransactionClient, registro: RegistroAtualizacao, usuarioId: string, tipo: typeof ATUALIZACAO[keyof typeof ATUALIZACAO]) {
  const seguro = restaurarAtualizacao(registro);
  if (!seguro) throw new ErroConfiguracaoBrasilNfe("Registro administrativo de numeração inválido.");
  await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: "singleton", usuarioId, tipo, dados: json(seguro) } });
}
async function reconciliarAtualizacao(tx: Prisma.TransactionClient, pendente: RegistroAtualizacao | null, identidade: Identidade, usuarioId: string, resultado: NumeracoesBrasilNfeSanitizadas) {
  if (!pendente || ["CONFIRMADA", "RECUSADA"].includes(pendente.situacao) || pendente.versaoConfiguracao !== identidade.config!.versao || pendente.emitenteHash !== identidade.emitenteHash) return;
  // O estado carregado antes do GET pode ter sido encerrado por outra consulta.
  const final = await lerFinalAtualizacao(tx, pendente.operacaoId);
  if (final && ["CONFIRMADA", "RECUSADA"].includes(final.situacao)) return;
  if (pendente.situacao === "EM_ANDAMENTO" && Date.now() - Date.parse(pendente.solicitadoEm) < LEASE_ATUALIZACAO_MS) return;
  const envio = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: ATUALIZACAO.envio, dados: { path: ["operacaoId"], equals: pendente.operacaoId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
  const intencao = envio ? restaurarAtualizacao(envio.dados) : null;
  if (envio && !intencao?.anterior) throw new ErroConfiguracaoBrasilNfe("Intenção de atualização sem prova anterior válida. Mantenha a operação em conferência.");
  const comando: ComandoAtualizacaoNumeracaoBrasilNfe = { versao: pendente.versaoConfiguracao, modelo: pendente.modelo, ambiente: pendente.ambiente,
    serie: pendente.serie, proximoNumero: pendente.proximoNumero, padrao: pendente.padrao, operacaoId: pendente.operacaoId, consultadoEm: pendente.solicitadoEm, confirmarAtualizacao: true };
  const confirmada = !!intencao?.anterior && conferirCatalogoPosteriorBrasilNfe(comando, intencao.anterior, resultado, true);
  await gravarAtualizacao(tx, { ...pendente, situacao: !envio ? "RECUSADA" : confirmada ? "CONFIRMADA" : "PENDENTE_CONFERENCIA",
    confirmadoEm: confirmada ? new Date().toISOString() : null, falha: confirmada || !envio ? null : pendente.falha,
    motivo: MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE[!envio ? "CONSULTA_SEM_ENVIO" : confirmada ? "CONSULTA_CONFIRMOU" : "CONSULTA_NAO_CONFIRMOU"] }, usuarioId, ATUALIZACAO.resultado);
}
/** Apenas banco local e DTO restrito. Não faz qualquer consulta externa na leitura da tela/prévia. */
export async function obterNumeracaoFiscalBrasilNfe(sessao: SessaoAtual): Promise<NumeracaoFiscalBrasilNfeDto> {
  return prisma.$transaction(async tx => { await conferirLeitura(tx, sessao); return projetar(tx, await lerIdentidade(tx)); });
}
/** Ação manual de leitura, sujeita às permissões centrais atuais. Não reserva nem atualiza contadores. */
export async function consultarNumeracaoFiscalBrasilNfe(entrada: unknown, sessao: SessaoAtual): Promise<NumeracaoFiscalBrasilNfeDto> {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada) || Object.keys(entrada).some(k => k !== "versao")) throw new ErroConfiguracaoBrasilNfe("Consulta de numeração inválida.");
  const versao = (entrada as { versao: unknown }).versao; validarVersaoBrasilNfe(versao);
  const inicio = await prisma.$transaction(async tx => {
    const usuarioId = await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const s = await lerIdentidade(tx);
    if (!s.config || s.config.versao !== versao) throw new ErroConfiguracaoBrasilNfe("Configuração alterada. Reabra a tela antes de consultar.");
    if (!s.config.tokenCifrado || !s.config.userTokenCifrado || !/^\d{14}$/.test(s.loja?.cnpj?.replace(/[.\/-]/g, "") ?? "")) throw new ErroConfiguracaoBrasilNfe("Configure o emitente, Token e UserToken no canal protegido da integração.");
    const anterior = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: s.config.id, tipo: TIPOS.inicio }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (anterior && Date.now() - anterior.createdAt.getTime() < 30000) throw new ErroConfiguracaoBrasilNfe("Aguarde 30 segundos antes de repetir a consulta de numeração.");
    const evento = await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: s.config.id, usuarioId, tipo: TIPOS.inicio, dados: json({ versaoConfiguracao: s.config.versao, emitenteHash: s.emitenteHash }) }, select: { id: true } });
    return { ...s, usuarioId, tentativaId: evento.id, atualizacaoPendente: await ultimaAtualizacao(tx) };
  });
  const registro: RegistroNumeracaoBrasilNfe = { esquema: "grazing.brasilnfe.numeracao", versao: 1, versaoConfiguracao: inicio.config!.versao, emitenteHash: inicio.emitenteHash, consultadoEm: new Date().toISOString(), resultado: null, falha: null };
  try {
    const cliente = clienteAdministrativo(inicio);
    if (inicio.atualizacaoPendente && ["EM_ANDAMENTO", "PENDENTE_CONFERENCIA"].includes(inicio.atualizacaoPendente.situacao)) {
      const empresa = await cliente.buscarEmpresa();
      if (empresa.cnpj !== cnpj(inicio.loja?.cnpj)) throw new ErroAtualizacaoNumeracaoBrasilNfe("IDENTIDADE_DIVERGENTE");
    }
    registro.resultado = await cliente.consultarNumeracao();
  } catch (erro) { registro.falha = erro instanceof ErroHttpBrasilNfe ? erro.diagnosticoSeguro : new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA").diagnosticoSeguro; }
  const seguro = restaurarRegistroNumeracaoBrasilNfe(registro);
  if (!seguro) throw new ErroConfiguracaoBrasilNfe("Resultado da consulta de numeração inválido. Nenhuma resposta externa foi armazenada.");
  return prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const atual = await lerIdentidade(tx);
    if (atual.config?.versao !== inicio.config!.versao || atual.emitenteHash !== inicio.emitenteHash) throw new ErroConfiguracaoBrasilNfe("Configuração ou emitente alterado durante a consulta. Resultado descartado.");
    await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: atual.config.id, usuarioId: inicio.usuarioId, tipo: TIPOS.resultado, dados: json({ ...seguro, tentativaId: inicio.tentativaId }) } });
    if (seguro.resultado) await reconciliarAtualizacao(tx, inicio.atualizacaoPendente, atual, inicio.usuarioId, seguro.resultado);
    return projetar(tx, atual);
  });
}

/** Uma intenção durável por UUID. Nunca repete automaticamente uma escrita externa. */
export async function atualizarNumeracaoFiscalBrasilNfe(entrada: unknown, sessao: SessaoAtual): Promise<NumeracaoFiscalBrasilNfeDto> {
  const comando = validarAtualizacaoNumeracaoBrasilNfe(entrada);
  await exigirEmissaoParada();
  const hashComando = createHash("sha256").update(JSON.stringify(comando)).digest("hex");
  const inicio = await prisma.$transaction(async tx => {
    const usuarioId = await travarAdministracao(tx, sessao);
    await exigirEmissaoParada(tx);
    const s = await lerIdentidade(tx);
    if (!s.config || s.config.versao !== comando.versao) throw new ErroConfiguracaoBrasilNfe("Configuração alterada. Reabra a tela antes de atualizar.");
    if (!s.config.tokenCifrado || !s.config.userTokenCifrado || !/^\d{14}$/.test(cnpj(s.loja?.cnpj))) throw new ErroConfiguracaoBrasilNfe("Configure emitente, Token e UserToken no canal protegido da integração.");
    const anteriorId = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: ATUALIZACAO.inicio, dados: { path: ["operacaoId"], equals: comando.operacaoId } }, select: { dados: true } });
    if (anteriorId) {
      const r = restaurarAtualizacao(anteriorId.dados);
      if (!r || r.hashComando !== hashComando || r.emitenteHash !== s.emitenteHash) throw new ErroConfiguracaoBrasilNfe("Identificador de operação já utilizado com outro conteúdo. Nenhuma atualização foi reenviada.");
      return { ...s, usuarioId, repetida: true, registro: r };
    }
    const anterior = await ultimaAtualizacao(tx);
    if (anterior && ["EM_ANDAMENTO", "PENDENTE_CONFERENCIA"].includes(anterior.situacao)) throw new ErroConfiguracaoBrasilNfe("Há uma atualização em andamento ou pendente. Consulte e confira a numeração antes de outra solicitação.");
    if (anterior && Date.now() - Date.parse(anterior.solicitadoEm) < 30000) throw new ErroConfiguracaoBrasilNfe("Aguarde 30 segundos antes de uma nova atualização de numeração.");
    const cache = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: TIPOS.resultado }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
    const consulta = restaurarRegistroNumeracaoBrasilNfe(cache?.dados);
    const idade = consulta ? Date.now() - Date.parse(consulta.consultadoEm) : Infinity;
    if (!consulta?.resultado || consulta.versaoConfiguracao !== comando.versao || consulta.emitenteHash !== s.emitenteHash || consulta.consultadoEm !== comando.consultadoEm || idade < 0 || idade > VALIDADE_CONSULTA_NUMERACAO_BRASILNFE_MS) throw new ErroConfiguracaoBrasilNfe("Faça uma consulta recente da numeração e confira os valores antes de confirmar a atualização.");
    await conferirDocumentosEmAndamento(tx);
    const registro: RegistroAtualizacao = { esquema: "grazing.brasilnfe.numeracao.atualizacao", versao: 1, versaoConfiguracao: s.config.versao, emitenteHash: s.emitenteHash, hashComando,
      situacao: "EM_ANDAMENTO", operacaoId: comando.operacaoId, solicitadoEm: new Date().toISOString(), confirmadoEm: null,
      modelo: comando.modelo, ambiente: comando.ambiente, serie: comando.serie, proximoNumero: comando.proximoNumero, padrao: comando.padrao, falha: null, motivo: null };
    await gravarAtualizacao(tx, registro, usuarioId, ATUALIZACAO.inicio);
    return { ...s, usuarioId, repetida: false, registro };
  });
  if (inicio.repetida) return prisma.$transaction(async tx => { await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); return projetar(tx, await lerIdentidade(tx)); });
  let envioIniciado = false, fase: "PRE" | "ATUALIZACAO" | "POS" = "PRE", leitura: NumeracoesBrasilNfeSanitizadas | null = null;
  let resultado: RegistroAtualizacao = inicio.registro;
  try {
    const cliente = clienteAdministrativo(inicio), empresa = await cliente.buscarEmpresa();
    if (empresa.cnpj !== cnpj(inicio.loja?.cnpj)) throw new ErroAtualizacaoNumeracaoBrasilNfe("IDENTIDADE_DIVERGENTE");
    leitura = await cliente.consultarNumeracao();
    const semEnvio = await prisma.$transaction(async tx => {
      await travarAdministracao(tx, sessao); await exigirEmissaoParada(tx);
      await conferirOperacaoVigente(tx, inicio.registro);
      await conferirIdentidadeAtual(tx, inicio); await conferirDocumentosEmAndamento(tx);
      const maior = await maiorNumeroProprio(tx, comando, empresa.cnpj);
      const satisfeita = conferirContadorAtualizacaoBrasilNfe(comando, leitura!, maior);
      if (!satisfeita) await gravarAtualizacao(tx, { ...inicio.registro, anterior: leitura! }, inicio.usuarioId, ATUALIZACAO.envio);
      return satisfeita;
    });
    if (!semEnvio) {
      // A intenção já está confirmada no banco. As travas impedem que uma consulta
      // encerre a operação ou libere outra atualização enquanto o POST começa.
      fase = "ATUALIZACAO";
      await prisma.$transaction(async tx => {
        await travarAdministracao(tx, sessao); await exigirEmissaoParada(tx);
        await conferirOperacaoVigente(tx, inicio.registro);
        await conferirIdentidadeAtual(tx, inicio); await conferirDocumentosEmAndamento(tx);
        conferirContadorAtualizacaoBrasilNfe(comando, leitura!, await maiorNumeroProprio(tx, comando, empresa.cnpj));
        envioIniciado = true;
        await cliente.atualizarNumeracao({ TipoAmbiente: comando.ambiente, ModeloDocumento: comando.modelo, Serie: comando.serie, Numero: Number(comando.proximoNumero), Padrao: comando.padrao });
      }, { timeout: PRAZO_TRANSACAO_ATUALIZACAO_MS });
      fase = "POS";
      const posterior = await cliente.consultarNumeracao();
      const empresaPosterior = await cliente.buscarEmpresa();
      if (empresaPosterior.cnpj !== empresa.cnpj || !conferirCatalogoPosteriorBrasilNfe(comando, leitura, posterior)) throw new ErroAtualizacaoNumeracaoBrasilNfe("POS_CONSULTA_DIVERGENTE");
      leitura = posterior;
    }
    resultado = { ...inicio.registro, situacao: "CONFIRMADA", confirmadoEm: new Date().toISOString(), motivo: MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE[semEnvio ? "JA_CONFIGURADA" : "CONFIRMADA"] };
  } catch (erro) {
    const falha = erro instanceof ErroHttpBrasilNfe ? erro.diagnosticoSeguro : null;
    const negadaPeloFornecedor = fase === "ATUALIZACAO" && falha?.categoria === "NEGOCIO" && falha.statusFornecedor === false;
    resultado = { ...inicio.registro, situacao: envioIniciado && !negadaPeloFornecedor ? "PENDENTE_CONFERENCIA" : "RECUSADA", falha,
      motivo: MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE[negadaPeloFornecedor ? "NEGADA_FORNECEDOR" : erro instanceof ErroAtualizacaoNumeracaoBrasilNfe ? erro.motivo : envioIniciado ? "RESULTADO_INCERTO" : "FALHA_PRE_CONSULTA"] };
  }
  return prisma.$transaction(async tx => {
    await travarAdministracao(tx, sessao);
    const atual = await lerIdentidade(tx);
    const terminal = await lerFinalAtualizacao(tx, inicio.registro.operacaoId);
    if (terminal && ["CONFIRMADA", "RECUSADA"].includes(terminal.situacao)) return projetar(tx, atual);
    const corresponde = atual.config?.versao === inicio.config!.versao && atual.emitenteHash === inicio.emitenteHash
      && atual.config?.tokenCifrado === inicio.config!.tokenCifrado && atual.config?.userTokenCifrado === inicio.config!.userTokenCifrado;
    if (!corresponde) {
      resultado = { ...resultado, situacao: envioIniciado ? "PENDENTE_CONFERENCIA" : "RECUSADA", confirmadoEm: null, motivo: MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE.CONFIGURACAO_ALTERADA };
      leitura = null;
    }
    if (leitura && resultado.situacao !== "PENDENTE_CONFERENCIA") await gravarConsulta(tx, atual, inicio.usuarioId, leitura);
    await gravarAtualizacao(tx, resultado, inicio.usuarioId, ATUALIZACAO.resultado);
    return projetar(tx, atual);
  });
}
