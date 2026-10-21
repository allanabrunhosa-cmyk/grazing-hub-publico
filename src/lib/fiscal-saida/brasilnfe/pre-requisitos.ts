import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decifrar } from "@/lib/crypto";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { conferirAcessoAdministrativoBrasilNfe } from "./configuracao";
import { ClienteBrasilNfe, ErroHttpBrasilNfe } from "./cliente";
import { ErroConfiguracaoBrasilNfe, validarVersaoBrasilNfe } from "./configuracao-dominio";
import { preRequisitosBrasilNfeVazios, restaurarPreRequisitosBrasilNfe, dataCivilCertificadoBrasilNfe, camposEnderecoExternoAusentesBrasilNfe, ufEmitentePainelBrasilNfe, type PreRequisitosBrasilNfe } from "./pre-requisitos-dominio";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
async function ler(tx: Prisma.TransactionClient) {
  const config = await tx.configuracaoBrasilNfe.findUnique({ where: { id: "singleton" } });
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
  if (config && config.ambiente !== "HOMOLOGACAO") throw new ErroConfiguracaoBrasilNfe("Produção bloqueada.");
  const emitenteHash = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
  return { config, loja, emitenteHash };
}
function dto(s: Awaited<ReturnType<typeof ler>>) { return restaurarPreRequisitosBrasilNfe(s.config?.preRequisitosEmitenteHash === s.emitenteHash ? s.config?.preRequisitos : null, s.config?.versao ?? 0); }
export async function obterPreRequisitosBrasilNfe(sessao: SessaoAtual) {
  return prisma.$transaction(async tx => { await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "visualizar"); return dto(await ler(tx)); });
}
/** A prévia do pedido lê somente estados locais. Permissão fiscal não concede
 * acesso à administração da integração, aos segredos ou às consultas externas. */
export async function obterPreRequisitosEmissaoBrasilNfe(sessao: SessaoAtual): Promise<Pick<PreRequisitosBrasilNfe, "empresaCorrespondente" | "certificado" | "csc" | "evidenciaPainel">> {
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar", "fiscal"]);
    const config = await tx.configuracaoBrasilNfe.findUnique({ where: { id: "singleton" }, select: { versao: true, ambiente: true, preRequisitos: true, preRequisitosEmitenteHash: true } });
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
    if (config && config.ambiente !== "HOMOLOGACAO") throw new ErroConfiguracaoBrasilNfe("Produção bloqueada.");
    const emitenteHash = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
    const p = restaurarPreRequisitosBrasilNfe(config?.preRequisitosEmitenteHash === emitenteHash ? config?.preRequisitos : null, config?.versao ?? 0);
    return { empresaCorrespondente: p.empresaCorrespondente, certificado: p.certificado, csc: p.csc, evidenciaPainel: p.evidenciaPainel };
  });
}
function entradaVersao(entrada: unknown, chaves: string[]) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada) || Object.keys(entrada).some(k => !chaves.includes(k))) throw new ErroConfiguracaoBrasilNfe("Conferência administrativa inválida.");
  const e = objeto(entrada); validarVersaoBrasilNfe(e.versao); return e;
}
export async function registrarEvidenciaPainelBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  const e = entradaVersao(entrada, ["versao", "observadoEm", "origemEvidencia", "servicoAtivo", "homologacaoInformada", "certificadoValidade", "ufEmitente", "cscHomologacao", "idCscHomologacao", "cscProducao", "idCscProducao"]);
  if (typeof e.observadoEm !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.observadoEm) || !Number.isFinite(Date.parse(e.observadoEm)) || Date.parse(e.observadoEm) > Date.now() + 60000 || Date.parse(e.observadoEm) < Date.now() - 7 * 86400000 || ![e.servicoAtivo, e.homologacaoInformada, e.cscHomologacao, e.idCscHomologacao, e.cscProducao, e.idCscProducao].every(v => typeof v === "boolean") || e.certificadoValidade !== null && !dataCivilCertificadoBrasilNfe(e.certificadoValidade)) throw new ErroConfiguracaoBrasilNfe("Informe somente os estados observados e uma data válida, sem segredos.");
  if (e.origemEvidencia !== undefined && !["PAINEL_BRASIL_NFE", "RELATO_USUARIO_PAINEL_BRASIL_NFE"].includes(e.origemEvidencia as string)) throw new ErroConfiguracaoBrasilNfe("Origem da evidência inválida.");
  return prisma.$transaction(async tx => {
    const usuarioId = await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const s = await ler(tx); if (!s.config || s.config.versao !== e.versao) throw new ErroConfiguracaoBrasilNfe("Configuração alterada: recarregue antes de registrar a evidência.");
    if (e.ufEmitente != null && (!ufEmitentePainelBrasilNfe(e.ufEmitente) || e.origemEvidencia !== "PAINEL_BRASIL_NFE" || objeto(s.loja?.enderecoEstruturado).uf !== e.ufEmitente)) throw new ErroConfiguracaoBrasilNfe("A UF observada deve corresponder ao cadastro vinculado, com origem direta do painel.");
    const atual = dto(s), candidato = { ...atual, evidenciaPainel: { origem: e.origemEvidencia ?? "PAINEL_BRASIL_NFE", observadoEm: e.observadoEm, registradoEm: new Date().toISOString(), servicoNfeNfceAtivo: e.servicoAtivo, homologacaoInformadaPeloUsuario: e.homologacaoInformada, certificadoValidade: e.certificadoValidade, ...(e.ufEmitente === undefined ? {} : { ufEmitente: e.ufEmitente }), csc: { homologacao: { codigo: e.cscHomologacao, identificador: e.idCscHomologacao }, producao: { codigo: e.cscProducao, identificador: e.idCscProducao } } } };
    const seguro = restaurarPreRequisitosBrasilNfe(candidato, s.config.versao);
    await tx.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitos: json(seguro), preRequisitosEmitenteHash: s.emitenteHash } });
    await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: "singleton", usuarioId, tipo: "EVIDENCIA_PAINEL", dados: json({ evidencia: seguro.evidenciaPainel, versao: s.config.versao }) } });
    return seguro;
  });
}
/** Rodada manual de leitura: BuscaEmpresa e certificadoInterno. Não chama ConsultarServicos. */
export async function verificarPreRequisitosBrasilNfe(entrada: unknown, sessao: SessaoAtual): Promise<PreRequisitosBrasilNfe> {
  const e = entradaVersao(entrada, ["versao"]);
  const inicio = await prisma.$transaction(async tx => {
    const usuarioId = await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const s = await ler(tx); if (!s.config || s.config.versao !== e.versao) throw new ErroConfiguracaoBrasilNfe("Configuração alterada: recarregue antes de conferir pré-requisitos.");
    if (s.config.preRequisitosIniciadoEm && Date.now() - s.config.preRequisitosIniciadoEm.getTime() < 30000) throw new ErroConfiguracaoBrasilNfe("Aguarde 30 segundos entre conferências.");
    const iniciadoEm = new Date(); await tx.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitosIniciadoEm: iniciadoEm } });
    return { ...s, usuarioId, iniciadoEm };
  });
  const r = dto(inicio); r.empresaFalha = null;
  r.verificadoEm = new Date().toISOString();
  if (inicio.config?.tokenCifrado && inicio.config.userTokenCifrado) {
    try {
      const cliente = new ClienteBrasilNfe({ token: decifrar(inicio.config.tokenCifrado, "grazing-hub-brasilnfe-token-v1"), userToken: decifrar(inicio.config.userTokenCifrado, "grazing-hub-brasilnfe-usertoken-v1") });
      const empresa = await cliente.buscarEmpresa(); r.empresaCorrespondente = empresa.cnpj === inicio.loja?.cnpj?.replace(/[.\/-]/g, ""); r.empresaVerificadaEm = new Date().toISOString();
      if (!r.empresaCorrespondente) { const anterior = preRequisitosBrasilNfeVazios(inicio.config!.versao); r.emitenteExterno = anterior.emitenteExterno; r.csc = anterior.csc; r.certificado = anterior.certificado; delete r.camposEnderecoAusentes; }
      if (r.empresaCorrespondente) {
        r.camposEnderecoAusentes = camposEnderecoExternoAusentesBrasilNfe(empresa.endereco);
        r.emitenteExterno = { ie: !!empresa.inscricaoEstadual, crt: empresa.crt !== null, endereco: r.camposEnderecoAusentes.length === 0 };
        r.csc.homologacao = { codigo: empresa.nfceHomologacao.cscConfigurado, identificador: empresa.nfceHomologacao.idCscConfigurado };
        if (empresa.nfceProducao) r.csc.producao = { codigo: empresa.nfceProducao.cscConfigurado, identificador: empresa.nfceProducao.idCscConfigurado };
        r.certificado.verificadoEm = new Date().toISOString();
        try { const cert = await cliente.verificarCertificadoInterno(); r.certificado = { situacao: cert.expirado ? "EXPIRADO" : cert.valido ? "VALIDO" : "NAO_CONFIRMADO", validade: dataCivilCertificadoBrasilNfe(cert.dataExpiracao), verificadoEm: new Date().toISOString(), httpStatus: 200 }; }
        catch (erro) { r.certificado.situacao = "NAO_CONFIRMADO"; r.certificado.httpStatus = erro instanceof ErroHttpBrasilNfe ? erro.diagnosticoSeguro.httpStatus : null; r.certificado.falha = erro instanceof ErroHttpBrasilNfe ? erro.diagnosticoSeguro : null; }
      }
    } catch (erro) { r.empresaFalha = erro instanceof ErroHttpBrasilNfe ? erro.diagnosticoSeguro : null; }
  }
  return prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const s = await ler(tx); if (!s.config || s.config.versao !== inicio.config!.versao || s.emitenteHash !== inicio.emitenteHash || s.config.preRequisitosIniciadoEm?.getTime() !== inicio.iniciadoEm.getTime()) throw new ErroConfiguracaoBrasilNfe("Configuração/emitente alterado durante a consulta: resultado descartado.");
    r.evidenciaPainel = dto(s).evidenciaPainel;
    const seguro = restaurarPreRequisitosBrasilNfe(r, s.config.versao);
    await tx.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitos: json(seguro), preRequisitosEmitenteHash: s.emitenteHash } });
    await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: "singleton", usuarioId: inicio.usuarioId, tipo: "PRE_REQUISITOS_LEITURA", dados: json({ versao: s.config.versao, resultado: seguro }) } });
    return seguro;
  });
}
