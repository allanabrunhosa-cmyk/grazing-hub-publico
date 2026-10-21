import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import type { AdaptadorFiscalSaida, IdentidadeFiscalSaida } from "../contrato";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { executarFiscalSaidaControlado, obterArquivosFiscalSaidaControlado } from "../servico";
import { AdaptadorBrasilNfeM1 } from "./adaptador";
import { criarPortaTecnicaBrasilNfe } from "./porta-tecnica";
import { conferirIdentidadeBrasilNfe, ErroConsultaBrasilNfe } from "./consulta";
import { ErroHttpBrasilNfe } from "./cliente";
import { sanitizarMetadadosErroBrasilNfe } from "./diagnostico-http";
import { obterClienteHomologacaoBrasilNfe, conferirAcessoAdministrativoBrasilNfe } from "./configuracao";
import { obterPreRequisitosBrasilNfe } from "./pre-requisitos";
import { dataCivilCertificadoBrasilNfe, ufAusenteConferidaNoPainelBrasilNfe, type PreRequisitosBrasilNfe } from "./pre-requisitos-dominio";
import { obterComplementosAprovadosDocumentoBrasilNfe } from "./regras-tributarias";
import { identidadeRegraBrasilNfe } from "./regras-tributarias-dominio";
import { serializarPayloadLocalBrasilNfe } from "./payload-local";
import { exigirBaseHomologacaoControlada, registrarAdaptadorHomologacaoControlada } from "./capacidade-homologacao";
import { conferirXmlHomologacaoBrasilNfe } from "./xml-homologacao";
import { exigirTransmissaoBrasilNfeLiberada, liberacaoTransmissaoBrasilNfe, MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE, transmissaoBrasilNfeLiberada } from "./bloqueio-transmissao";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const registro = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export class ErroHomologacaoBrasilNfe extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = "ErroHomologacaoBrasilNfe"; }
}
const falhar = (m: string): never => { throw new ErroHomologacaoBrasilNfe(m); };
export function pendenciasHomologacaoBrasilNfe(p: PreRequisitosBrasilNfe, modelo: 55 | 65, hoje: string) {
  const e = p.evidenciaPainel, validade = dataCivilCertificadoBrasilNfe(p.certificado.situacao === "VALIDO" ? p.certificado.validade : e?.certificadoValidade);
  return [p.empresaCorrespondente !== true && "Confirmar correspondência do emitente por BuscarEmpresa.",
    p.emitenteExterno.endereco === false && !ufAusenteConferidaNoPainelBrasilNfe(p) && "Cadastro externo do emitente: endereço fiscal não confirmado na leitura de BuscarEmpresa; conferir no painel antes de transmitir.",
    p.emitenteExterno.ie === false && "Cadastro externo do emitente: inscrição estadual não confirmada.",
    p.emitenteExterno.crt === false && "Cadastro externo do emitente: CRT não confirmado.",
    e?.servicoNfeNfceAtivo !== true && "Registrar a evidência identificada de NF-e/NFC-e ativo no painel.",
    e?.homologacaoInformadaPeloUsuario !== true && "Registrar a liberação de homologação informada pelo fornecedor.",
    (!validade || validade < hoje || p.certificado.situacao === "EXPIRADO") && "Conferir certificado válido para a data da transmissão.",
    modelo === 65 && !(p.csc.homologacao.codigo === true && p.csc.homologacao.identificador === true
      || e?.csc.homologacao.codigo === true && e.csc.homologacao.identificador === true) && "Conferir CSC e identificador de homologação da NFC-e."
  ].filter(Boolean) as string[];
}

async function conferirPlano(id: string, sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada(); identidadeRegraBrasilNfe(id);
  const plano = await obterComplementosAprovadosDocumentoBrasilNfe(id, sessao);
  if (!plano?.resultado.montagemConcluida || !plano.resultado.payload) return falhar("Vincule regras aprovadas e resolva a pré-validação local deste documento.");
  const pedido = await prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, select: { pedido: { select: { chaveCriacao: true } } } });
  if (pedido.pedido.chaveCriacao !== `brasilnfe-piloto-${plano.modelo}-2026-v1`) return falhar("A primeira homologação controlada aceita somente os cenários sintéticos preparados nesta base.");
  const contexto = await obterClienteHomologacaoBrasilNfe(sessao);
  const pendencias = pendenciasHomologacaoBrasilNfe(await obterPreRequisitosBrasilNfe(sessao), plano.modelo, new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  if (pendencias.length) return falhar(pendencias.join(" "));
  const hashFiscal = createHash("sha256").update(serializarPayloadLocalBrasilNfe(plano.resultado)).digest("hex");
  return { plano, contexto, hashFiscal };
}
type ComandoHomologacao = { documentoId: string; modelo: 55 | 65; ambiente: 2; hashSnapshot: string; hashPayloadFiscal: string; total: string; autorizarUmaTransmissao: true };
export function validarComandoHomologacaoBrasilNfe(v: unknown): ComandoHomologacao {
  const o = registro(v);
  if (Object.keys(o).length !== 7 || Object.keys(o).some(k => !["documentoId", "modelo", "ambiente", "hashSnapshot", "hashPayloadFiscal", "total", "autorizarUmaTransmissao"].includes(k))
    || ![55, 65].includes(o.modelo as number) || o.ambiente !== 2 || o.autorizarUmaTransmissao !== true
    || ![o.hashSnapshot, o.hashPayloadFiscal].every(h => typeof h === "string" && /^[a-f0-9]{64}$/.test(h))
    || typeof o.total !== "string" || !/^\d{1,12}\.\d{2}$/.test(o.total)) return falhar("A autorização precisa identificar modelo, ambiente, documento, hashes e valor apresentados.");
  return { documentoId: identidadeRegraBrasilNfe(o.documentoId), modelo: o.modelo as 55 | 65, ambiente: 2, hashSnapshot: o.hashSnapshot as string, hashPayloadFiscal: o.hashPayloadFiscal as string, total: o.total, autorizarUmaTransmissao: true };
}
/** A única action de envio registra a aprovação humana exata. Não recebe segredo,
 * payload, ambiente produtivo, adaptador ou autorização genérica do cliente. */
export async function transmitirUmaHomologacaoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  if (!transmissaoBrasilNfeLiberada({ canal: "LEGADO" })) return falhar(MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE);
  const d = validarComandoHomologacaoBrasilNfe(entrada), { plano, contexto, hashFiscal } = await conferirPlano(d.documentoId, sessao);
  if (!plano.evidencia.primeiraEmissaoPendente || plano.modelo !== d.modelo || plano.resultado.hashPayload !== d.hashSnapshot || hashFiscal !== d.hashPayloadFiscal || plano.resultado.payload!.ValorTotal !== d.total) return falhar("A autorização não corresponde à primeira emissão desta fotografia. Atualize o manifesto; não repetir envio.");
  const chave = `homologacao-autorizada:${d.documentoId}`;
  await prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await conferirAcesso(tx, sessao, ["revisar", "fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const doc = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.documentoId } });
    if (doc.hashPayload !== d.hashSnapshot || doc.acao || doc.leaseToken || doc.tentativas || doc.chaveFiscal || !["SEM_EMISSOR", "PREPARADO"].includes(doc.status)
      || await tx.eventoFiscalSaida.count({ where: { documentoId: doc.id, tipo: { not: "PREPARADO" } } })) return falhar("O documento já possui processamento ou autorização registrada. Conferência manual obrigatória.");
    await tx.eventoFiscalSaida.create({ data: { documentoId: doc.id, chave, tipo: "HOMOLOGACAO_AUTORIZADA", dados: json({ ...d, usuarioId: sessao.userId, autorizadoEm: new Date().toISOString(), versaoConfiguracao: contexto.versao, configuracaoEmitenteHash: contexto.emitenteHash, planoId: plano.planoId, parametrosHash: plano.evidencia.parametrosHash, arquivosEsperados: { total: d.total, quantidadeItens: plano.resultado.payload!.Produtos.length, ipiOmitido: plano.resultado.payload!.Produtos.every(p => !Object.hasOwn(p.Imposto, "IPI")) } }) } });
  });
  const adapter = criarAdaptadorManual(sessao, d.documentoId, contexto);
  await executarFiscalSaidaControlado(adapter, d.documentoId, "ENVIAR", "Primeira homologação individual especificamente autorizada.", sessao);
  // Leitura e documentos são ações explícitas posteriores. Falha nelas nunca
  // provoca retransmissão nem apaga a autorização já comprovada.
  return lerResultadoHomologacaoBrasilNfe(d.documentoId, sessao);
}
type Contexto = Awaited<ReturnType<typeof obterClienteHomologacaoBrasilNfe>>;
function criarAdaptadorManual(sessao: SessaoAtual, documentoId: string, contexto: Contexto): AdaptadorFiscalSaida {
  const tecnica = criarPortaTecnicaBrasilNfe(sessao);
  const base = new AdaptadorBrasilNfeM1(contexto.cliente, contexto.emitenteCnpj, {
    ...tecnica,
    async autorizar(operacao, identidade: IdentidadeFiscalSaida) {
      const i = conferirIdentidadeBrasilNfe(identidade);
      if (i.documentoId !== documentoId || i.emitenteCnpj !== contexto.emitenteCnpj) return falhar("Identidade fora da autorização manual.");
      const atual = await obterClienteHomologacaoBrasilNfe(sessao);
      if (atual.versao !== contexto.versao || atual.emitenteHash !== contexto.emitenteHash) return falhar("Configuração alterada; ação manual invalidada.");
      // Revalidar a preparação fiscal antes de consumir a capacidade de envio.
      if (operacao === "ENVIAR") {
        exigirTransmissaoBrasilNfeLiberada({ canal: "LEGADO" });
        const plano = await conferirPlano(documentoId, sessao);
        const externo = await contexto.cliente.buscarEmpresa();
        const cadastro = await prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { enderecoEstruturado: true } });
        const endereco = registro(cadastro.enderecoEstruturado);
        const pre = await obterPreRequisitosBrasilNfe(sessao);
        const ufConferida = externo.endereco.uf ?? (ufAusenteConferidaNoPainelBrasilNfe(pre) ? pre.evidenciaPainel?.ufEmitente : null);
        const ieExterna = externo.inscricaoEstadual && /^[\d.-]{2,20}$/.test(externo.inscricaoEstadual) ? externo.inscricaoEstadual.replace(/[.-]/g, "") : null;
        if (externo.cnpj !== i.emitenteCnpj || externo.crt !== plano.plano.parametros.emitente.crt || ieExterna !== plano.plano.parametros.emitente.ie
          || externo.endereco.cep !== endereco.cep || ufConferida !== endereco.uf || externo.endereco.numero !== endereco.numero
          || externo.endereco.codigoMunicipio !== plano.plano.parametros.emitente.codMunicipio || !externo.endereco.logradouro || !externo.endereco.bairro) return falhar("Cadastro externo não corresponde ao emitente, IE, CRT ou endereço aprovados. Conferir no painel; nenhuma nota foi transmitida.");
        if (i.modeloDocumento === 65 && (!externo.nfceHomologacao.cscConfigurado || !externo.nfceHomologacao.idCscConfigurado)) return falhar("CSC ou identificador de homologação não confirmado na consulta de empresa. Nenhuma NFC-e foi transmitida.");
        await prisma.$transaction(async tx => {
          await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
          await conferirAcesso(tx, sessao, ["revisar", "fiscal"]);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
          const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId } });
          const autorizada = await tx.eventoFiscalSaida.findUnique({ where: { chave: `homologacao-autorizada:${documentoId}` } }), a = registro(autorizada?.dados);
          if (!autorizada || a.usuarioId !== sessao.userId || a.hashSnapshot !== d.hashPayload || a.hashPayloadFiscal !== plano.hashFiscal || a.versaoConfiguracao !== atual.versao
            || a.configuracaoEmitenteHash !== atual.emitenteHash || a.planoId !== plano.plano.planoId || a.parametrosHash !== plano.plano.evidencia.parametrosHash || a.modelo !== i.modeloDocumento
            || d.ambiente !== "HOMOLOGACAO" || d.acao !== "ENVIAR" || d.status !== "PROCESSANDO" || d.tentativas !== 1 || !d.leaseToken || !d.leaseAte || d.leaseAte <= new Date()
            || await tx.eventoFiscalSaida.findUnique({ where: { chave: `homologacao-consumida:${documentoId}` } })) return falhar("Autorização consumida, divergente ou sem trava ativa. Não reenviar.");
          await tx.eventoFiscalSaida.create({ data: { documentoId, chave: `homologacao-consumida:${documentoId}`, tipo: "HOMOLOGACAO_EXECUCAO_INICIADA", dados: { usuarioId: sessao.userId, leaseToken: d.leaseToken, hashPayloadFiscal: plano.hashFiscal, ambiente: 2, modelo: i.modeloDocumento } } });
        });
      } else {
        if (operacao === "CANCELAR") return falhar("Cancelamento real exige aprovação específica ainda não habilitada neste piloto.");
        await prisma.$transaction(async tx => {
          await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
          await conferirAcesso(tx, sessao, ["fiscal"]);
          const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId } });
          const autorizada = await tx.eventoFiscalSaida.findUnique({ where: { chave: `homologacao-autorizada:${documentoId}` } }), a = registro(autorizada?.dados);
          if (d.provedor !== "BRASIL_NFE" || d.ambiente !== "HOMOLOGACAO" || d.modeloDocumento !== i.modeloDocumento || !autorizada || a.hashSnapshot !== d.hashPayload
            || a.versaoConfiguracao !== atual.versao || a.configuracaoEmitenteHash !== atual.emitenteHash) return falhar("Leitura fora da identidade e configuração originalmente autorizadas.");
        });
      }
    },
  });
  async function conferirFalha<T>(operacao: "ENVIAR" | "CONSULTAR", acao: () => Promise<T>): Promise<T> {
    try {
      const r = await acao();
      if (operacao === "CONSULTAR" && registro(r).status === "AUTORIZADO") {
        const resultado = registro(r);
        await prisma.eventoFiscalSaida.upsert({ where: { chave: `homologacao-consulta-confirmada:${documentoId}:${resultado.eventoId}` }, create: { documentoId, chave: `homologacao-consulta-confirmada:${documentoId}:${resultado.eventoId}`, tipo: "HOMOLOGACAO_CONSULTA_CONFIRMADA", dados: json({ ambiente: 2, chave: resultado.chave, protocolo: resultado.protocolo }) }, update: {} });
      }
      return r;
    }
    catch (erro) {
      // Nunca conservar Error, cause, texto externo ou resposta original. A falha
      // continua sendo lançada para a fila bloquear qualquer reenvio incerto.
      const metadados = sanitizarMetadadosErroBrasilNfe(erro instanceof ErroHttpBrasilNfe || erro instanceof ErroConsultaBrasilNfe ? erro.diagnosticoSeguro : null);
      await prisma.$transaction(async tx => {
        await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
        await conferirAcesso(tx, sessao, ["fiscal"]);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
        const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, select: { ambiente: true, provedor: true, acao: true, status: true, leaseToken: true } });
        if (d.ambiente !== "HOMOLOGACAO" || d.provedor !== "BRASIL_NFE" || d.acao !== operacao || operacao === "ENVIAR" && d.status !== "PROCESSANDO" || !d.leaseToken) return;
        const chave = `homologacao-falha:${documentoId}:${operacao}:${d.leaseToken}`;
        await tx.eventoFiscalSaida.upsert({ where: { chave }, create: { documentoId, chave, tipo: "HOMOLOGACAO_FALHA_TECNICA", dados: json({ operacao, metadados, classificacao: metadados ? "HTTP_CLIENTE" : "FALHA_LOCAL_NAO_CLASSIFICADA" }) }, update: {} });
      });
      throw erro;
    }
  }
  // Composição explícita, sem retirar o bloqueio da instância técnica global.
  return registrarAdaptadorHomologacaoControlada({ id: base.id, ambiente: base.ambiente, enviar: async (i, p) => { exigirTransmissaoBrasilNfeLiberada({ canal: "LEGADO" }); return conferirFalha("ENVIAR", () => base.enviar(i, p)); }, consultar: i => conferirFalha("CONSULTAR", () => base.consultar(i)), cancelar: base.cancelar.bind(base),
    async obterDocumentos(i) {
      const arquivos = await base.obterDocumentos(i);
      const evento = await prisma.eventoFiscalSaida.findUniqueOrThrow({ where: { chave: `homologacao-autorizada:${documentoId}` }, select: { dados: true } });
      conferirXmlHomologacaoBrasilNfe(arquivos.xml, registro(evento.dados).arquivosEsperados);
      return arquivos;
    }, autenticarRetorno: async () => null });
}
export async function consultarHomologacaoBrasilNfe(id: string, sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada(); identidadeRegraBrasilNfe(id);
  const contexto = await obterClienteHomologacaoBrasilNfe(sessao), adapter = criarAdaptadorManual(sessao, id, contexto);
  await executarFiscalSaidaControlado(adapter, id, "CONSULTAR", "Consulta manual exclusiva do próprio piloto.", sessao);
  return lerResultadoHomologacaoBrasilNfe(id, sessao);
}
export async function baixarDocumentosHomologacaoBrasilNfe(id: string, sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada(); identidadeRegraBrasilNfe(id);
  const contexto = await obterClienteHomologacaoBrasilNfe(sessao);
  await obterArquivosFiscalSaidaControlado(criarAdaptadorManual(sessao, id, contexto), id, sessao);
  return lerResultadoHomologacaoBrasilNfe(id, sessao);
}
export async function lerResultadoHomologacaoBrasilNfe(id: string, sessao: SessaoAtual) {
  identidadeRegraBrasilNfe(id);
  return prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "visualizar");
    await conferirAcesso(tx, sessao, ["consultar"]);
    const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, select: { id: true, pedidoId: true, status: true, ambiente: true, modeloDocumento: true, chaveFiscal: true, numero: true, serie: true, protocolo: true, ultimoErro: true, tentativas: true, eventos: { orderBy: { createdAt: "desc" }, take: 30, select: { tipo: true, createdAt: true } } } });
    const arquivos = await tx.$queryRaw<{ xml: boolean; pdf: boolean; html: boolean }[]>`SELECT xml IS NOT NULL AS xml, pdf IS NOT NULL AS pdf, html IS NOT NULL AS html FROM "DocumentoFiscalSaida" WHERE id=${id}`;
    const falha = await tx.eventoFiscalSaida.findFirst({ where: { documentoId: id, tipo: "HOMOLOGACAO_FALHA_TECNICA" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true, dados: true } });
    const dados = registro(falha?.dados);
    const falhaTecnica = falha && ["ENVIAR", "CONSULTAR"].includes(dados.operacao as string) ? { em: falha.createdAt, operacao: dados.operacao as "ENVIAR" | "CONSULTAR", metadados: sanitizarMetadadosErroBrasilNfe(dados.metadados) } : null;
    return { ...d, arquivos: arquivos[0], falhaTecnica, liberacaoTransmissao: liberacaoTransmissaoBrasilNfe(), producaoBloqueada: true as const, reenvioAutomatico: false as const };
  });
}
