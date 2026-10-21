import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { identidadeFiscalCobranca } from "@/lib/vendas/cliente-cobranca";
import { acompanhamentoDoPedido } from "@/lib/ifood/acompanhamento";
import { MUNICIPIOS_NFSE } from "@/lib/nfse/municipios";
import type { AdaptadorFiscalSaida } from "../contrato";
import { conferirCalculoAtualFiscalSaida, consultarFiscalSaida, executarFiscalSaidaManual, obterArquivosFiscalSaidaManual, prepararFiscalSaida, whereAmbienteConflitanteFiscalSaida } from "../servico";
import { obterAdaptadorFiscalSaida } from "../provedor";
import { AdaptadorBrasilNfeM1 } from "./adaptador";
import { conferirFciXmlBrasilNfe } from "./arquivos";
import { conferirTotaisDocumentoXmlBrasilNfe } from "./conferencia-totais-xml";
import { criarPortaTecnicaBrasilNfe } from "./porta-tecnica";
import { conferirIdentidadeBrasilNfe, ErroConsultaBrasilNfe } from "./consulta";
import { obterClienteHomologacaoBrasilNfe, conferirAcessoAdministrativoBrasilNfe } from "./configuracao";
import { ErroHttpBrasilNfe } from "./cliente";
import { sanitizarMetadadosErroBrasilNfe } from "./diagnostico-http";
import { obterPreRequisitosBrasilNfe, obterPreRequisitosEmissaoBrasilNfe } from "./pre-requisitos";
import { obterRegimeFiscalEmpresaBrasilNfe } from "./regime-empresa";
import { dataCivilCertificadoBrasilNfe, restaurarPreRequisitosBrasilNfe, ufAusenteConferidaNoPainelBrasilNfe } from "./pre-requisitos-dominio";
import { diaOperacaoDocumentoBrasilNfe, listarRegrasTributariasBrasilNfe, obterComplementosAprovadosDocumentoBrasilNfe as obterPlanoLegado, obterHistoricoRegraTributariaBrasilNfe, vincularRegrasDocumentoBrasilNfe } from "./regras-tributarias";
import { hojeCivilRegraBrasilNfe, identidadeRegraBrasilNfe, vigenteRegraFiscalBrasilNfe, ErroRegraFiscalBrasilNfe } from "./regras-tributarias-dominio";
import { prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "./payload-local";
import type { ParametrosPayloadLocalBrasilNfe, ResultadoPayloadLocalBrasilNfe } from "./payload-local-tipos";
import { aprovarRevisaoConsolidadaNaTransacao, conferirVigenciaSnapshotFiscal, hashFiscal, hashRevisaoConsolidadaGrazing1 } from "@/lib/tributacao/servico";
import { PRODUTO_DECLARACAO_FCI_GRAZING1, AVISO_DECLARACAO_FCI } from "@/lib/tributacao/declaracao-fci";
import type { ComplementosDocumentoBrasilNfe } from "./regras-tributarias-dominio";
import { registrarCapacidadeEmissaoManualBrasilNfe } from "./capacidade-operacional";
import { consultarNumeracaoFiscalBrasilNfe, obterNumeracaoFiscalBrasilNfe, type NumeracaoFiscalBrasilNfeDto } from "./numeracao";
import { executarComAutorizacaoManualBrasilNfe, exigirTransmissaoBrasilNfeLiberada, liberacaoTransmissaoBrasilNfe } from "./bloqueio-transmissao";
import { ErroEmissaoPedidoBrasilNfe, habilitacaoCorrespondeBrasilNfe, restaurarHabilitacaoEmissaoBrasilNfe, validarComandoEmissaoPedidoBrasilNfe, validarDecisaoProducao65BrasilNfe, selarDecisaoProducao65BrasilNfe, type DecisaoProducao65BrasilNfe, type AmbienteEmissaoBrasilNfe, type HabilitacaoEmissaoBrasilNfe } from "./operacional-dominio";
export { ErroEmissaoPedidoBrasilNfe } from "./operacional-dominio";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const texto = (v: unknown, max = 200): string | null => typeof v === "string" && v.length <= max && !/[\p{C}<>]/u.test(v) ? v : null;
const falhar = (m: string): never => { throw new ErroEmissaoPedidoBrasilNfe(m); };
const linkRegras = "/financeiro/fiscal/cobertura?aba=regras";
const linkIntegracao = "/configuracoes/integracoes/brasilnfe";
type PlanoOperacional = { planoId: string; modelo: 55 | 65; ambiente: AmbienteEmissaoBrasilNfe; resultado: ResultadoPayloadLocalBrasilNfe;
  parametros: { emitente: ParametrosPayloadLocalBrasilNfe["emitente"] }; evidencia: { primeiraEmissaoPendente: boolean; parametrosHash: string } };
async function obterComplementosAprovadosDocumentoBrasilNfe(id: string, sessao: SessaoAtual, opcoes: { somentePrevia?: boolean } = {}): Promise<PlanoOperacional | null> {
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar", "fiscal"]);
    const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, include: { pedido: true, _count: { select: { eventos: { where: { tipo: { notIn: ["PREPARADO", "EMISSAO_MANUAL_REVISAO_HOMOLOGACAO"] } } } } } } });
    if (objeto(d.payload).versao === 1) return null;
    const t = objeto(objeto(d.payload).tributacao), documento = objeto(t.documento), modelo = documento.ModeloDocumento;
    if (t.apto !== true) return null; // Prévia pendente continua legível sem perfil/configuração aprovados.
    if (modelo !== 55 && modelo !== 65 || ![1, 2].includes(documento.TipoAmbiente as number)) return falhar("Fotografia fiscal v2 inválida. Reprepare pelo motor único do HUB.");
    const modeloFiscal: 55 | 65 = modelo;
    const ambiente: AmbienteEmissaoBrasilNfe = documento.TipoAmbiente === 1 ? "PRODUCAO" : "HOMOLOGACAO";
    const revisao = objeto(t.revisaoConsolidada);
    const propostas = revisao.tipo === "PROPOSTAS_PARA_REVISAO" && revisao.aprovacaoInterna === false && Array.isArray(revisao.versoes);
    const provaHomologacao = propostas && ambiente === "HOMOLOGACAO" && modelo === 55 ? await tx.eventoFiscalSaida.findFirst({ where: { documentoId: d.id, tipo: "EMISSAO_MANUAL_REVISAO_HOMOLOGACAO", dados: { path: ["hashSnapshot"], equals: d.hashPayload } }, select: { dados: true } }) : null;
    const dadosProva = objeto(provaHomologacao?.dados);
    const propostaConferida = propostas && (opcoes.somentePrevia === true || dadosProva.hashVersoes === hashFiscal(revisao.versoes) && dadosProva.aprovacaoInterna === false && dadosProva.finalidade === "TESTE_HOMOLOGACAO" && typeof dadosProva.usuarioId === "string");
    if (!propostaConferida) await conferirVigenciaSnapshotFiscal(tx, d.payload);
    const loja = await tx.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { cnpj: true, enderecoEstruturado: true } }), endereco = objeto(loja.enderecoEstruturado);
    let resultado = prepararPayloadSnapshotBrasilNfeLocal(d, modelo, { cnpj: String(loja.cnpj ?? "").replace(/[.\/-]/g, ""), ambiente, ...(opcoes.somentePrevia ? { somentePrevia: true } : {}) });
    if (resultado.montagemConcluida) {
      const linhas = objeto(t.previa).linhas;
      const ids = [...new Set(Array.isArray(linhas) ? linhas.flatMap(l => Array.isArray(objeto(l).versoes) ? objeto(l).versoes as unknown[] : []).filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id)) : [])];
      if (!ids.length || ids.length > 5000) return falhar("Versões fiscais ausentes ou fora do limite da fotografia.");
      const versoes = await tx.versaoEstruturaFiscal.findMany({ where: { id: { in: ids } }, select: { id: true, tipo: true, chave: true, status: true, dados: true, hash: true, fontes: true, eventos: { where: { tipo: "ATIVACAO" }, select: { usuarioId: true, dados: true }, take: 1 } } });
      const revisadas = propostas ? revisao.versoes as unknown[] : [];
      const semProva = versoes.filter(v => hashFiscal(v.dados) !== v.hash || !Array.isArray(v.fontes) || !v.fontes.length || !(v.status === "ATIVO" && (v.tipo === "TABELA" || !!v.eventos[0]?.usuarioId && objeto(v.eventos[0].dados).hashConteudo === v.hash)
        || propostaConferida && revisadas.some(r => objeto(r).id === v.id && objeto(r).hash === v.hash && objeto(r).statusOriginal === v.status)));
      if (versoes.length !== ids.length || semProva.length) resultado = { ...resultado, montagemConcluida: false, payload: null, pendencias: [...resultado.pendencias,
        { campo: "versoes.aprovacao", codigo: "AUSENTE", motivo: `Conferir a aprovação interna auditada e os hashes das versões fiscais${semProva.length ? `: ${semProva.map(v => `${v.tipo} ${v.chave}`).join(", ").slice(0, 500)}` : ""}. Versão ativa sem prova não libera transmissão.`, responsavel: "REVISAO_FISCAL", operacao: modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA" }] };
    }
    return { planoId: `snapshot-v2:${d.id}`, modelo: modeloFiscal, ambiente, resultado, parametros: { emitente: { crt: t.crt as 1 | 2 | 3 | 4, ie: String(t.emitenteIE ?? ""), codMunicipio: String(endereco.codMunicipio ?? endereco.codigoMunicipio ?? ""), codPais: 1058, pais: "BRASIL" } },
      evidencia: { parametrosHash: hashFiscal(t), primeiraEmissaoPendente: ["SEM_EMISSOR", "PREPARADO"].includes(d.status) && !d.tentativas && !d.acao && !d.leaseToken && !d.referenciaProvedor && !d.chaveFiscal && !d.protocolo && !d._count.eventos
        && d.pedido.status === "CONFIRMADO" && d.pedido.versao === d.versaoPedido } };
  }).then(async resultado => resultado ?? obterPlanoLegado(id, sessao));
}
export type PendenciaEmissaoPedidoBrasilNfe = { campo: string; mensagem: string; href: string };
export type ContextoPreparacaoFiscalPedido = { indicadorPresenca?: 1 | 2 | 3 | 4 | 5 | 9; pagamentoCartaoNaoIntegrado?: true; revisaoConsolidada?: { versoes: { id: string; hash: string }[]; confirmarAprovacao: boolean } };
export type PreviaEmissaoPedidoBrasilNfe = {
  pedidoId: string; numeroPedido: number; versaoPedido: number; modelo: 55 | 65; ambiente: AmbienteEmissaoBrasilNfe;
  ambientesDisponiveis: AmbienteEmissaoBrasilNfe[]; modeloSugerido: 55 | 65;
  emitente: { nome: string | null; cnpj: string | null; ie: string | null; crtDescricao: string | null };
  destinatario: { nome: string | null; documento: string | null; endereco: string | null };
  itens: { id: string; produtoId: string; nome: string; quantidade: string; unidade: string; total: string;
    fiscal?: { ncm: string | null; cfop: string | null; origem: string | null; icms: string | null; pis: string | null; cofins: string | null } | null }[];
  liberacaoTransmissao: { liberada: boolean; motivo: string | null };
  avisoHabilitacao?: string;
  contextoOperacao?: { indicadorPresenca: 1 | 2 | 3 | 4 | 5 | 9 | null; exigeEscolhaPresenca: boolean; consumidorFinal?: boolean | null };
  revisaoConsolidada?: { hash: string; pendente: boolean; podeAprovar: boolean; versoes: { id: string; hash: string; tipo: string; rotulo: string; status: string }[]; parametros: { campo: string; rotulo: string; valor: string }[]; declaracoes: string[] };
  controleManual?: { suspensa: boolean; motivo: string | null };
  numeracao?: NumeracaoFiscalBrasilNfeDto | null;
  total: string; valores: { subtotal: string; desconto: string; frete: string; outrosCustos: string }; pendencias: PendenciaEmissaoPedidoBrasilNfe[]; podeEmitir: boolean;
  documento: null | { id: string; versaoPedido: number; provedor: string | null; referenciaProvedor: string | null; modeloDocumento: number | null; status: string; ambiente: string; hashSnapshot: string; hashPayloadFiscal: string | null;
    numero: string | null; serie: string | null; chaveFiscal: string | null; protocolo: string | null; ultimoErro: string | null;
    xmlDisponivel: boolean; formatoImpressao: "PDF" | "HTML" | null; tentativas: number; cancelamentoPendente?: boolean; cancelamentoSolicitado?: boolean; eventos: { id: string; tipo: string; createdAt: Date }[] };
};
async function habilitacao(tx: Prisma.TransactionClient, ambiente: AmbienteEmissaoBrasilNfe) {
  const eventos = await tx.eventoConfiguracaoBrasilNfe.findMany({ where: { configuracaoId: "singleton", tipo: "EMISSAO_MANUAL_HABILITACAO" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, dados: true, createdAt: true } });
  // O último registro do ambiente prevalece. Registro inválido não reativa o anterior.
  for (const e of eventos) if (objeto(e.dados).ambiente === ambiente) return restaurarHabilitacaoEmissaoBrasilNfe(e.id, e.dados, e.createdAt);
  return null;
}
export type ControleEmissaoBrasilNfeDto = {
  homologacao: HabilitacaoEmissaoBrasilNfe | null; producao: HabilitacaoEmissaoBrasilNfe | null;
  correspondentes: { homologacao: boolean; producao: boolean };
  requisitos: { ambiente: AmbienteEmissaoBrasilNfe; modelo: 55 | 65; pendencias: string[]; homologacaoNaoComprovada?: true; permiteAceiteAdministrativo?: true }[];
  documentosHomologados: { id: string; modelo: 55 | 65; numero: string | null; serie: string | null }[];
  automatica: false; callback: false;
  habilitacaoManualDisponivel?: true;
  liberacaoTransmissao: { liberada: boolean; motivo: string | null };
};
export type ResultadoControleEmissaoBrasilNfe = { ok: true; dados: ControleEmissaoBrasilNfeDto } | { ok: false; erro: string };
function possuiProvaConsultaHomologacao(d: { chaveFiscal: string | null; protocolo: string | null; eventos: { tipo: string; dados: unknown }[] }) {
  // A observação é feita antes de a fila aplicar o retorno. Um retorno divergente
  // pode ficar no histórico, mas não comprova a identidade autorizada persistida.
  return !!d.chaveFiscal && !!d.protocolo && d.eventos.some(e => e.tipo === "ARQUIVOS_PROVEDOR") && d.eventos.some(e => {
    const p = objeto(e.dados);
    return ["HOMOLOGACAO_CONSULTA_CONFIRMADA", "EMISSAO_MANUAL_CONSULTA_CONFIRMADA"].includes(e.tipo) && p.chave === d.chaveFiscal && p.protocolo === d.protocolo && [2, "HOMOLOGACAO"].includes(p.ambiente as 2 | "HOMOLOGACAO");
  });
}
export async function obterHabilitacaoEmissaoBrasilNfe(sessao: SessaoAtual): Promise<ControleEmissaoBrasilNfeDto> {
  const contexto = await prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "visualizar"); await conferirAcesso(tx, sessao, ["consultar", "fiscal"]);
    const config = await tx.configuracaoBrasilNfe.findUnique({ where: { id: "singleton" }, select: { versao: true } });
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
    return { versao: config?.versao ?? 0, emitenteHash: createHash("sha256").update(JSON.stringify(loja)).digest("hex"), emitenteCnpj: String(loja?.cnpj ?? "").replace(/[.\/-]/g, "") };
  });
  const controle = await prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "visualizar");
    await conferirAcesso(tx, sessao, ["consultar", "fiscal"]);
    const documentos = await tx.documentoFiscalSaida.findMany({ where: { provedor: "BRASIL_NFE", ambiente: "HOMOLOGACAO", modeloDocumento: { in: [55, 65] }, status: "AUTORIZADO", chaveFiscal: { not: null }, protocolo: { not: null }, xml: { not: null }, OR: [{ pdf: { not: null } }, { html: { not: null } }], eventos: { some: { tipo: { in: ["HOMOLOGACAO_CONSULTA_CONFIRMADA", "EMISSAO_MANUAL_CONSULTA_CONFIRMADA"] } } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, modeloDocumento: true, numero: true, serie: true, chaveFiscal: true, protocolo: true, payload: true, planoBrasilNfe: { select: { emitenteHash: true } }, eventos: { where: { tipo: { in: ["ARQUIVOS_PROVEDOR", "HOMOLOGACAO_CONSULTA_CONFIRMADA", "EMISSAO_MANUAL_CONSULTA_CONFIRMADA"] } }, select: { tipo: true, dados: true }, take: 100 } } });
    const documentosHomologados = documentos.filter(d => possuiProvaConsultaHomologacao(d) && objeto(objeto(d.payload).emitente).cnpj === contexto.emitenteCnpj && (d.planoBrasilNfe || objeto(d.payload).versao === 2)).map(d => ({ id: d.id, modelo: d.modeloDocumento as 55 | 65, numero: d.numero, serie: d.serie }));
    const homologacao = await habilitacao(tx, "HOMOLOGACAO"), producao = await habilitacao(tx, "PRODUCAO");
    const corresponde = (h: HabilitacaoEmissaoBrasilNfe | null) => !!h && h.versaoConfiguracao === contexto.versao && h.emitenteHash === contexto.emitenteHash;
    return { homologacao, producao, documentosHomologados, correspondentes: { homologacao: corresponde(homologacao), producao: corresponde(producao) }, automatica: false as const, callback: false as const };
  });
  const requisitos: ControleEmissaoBrasilNfeDto["requisitos"] = [];
  for (const ambiente of ["HOMOLOGACAO", "PRODUCAO"] as const) for (const modelo of [55, 65] as const) {
    const pendencias = (await pendenciasAmbiente(sessao, modelo, ambiente)).map(p => p.mensagem);
    const semProva = ambiente === "PRODUCAO" && !controle.documentosHomologados.some(d => d.modelo === modelo);
    if (semProva && modelo === 55) pendencias.push(`Modelo ${modelo}: concluir homologação autorizada, consulta posterior, XML e impressão no HUB.`);
    requisitos.push({ ambiente, modelo, pendencias, ...(semProva && modelo === 65 ? { homologacaoNaoComprovada: true, permiteAceiteAdministrativo: true } : {}) });
  }
  return { ...controle, requisitos, habilitacaoManualDisponivel: true, liberacaoTransmissao: liberacaoTransmissaoBrasilNfe() };
}
/** Registro append-only. Habilitar o ambiente não autoriza nenhuma nota e nunca
 * habilita o processador automático. NF-e exige prova própria de homologação.
 * NFC-e pode usar decisão administrativa explícita, sem declarar homologação.
 * A decisão não aprova tributos nem autoriza transmissão de qualquer documento. */
export async function configurarHabilitacaoEmissaoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  const e = objeto(entrada);
  if (Object.keys(e).some(k => !["ambiente", "revisao", "habilitada", "modelos", "documentosHomologados", "confirmarAtivacao", "decisaoProducao65"].includes(k))
    || !["HOMOLOGACAO", "PRODUCAO"].includes(e.ambiente as string) || typeof e.habilitada !== "boolean" || e.confirmarAtivacao !== true
    || !Number.isSafeInteger(e.revisao) || (e.revisao as number) < 0 || !Array.isArray(e.modelos) || !e.modelos.length || e.modelos.length > 2 || e.modelos.some(m => m !== 55 && m !== 65) || new Set(e.modelos).size !== e.modelos.length
    || !Array.isArray(e.documentosHomologados) || e.documentosHomologados.length > 2 || e.documentosHomologados.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id))) return falhar("Confira o ambiente, a revisão, os modelos e a confirmação específica de habilitação manual.");
  const ambiente = e.ambiente as AmbienteEmissaoBrasilNfe, contexto = await obterClienteHomologacaoBrasilNfe(sessao, ambiente);
  const decisao = e.decisaoProducao65 === undefined ? undefined : validarDecisaoProducao65BrasilNfe(e.decisaoProducao65);
  if (decisao && (ambiente !== "PRODUCAO" || !e.habilitada || !(e.modelos as number[]).includes(65))) return falhar("A decisão administrativa é exclusiva da habilitação manual de NFC-e em produção.");
  if (e.habilitada) for (const modelo of e.modelos as (55 | 65)[]) {
    const pendencias = await pendenciasAmbiente(sessao, modelo, ambiente);
    if (pendencias.length) return falhar(`Modelo ${modelo}: ${pendencias.map(p => p.mensagem).join(" ")}`);
  }
  return prisma.$transaction(async tx => {
    const usuarioId = await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await conferirAcesso(tx, sessao, ["consultar", "fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const anterior = await habilitacao(tx, ambiente);
    if ((anterior?.revisao ?? 0) !== e.revisao) return falhar("A habilitação mudou. Atualize a tela antes de confirmar.");
    const c = await tx.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    if (c.versao !== contexto.versao) return falhar("As credenciais ou a configuração mudaram. Refaça a conferência.");
    let decisaoProducao65: DecisaoProducao65BrasilNfe | undefined;
    if (ambiente === "PRODUCAO" && e.habilitada) for (const modelo of e.modelos as (55 | 65)[]) {
      const d = await tx.documentoFiscalSaida.findFirst({ where: { id: { in: e.documentosHomologados as string[] }, provedor: "BRASIL_NFE", ambiente: "HOMOLOGACAO", modeloDocumento: modelo, status: "AUTORIZADO", chaveFiscal: { not: null }, protocolo: { not: null }, xml: { not: null }, OR: [{ pdf: { not: null } }, { html: { not: null } }], eventos: { some: { tipo: { in: ["HOMOLOGACAO_CONSULTA_CONFIRMADA", "EMISSAO_MANUAL_CONSULTA_CONFIRMADA"] } } } }, select: { id: true, chaveFiscal: true, protocolo: true, payload: true, planoBrasilNfe: { select: { emitenteHash: true } }, eventos: { where: { tipo: { in: ["ARQUIVOS_PROVEDOR", "HOMOLOGACAO_CONSULTA_CONFIRMADA", "EMISSAO_MANUAL_CONSULTA_CONFIRMADA"] } }, select: { tipo: true, dados: true }, take: 100 } } });
      if (!d || !possuiProvaConsultaHomologacao(d) || objeto(objeto(d.payload).emitente).cnpj !== contexto.emitenteCnpj || !d.planoBrasilNfe && objeto(d.payload).versao !== 2) {
        if (modelo !== 65 || !decisao) return falhar(`Modelo ${modelo}: concluir e conferir a homologação, com consulta posterior, XML e impressão, antes de habilitar produção. Para NFC-e, existe também a decisão administrativa explícita, sem prova local de homologação.`);
        // Releitura na mesma transação. Nenhum valor de CSC entra no evento.
        const pre = restaurarPreRequisitosBrasilNfe(c.preRequisitosEmitenteHash === contexto.emitenteHash ? c.preRequisitos : null, c.versao);
        const idade = pre.empresaVerificadaEm ? Date.now() - Date.parse(pre.empresaVerificadaEm) : Infinity;
        if (pre.empresaCorrespondente !== true || pre.empresaFalha || pre.csc.producao.codigo !== true || pre.csc.producao.identificador !== true || idade < 0 || idade > 30 * 60_000) return falhar("Confira certificado e CSC pelo botão protegido antes da decisão administrativa de NFC-e. A leitura deve ter até 30 minutos e corresponder ao emitente atual.");
        const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, nome: true } });
        decisaoProducao65 = selarDecisaoProducao65BrasilNfe(decisao, { versaoConfiguracao: contexto.versao, emitenteHash: contexto.emitenteHash, cscProducaoVerificadoEm: pre.empresaVerificadaEm!, autor: { userId: usuario.id, nome: usuario.nome }, registradaEm: new Date().toISOString() });
      }
    }
    const dados = { revisao: (e.revisao as number) + 1, ambiente, habilitada: e.habilitada, modelos: e.modelos, documentosHomologados: e.documentosHomologados, versaoConfiguracao: contexto.versao, emitenteHash: contexto.emitenteHash, automatica: false, callback: false, ...(decisaoProducao65 ? { decisaoProducao65 } : {}) };
    const novo = await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: "singleton", usuarioId, tipo: "EMISSAO_MANUAL_HABILITACAO", dados: json(dados) } });
    return restaurarHabilitacaoEmissaoBrasilNfe(novo.id, novo.dados, novo.createdAt)!;
  });
}
async function pendenciasAmbiente(sessao: SessaoAtual, modelo: 55 | 65, ambiente: AmbienteEmissaoBrasilNfe) {
  const p = await obterPreRequisitosEmissaoBrasilNfe(sessao), e = p.evidenciaPainel;
  const validade = dataCivilCertificadoBrasilNfe(p.certificado.situacao === "VALIDO" ? p.certificado.validade : e?.certificadoValidade);
  const pendencias: PendenciaEmissaoPedidoBrasilNfe[] = [];
  const add = (campo: string, mensagem: string) => pendencias.push({ campo, mensagem, href: linkIntegracao });
  if (p.empresaCorrespondente !== true) add("emitente", "Confirmar correspondência do emitente no Brasil NFe.");
  if (e?.servicoNfeNfceAtivo !== true) add("servico", "Conferir e registrar o serviço NF-e/NFC-e ativo para este emitente.");
  if (!validade || validade < hojeCivilRegraBrasilNfe() || p.certificado.situacao === "EXPIRADO") add("certificado", "Conferir certificado vigente para emitir.");
  if (ambiente === "HOMOLOGACAO" && e?.homologacaoInformadaPeloUsuario !== true) add("homologacao", "Confirmar a liberação do fornecedor para homologação.");
  const csc = ambiente === "HOMOLOGACAO" ? p.csc.homologacao : p.csc.producao;
  if (modelo === 65 && (csc.codigo !== true || csc.identificador !== true)) add("csc", `Conferir CSC e identificador de ${ambiente === "HOMOLOGACAO" ? "homologação" : "produção"} pelo canal protegido. Somente presença confirmada por consulta é aceita.`);
  return pendencias;
}
async function conferirSequenciaManual(sessao: SessaoAtual, modelo: 55 | 65, ambiente: AmbienteEmissaoBrasilNfe, versao: number) {
  let numeracao = await obterNumeracaoFiscalBrasilNfe(sessao);
  const idade = numeracao.consulta.consultadoEm ? Date.now() - Date.parse(numeracao.consulta.consultadoEm) : Infinity;
  if (numeracao.consulta.situacao !== "CONCLUIDA" || idade < 0 || idade > 30_000) numeracao = await consultarNumeracaoFiscalBrasilNfe({ versao }, sessao);
  const linhas = numeracao.linhas.filter(l => l.modelo === modelo && l.ambiente === (ambiente === "PRODUCAO" ? 1 : 2) && l.padrao);
  const serie = modelo === 55 ? "6" : "7";
  if (numeracao.consulta.situacao !== "CONCLUIDA" || numeracao.versaoConfiguracao !== versao || linhas.length !== 1 || linhas[0].serie !== serie || linhas[0].divergencia) return falhar(`Conferir a série padrão ${serie} e o contador do modelo ${modelo} neste ambiente. Nenhuma numeração foi alterada ou reservada.`);
  return { modelo, ambiente, serie, proximoNumero: linhas[0].proximoNumero, consultadoEm: numeracao.consulta.consultadoEm, origem: "BRASIL_NFE" };
}
function enderecoFiscalFotografado(payload: unknown): ComplementosDocumentoBrasilNfe["destinatario"] | null {
  // Endereço de cobrança é a fonte fiscal explícita. Não usar entrega por fallback.
  const e = objeto(objeto(payload).cobranca), cidade = texto(e.cidade, 60), uf = texto(e.uf, 2);
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const municipio = cidade && uf ? MUNICIPIOS_NFSE.filter(m => m.uf === uf && normalizar(m.nome) === normalizar(cidade)) : [];
  const codigo = texto(e.codMunicipio ?? e.codigoMunicipio, 7) ?? (municipio.length === 1 ? municipio[0].codigo : null);
  const cep = texto(e.cep, 9)?.replace(/-/g, ""), logradouro = texto(e.logradouro, 60), numero = texto(e.numero, 60), bairro = texto(e.bairro, 60);
  if (!cep || !/^\d{8}$/.test(cep) || !logradouro || !numero || !bairro || !cidade || !uf || !codigo || !/^\d{7}$/.test(codigo)
    || (e.pais != null && !["BRASIL", "Brasil", "BR"].includes(e.pais as string))) return null;
  return { cep, logradouro, numero, bairro, cidade, uf, codMunicipio: codigo, codPais: 1058, pais: "BRASIL", ...(texto(e.complemento, 60) ? { complemento: texto(e.complemento, 60)! } : {}) };
}
async function selecionarPropostasPedido(pedidoId: string, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"], pedidoId);
    const item = await tx.itemPedidoVenda.findFirst({ where: { pedidoId, vigente: true, produtoId: PRODUTO_DECLARACAO_FCI_GRAZING1 }, select: { id: true } });
    if (!item) return [];
    const dia = hojeCivilRegraBrasilNfe();
    const candidatos = await tx.versaoEstruturaFiscal.findMany({ where: { vigenciaInicio: { lte: new Date(`${dia}T00:00:00Z`) }, OR: [{ tipo: "CLASSIFICACAO", chave: PRODUTO_DECLARACAO_FCI_GRAZING1 }, { tipo: "REGRA", dados: { path: ["produtoId"], equals: PRODUTO_DECLARACAO_FCI_GRAZING1 } }] }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: { id: true, hash: true, tipo: true, chave: true, status: true } });
    const latest = new Map<string, typeof candidatos[number]>();
    for (const v of candidatos) if (!latest.has(`${v.tipo}:${v.chave}`)) latest.set(`${v.tipo}:${v.chave}`, v);
    return [...latest.values()].filter(v => v.status === "RASCUNHO").map(v => ({ id: v.id, hash: v.hash }));
  });
}
async function resumoRevisaoConsolidada(t: Record<string, unknown>, sessao: SessaoAtual): Promise<NonNullable<PreviaEmissaoPedidoBrasilNfe["revisaoConsolidada"]>> {
  const r = objeto(t.revisaoConsolidada), selecionadas = (Array.isArray(r.versoes) ? r.versoes : []).map(v => ({ id: String(objeto(v).id), hash: String(objeto(v).hash) }));
  const versoes = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["consultar", "fiscal"]); return tx.versaoEstruturaFiscal.findMany({ where: { id: { in: selecionadas.map(v => v.id) } }, select: { id: true, hash: true, tipo: true, chave: true, versao: true, status: true, dados: true } }); });
  const linhas = objeto(t.previa).linhas, parametros: NonNullable<PreviaEmissaoPedidoBrasilNfe["revisaoConsolidada"]>["parametros"] = [], declaracoes: string[] = [];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const linha = objeto(l), fci = objeto(linha.fci), d = objeto(fci.declaracaoResponsavel), registro = objeto(d.registro);
    for (const [campo, rotulo] of [["ncm", "NCM"], ["cfop", "CFOP"], ["origem", "Origem ICMS"], ["csosn", "CSOSN"], ["gtin", "GTIN"]]) if (typeof linha[campo] === "string") parametros.push({ campo, rotulo, valor: String(linha[campo]) });
    const impostos = objeto(linha.impostos);
    for (const tributo of ["pis", "cofins", "ipi"]) if (impostos[tributo]) parametros.push({ campo: tributo, rotulo: tributo.toUpperCase(), valor: String(objeto(impostos[tributo]).cst ?? "") });
    if (fci.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL") {
      parametros.push({ campo: "fci", rotulo: "FCI", valor: "Dispensada por declaração do responsável" });
      declaracoes.push(AVISO_DECLARACAO_FCI);
      const responsavel = objeto(registro.responsavel);
      if (typeof responsavel.nome === "string") declaracoes.push(`Responsável: ${responsavel.nome}. Registro: ${String(registro.registradoEm ?? "")}. Alcance: este produto e a composição fotografada, operação SP → SP, modelo 55.`);
    }
  }
  return { hash: selecionadas.length ? hashRevisaoConsolidadaGrazing1(selecionadas) : hashFiscal([]), pendente: versoes.some(v => v.status !== "ATIVO"), podeAprovar: sessao.admin === true,
    versoes: versoes.map(v => ({ id: v.id, hash: v.hash, tipo: v.tipo, rotulo: `${v.tipo} · ${v.chave} · v${v.versao}`, status: v.status })), parametros, declaracoes: [...new Set(declaracoes)] };
}
async function montarPlanoAutomaticamente(id: string, modelo: 55 | 65, ambiente: AmbienteEmissaoBrasilNfe, sessao: SessaoAtual): Promise<PendenciaEmissaoPedidoBrasilNfe[]> {
  const linkRegras = "/vendas/fiscal/regras-brasilnfe"; // Somente documentos legados do piloto.
  const documento = await prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, select: { payload: true, modeloDocumento: true, tentativas: true, planoBrasilNfe: { select: { ambiente: true } } } });
  if (objeto(documento.payload).versao === 2) return []; // Motor VersaoEstruturaFiscal é a autoridade dos novos documentos.
  if (documento.planoBrasilNfe) return documento.modeloDocumento === modelo && documento.planoBrasilNfe.ambiente === ambiente ? [] : [{ campo: "modelo", mensagem: "Esta fotografia já possui modelo e ambiente fixados. Preserve o histórico; não criar outra nota para a mesma venda.", href: linkRegras }];
  if (documento.tentativas) return [{ campo: "historico", mensagem: "Este documento já foi processado. Consulte o resultado antes de qualquer nova ação.", href: linkIntegracao }];
  const regras = (await listarRegrasTributariasBrasilNfe(sessao)).filter(r => r.modelo === modelo && r.atual && vigenteRegraFiscalBrasilNfe(r.atual, diaOperacaoDocumentoBrasilNfe(documento.payload)));
  const pendencias: PendenciaEmissaoPedidoBrasilNfe[] = [];
  const selecionar = (alvo: string, produtoId?: string, grupoId?: string) => {
    const candidatas = regras.filter(r => r.alvo === alvo && (!produtoId || r.produtoId === produtoId) && (!grupoId || r.grupoId === grupoId));
    if (candidatas.length !== 1) { pendencias.push({ campo: alvo, mensagem: `${alvo}${produtoId ? ` (${produtoId})` : grupoId ? ` (${grupoId})` : ""}: ${candidatas.length ? "há decisões vigentes ambíguas; definir o alcance" : "aprovar uma decisão fiscal vigente"}.`, href: linkRegras }); return null; }
    return candidatas[0];
  };
  const emp = selecionar("EMPRESA"), op = selecionar("OPERACAO"), itens = objeto(documento.payload).itens;
  if (!Array.isArray(itens) || !itens.length || itens.length > 990) return [{ campo: "itens", mensagem: "Conferir os produtos da fotografia comercial.", href: linkRegras }];
  const escolhidos = itens.map(v => {
    const i = objeto(v), produtoId = texto(i.produtoId, 100), grupoId = texto(objeto(i.fiscal).grupoId, 100);
    const especificas = regras.filter(r => r.alvo === "PRODUTO" && r.produtoId === produtoId);
    const r = especificas.length ? selecionar("PRODUTO", produtoId ?? undefined) : grupoId ? selecionar("GRUPO", undefined, grupoId) : selecionar("PRODUTO", produtoId ?? undefined);
    return { itemId: identidadeRegraBrasilNfe(i.id), versaoId: r?.atual?.id ?? "" };
  });
  if (!emp?.atual || !op?.atual || pendencias.length) return pendencias;
  const historico = await obterHistoricoRegraTributariaBrasilNfe(op.id, sessao), conteudo = historico.versoes[0].conteudo;
  if (conteudo.tipo !== "OPERACAO") return falhar("O perfil fiscal da operação é incompatível.");
  const endereco = conteudo.destinatario.identificar ? enderecoFiscalFotografado(documento.payload) : null;
  if (conteudo.destinatario.identificar && !endereco) return [{ campo: "destinatario.endereco", mensagem: "Completar o endereço de cobrança fiscal do destinatário, com município e UF identificáveis. Entrega não será usada por aproximação.", href: "/vendas/clientes" }];
  try {
    const r = await vincularRegrasDocumentoBrasilNfe({ documentoId: id, modelo, ambiente, empresaVersaoId: emp.atual.id, operacaoVersaoId: op.atual.id, itens: escolhidos,
      complementos: { ...(endereco ? { destinatario: endereco } : {}), bases: escolhidos.map(i => ({ itemId: i.itemId })), cartoes: [] } }, sessao);
    return r.pendencias.map(p => ({ campo: p.campo, mensagem: p.motivo, href: linkRegras }));
  } catch (e) { if (e instanceof ErroRegraFiscalBrasilNfe) return [{ campo: e.campo, mensagem: e.message, href: linkRegras }]; throw e; }
}
/** Monta prévia local e imutável. Não consulta API, não enfileira transmissão e
 * não cria título, recebível ou movimento de estoque. */
export async function prepararEmissaoPedidoBrasilNfe(pedidoId: string, versaoPedido: number, modelo: 55 | 65, ambiente: AmbienteEmissaoBrasilNfe, sessao: SessaoAtual, contextoPreparacao: ContextoPreparacaoFiscalPedido = {}, opcoesInternas: { somenteVersoesAtivas?: true } = {}): Promise<PreviaEmissaoPedidoBrasilNfe> {
  identidadeRegraBrasilNfe(pedidoId);
  if (!Number.isSafeInteger(versaoPedido) || versaoPedido < 1 || versaoPedido > 2_147_483_647) return falhar("Revisão do pedido inválida.");
  if (![55, 65].includes(modelo) || !["HOMOLOGACAO", "PRODUCAO"].includes(ambiente)) return falhar("Selecione um modelo e ambiente válidos.");
  if (Object.keys(contextoPreparacao).some(k => !["indicadorPresenca", "pagamentoCartaoNaoIntegrado", "revisaoConsolidada"].includes(k)) || contextoPreparacao.indicadorPresenca !== undefined && ![1, 2, 3, 4, 5, 9].includes(contextoPreparacao.indicadorPresenca)
    || contextoPreparacao.pagamentoCartaoNaoIntegrado !== undefined && (contextoPreparacao.pagamentoCartaoNaoIntegrado !== true || modelo !== 65)
    || contextoPreparacao.revisaoConsolidada?.confirmarAprovacao === true) return falhar("A preparação não aprova regras. Confira a presença e aprove somente no clique final de emissão.");
  const p = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"], pedidoId); return tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } }); });
  if (p.status !== "CONFIRMADO" || p.versao !== versaoPedido) return falhar("Reabra a revisão vigente de um pedido confirmado.");
  const preservado = await prisma.documentoFiscalSaida.findFirst({ where: { pedidoId, versaoPedido, ambiente, modeloDocumento: modelo }, orderBy: { revisaoFiscal: "desc" } });
  const documentoPreservado = objeto(objeto(objeto(preservado?.payload).tributacao).documento), presencaPreservada = documentoPreservado.IndicadorPresenca;
  const presencaValida = (v: unknown): v is NonNullable<ContextoPreparacaoFiscalPedido["indicadorPresenca"]> => typeof v === "number" && [1, 2, 3, 4, 5, 9].includes(v) && (modelo !== 55 || v !== 4);
  // A escolha já fotografada pertence somente a este pedido/revisão/modelo/ambiente.
  // Ela não substitui a escolha nova nem dispensa o recálculo fiscal vigente.
  const indicadorPresencaPreparacao = contextoPreparacao.indicadorPresenca ?? (objeto(preservado?.payload).versao === 2 && documentoPreservado.ModeloDocumento === modelo && documentoPreservado.TipoAmbiente === (ambiente === "PRODUCAO" ? 1 : 2) && presencaValida(presencaPreservada) ? presencaPreservada : undefined);
  const pagamentoCartaoNaoIntegrado = contextoPreparacao.pagamentoCartaoNaoIntegrado === true || modelo === 65 && objeto(preservado?.payload).versao === 2 && documentoPreservado.ModeloDocumento === modelo && documentoPreservado.TipoAmbiente === (ambiente === "PRODUCAO" ? 1 : 2) && objeto(objeto(preservado?.payload).tributacao).pagamentoCartaoNaoIntegrado === true;
  const selecoes = opcoesInternas.somenteVersoesAtivas === true ? [] : await selecionarPropostasPedido(pedidoId, sessao);
  // Rejeição certa pode originar outra revisão; a tentativa rejeitada permanece
  // imutável. Identidade autorizada, lease e resultado incerto nunca são liberados.
  const rejeicaoCerta = preservado?.status === "REJEITADO" && !preservado.acao && !preservado.leaseToken && !preservado.chaveFiscal && !preservado.protocolo && !preservado.cancelamentoPendente;
  const d = preservado && !rejeicaoCerta && (objeto(preservado.payload).versao === 1 || preservado.tentativas || preservado.acao || !["SEM_EMISSOR", "PREPARADO"].includes(preservado.status)) ? preservado : await prepararFiscalSaida(pedidoId, versaoPedido, sessao, String(modelo) as "55" | "65", { ambiente, consumidorFinal: true, ...(indicadorPresencaPreparacao === undefined ? {} : { indicadorPresenca: indicadorPresencaPreparacao }), ...(pagamentoCartaoNaoIntegrado ? { pagamentoCartaoNaoIntegrado: true } : {}), ...(selecoes.length ? { revisaoConsolidada: true, versoesRevisao: selecoes } : {}) }), payload = objeto(d.payload);
  const pendencias = await montarPlanoAutomaticamente(d.id, modelo, ambiente, sessao);
  const tributacao = objeto(payload.tributacao);
  if (payload.versao === 2 && tributacao.apto !== true) {
    const motivos = Array.isArray(tributacao.pendencias) ? tributacao.pendencias.filter((v): v is string => typeof v === "string" && v.length <= 2000) : [];
    pendencias.push(...(motivos.length ? motivos : ["Completar e aprovar a configuração fiscal vigente para preparar este documento."]).map(mensagem => ({ campo: "tributacao", mensagem, href: linkRegras })));
  }
  let plano: Awaited<ReturnType<typeof obterComplementosAprovadosDocumentoBrasilNfe>> = null;
  try { plano = await obterComplementosAprovadosDocumentoBrasilNfe(d.id, sessao, { somentePrevia: true }); } catch (e) { if (e instanceof ErroRegraFiscalBrasilNfe) pendencias.push({ campo: e.campo, mensagem: e.message, href: linkRegras }); else throw e; }
  if (plano) pendencias.push(...plano.resultado.pendencias.map(p => {
    const i = Array.isArray(payload.itens) ? payload.itens.find(v => objeto(v).id === p.itemId) : null;
    const nome = texto(objeto(objeto(i).produto).nome);
    return { campo: p.campo, mensagem: `${nome ? `${nome}: ` : ""}${p.campo}: ${p.motivo}`, href: linkRegras };
  }));
  if (plano && (plano.modelo !== modelo || plano.ambiente !== ambiente)) pendencias.push({ campo: "modelo", mensagem: "O documento processado pertence ao modelo e ambiente originais. Preserve o histórico e consulte esse contexto.", href: linkIntegracao });
  const h = await prisma.$transaction(tx => habilitacao(tx, ambiente));
  pendencias.push(...await pendenciasAmbiente(sessao, modelo, ambiente));
  let habilitada = false;
  try {
    const contexto = await obterClienteHomologacaoBrasilNfe(sessao, ambiente);
    habilitada = habilitacaoCorrespondeBrasilNfe(h, contexto, ambiente, modelo);
    if (!habilitada) pendencias.push({ campo: "habilitacao", mensagem: ambiente === "PRODUCAO" ? "Produção bloqueada: concluir homologação e aprovar a habilitação manual deste modelo e emitente." : "Habilitar o ambiente para emissão manual, com aprovação administrativa específica. Salvar credenciais não habilita emissão.", href: linkIntegracao });
  } catch {
    const [configuracao] = await prisma.$queryRaw<{ existe: boolean; tokenConfigurado: boolean }[]>`SELECT EXISTS(SELECT 1 FROM "ConfiguracaoBrasilNfe" WHERE id='singleton') AS existe, EXISTS(SELECT 1 FROM "ConfiguracaoBrasilNfe" WHERE id='singleton' AND "tokenCifrado" IS NOT NULL) AS "tokenConfigurado"`;
    if (!configuracao?.existe) pendencias.push({ campo: "configuracao", mensagem: "Completar a configuração administrativa do Brasil NFe.", href: linkIntegracao });
    else if (!configuracao.tokenConfigurado) pendencias.push({ campo: "token", mensagem: "Configurar o Token da empresa no campo protegido do Brasil NFe.", href: linkIntegracao });
  }
  const documentos = await consultarFiscalSaida(pedidoId, sessao), resumo = documentos.find(r => r.id === d.id)!;
  const conflitante = await prisma.documentoFiscalSaida.count({ where: { pedidoId, id: { not: d.id }, AND: [whereAmbienteConflitanteFiscalSaida(ambiente, modelo), { OR: [{ status: { in: ["AUTORIZADO", "DENEGADO", "PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"] } }, { referenciaProvedor: { not: null }, status: { notIn: ["REJEITADO", "CANCELADO"] } }, { acao: { not: null } }] }] } });
  if (conflitante || d.referenciaProvedor && d.provedor !== "BRASIL_NFE") pendencias.push({ campo: "duplicidade", mensagem: "Existe documento ou resultado fiscal vinculado a esta venda neste ambiente. Consultar e reconciliar; emissão duplicada bloqueada.", href: linkIntegracao });
  if (await prisma.$transaction(tx => acompanhamentoDoPedido(tx, pedidoId)) || p.referenciaOrigem || p.origem !== "INTERNO") pendencias.push({ campo: "documentoExterno", mensagem: "Venda originada em sistema externo: conferir e vincular o documento já emitido no sistema de origem antes de qualquer emissão pelo HUB.", href: linkIntegracao });
  const primeira = plano?.evidencia.primeiraEmissaoPendente === true;
  if (!primeira && (d.tentativas || !["SEM_EMISSOR", "PREPARADO"].includes(d.status))) pendencias.push({ campo: "resultado", mensagem: "Documento já processado. Consulte o próprio documento; reenvio automático permanece proibido.", href: linkIntegracao });
  const dadosEmitente = objeto(payload.emitente), comprador = identidadeFiscalCobranca(objeto(payload.comprador), payload.cobranca), endereco = objeto(payload.cobranca);
  const dataFotografada = texto(objeto(objeto(objeto(payload.tributacao).previa).contexto).data, 10);
  const regime = await obterRegimeFiscalEmpresaBrasilNfe(payload.versao === 2 ? dataFotografada ?? hojeCivilRegraBrasilNfe() : diaOperacaoDocumentoBrasilNfe(payload), sessao);
  const arquivos = await prisma.$queryRaw<{ xmlDisponivel: boolean }[]>`SELECT xml IS NOT NULL AS "xmlDisponivel" FROM "DocumentoFiscalSaida" WHERE id=${d.id}`;
  const hashFiscal = plano?.resultado.payload ? createHash("sha256").update(serializarPayloadLocalBrasilNfe(plano.resultado)).digest("hex") : null;
  const produtosFiscais = plano?.resultado.payload?.Produtos ?? objeto(objeto(payload.tributacao).documento).Produtos;
  const codigo = (v: unknown, formato: RegExp) => (typeof v === "string" || typeof v === "number") && formato.test(String(v)) ? String(v) : null;
  const revisaoConsolidada = await resumoRevisaoConsolidada(tributacao, sessao);
  const indicadorPresenca = objeto(tributacao.documento).IndicadorPresenca;
  const exigeEscolhaPresenca = ![1, 2, 3, 4, 5, 9].includes(indicadorPresenca as number) || modelo === 55 && indicadorPresenca === 4;
  return { pedidoId, numeroPedido: p.numero, versaoPedido, modelo, ambiente, ambientesDisponiveis: ["HOMOLOGACAO", "PRODUCAO"], modeloSugerido: 65,
    emitente: { nome: texto(dadosEmitente.nome), cnpj: texto(dadosEmitente.cnpj), ie: regime.ie, crtDescricao: regime.crt && regime.descricaoCrt ? `${regime.crt} — ${regime.descricaoCrt}` : null },
    destinatario: { nome: texto(comprador.tipo === "PJ" ? comprador.razaoSocial : comprador.nome), documento: texto(comprador.documento), endereco: [endereco.logradouro, endereco.numero, endereco.cidade, endereco.uf].map(v => texto(v)).filter(Boolean).join(", ") || null },
    itens: (Array.isArray(payload.itens) ? payload.itens : []).map((v, indice) => {
      const i = objeto(v), candidatas = Array.isArray(produtosFiscais) ? produtosFiscais.filter(v => objeto(v).CodProdutoServico === i.produtoId) : [];
      const mesmoIndice = Array.isArray(produtosFiscais) && Array.isArray(payload.itens) && produtosFiscais.length === payload.itens.length && objeto(produtosFiscais[indice]).CodProdutoServico === i.produtoId;
      const f = mesmoIndice ? objeto(produtosFiscais[indice]) : candidatas.length === 1 ? objeto(candidatas[0]) : null, imposto = objeto(f?.Imposto);
      return { id: texto(i.id, 100) ?? "", produtoId: texto(i.produtoId, 100) ?? "", nome: texto(objeto(i.produto).nome) ?? "Produto", quantidade: texto(i.quantidade, 30) ?? "", unidade: texto(i.unidade, 10) ?? "", total: texto(i.total, 30) ?? "",
        fiscal: f ? { ncm: codigo(f.NCM, /^\d{8}$/), cfop: codigo(f.CFOP, /^\d{4}$/), origem: codigo(f.OrigemProduto, /^[0-8]$/), icms: codigo(objeto(imposto.ICMS).CodSituacaoTributaria, /^(?:\d{2}|\d{3})$/), pis: codigo(objeto(imposto.PIS).CodSituacaoTributaria, /^\d{2}$/), cofins: codigo(objeto(imposto.COFINS).CodSituacaoTributaria, /^\d{2}$/) } : null };
    }),
    total: p.total.toFixed(2), valores: { subtotal: p.subtotal.toFixed(2), desconto: p.desconto.toFixed(2), frete: p.frete.toFixed(2), outrosCustos: p.outrosCustos.toFixed(2) }, pendencias,
    liberacaoTransmissao: { liberada: habilitada, motivo: habilitada ? null : "Emissão manual não habilitada para este modelo e ambiente." },
    ...(habilitada && modelo === 65 && ambiente === "PRODUCAO" && h?.decisaoProducao65 ? { avisoHabilitacao: "NFC-e manual liberada por decisão administrativa do responsável. A homologação externa do modelo 65 no HUB ainda não foi comprovada. Esta habilitação não aprova os parâmetros fiscais da venda." } : {}),
    numeracao: await obterNumeracaoFiscalBrasilNfe(sessao), podeEmitir: habilitada && primeira && !!hashFiscal && !pendencias.length,
    contextoOperacao: { indicadorPresenca: exigeEscolhaPresenca ? null : indicadorPresenca as 1 | 2 | 3 | 4 | 5 | 9, exigeEscolhaPresenca, consumidorFinal: typeof objeto(tributacao.documento).ConsumidorFinal === "boolean" ? objeto(tributacao.documento).ConsumidorFinal as boolean : null },
    revisaoConsolidada, controleManual: { suspensa: h?.habilitada === false, motivo: h?.habilitada === false ? "Novos envios suspensos pela administração." : null },
    documento: { id: d.id, versaoPedido: resumo.versaoPedido, provedor: resumo.provedor, referenciaProvedor: resumo.referenciaProvedor, modeloDocumento: d.modeloDocumento ?? plano?.modelo ?? null, status: resumo.status, ambiente: resumo.ambiente, hashSnapshot: d.hashPayload, hashPayloadFiscal: hashFiscal,
      numero: resumo.numero, serie: resumo.serie, chaveFiscal: resumo.chaveFiscal, protocolo: resumo.protocolo, ultimoErro: resumo.ultimoErro, xmlDisponivel: arquivos[0]?.xmlDisponivel ?? false, formatoImpressao: resumo.formatoImpressao, tentativas: resumo.tentativas, cancelamentoPendente: resumo.cancelamentoPendente, cancelamentoSolicitado: resumo.cancelamentoSolicitado, eventos: resumo.eventos } };
}
/** Fábrica do registro geral: somente contexto de ação manual central, registro
 * durável vigente e identidade exata. Nenhuma instância fica no registro global. */
export async function obterAdaptadorOperacionalBrasilNfe(sessao: SessaoAtual, documentoId: string): Promise<AdaptadorFiscalSaida | null> {
  identidadeRegraBrasilNfe(documentoId);
  const doc = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["fiscal"]); return tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, select: { ambiente: true, modeloDocumento: true } }); });
  if (!["HOMOLOGACAO", "PRODUCAO"].includes(doc.ambiente) || ![55, 65].includes(doc.modeloDocumento ?? 0)) return null;
  const ambiente = doc.ambiente as AmbienteEmissaoBrasilNfe, modelo = doc.modeloDocumento as 55 | 65, contexto = await obterClienteHomologacaoBrasilNfe(sessao, ambiente);
  const h = await prisma.$transaction(tx => habilitacao(tx, ambiente));
  const autorizacaoAnterior = await prisma.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-autorizada:${documentoId}` }, select: { id: true } });
  if (!habilitacaoCorrespondeBrasilNfe(h, contexto, ambiente, modelo) && !autorizacaoAnterior) return null;
  const tecnica = criarPortaTecnicaBrasilNfe(sessao, ambiente);
  const base = new AdaptadorBrasilNfeM1(contexto.cliente, contexto.emitenteCnpj, { ...tecnica, async preparar(identidade, fotografia) {
    const d = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["fiscal"]); const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: identidade.documentoId } }); await conferirCalculoAtualFiscalSaida(tx, d); return d; });
    if (hashFiscal(d.payload) !== hashFiscal(fotografia)) return falhar("Fotografia divergente durante a montagem fiscal.");
    const plano = await obterComplementosAprovadosDocumentoBrasilNfe(d.id, sessao);
    if (!plano?.resultado.montagemConcluida || plano.ambiente !== ambiente || plano.modelo !== modelo) return falhar("Montagem fiscal pendente ou de outro contexto.");
    return plano.resultado;
  }, async autorizar(operacao, identidade) {
    const i = conferirIdentidadeBrasilNfe(identidade);
    if (i.documentoId !== documentoId || i.ambiente !== ambiente || i.modeloDocumento !== modelo || i.emitenteCnpj !== contexto.emitenteCnpj) return falhar("Identidade fora da habilitação manual.");
    const atual = await obterClienteHomologacaoBrasilNfe(sessao, ambiente), habilitada = await prisma.$transaction(tx => habilitacao(tx, ambiente));
    if (operacao === "ENVIAR" && (!habilitacaoCorrespondeBrasilNfe(habilitada, atual, ambiente, modelo) || habilitada?.id !== h?.id)) return falhar("Habilitação ou emitente alterado durante a ação. Conferir antes de continuar.");
    if (operacao === "CANCELAR") return falhar("Cancelamento exige aprovação específica e não está habilitado neste fluxo de emissão.");
    if (operacao === "ENVIAR") {
      exigirTransmissaoBrasilNfeLiberada({ documentoId, ambiente, modelo, emitenteCnpj: i.emitenteCnpj });
      const plano = await obterComplementosAprovadosDocumentoBrasilNfe(documentoId, sessao);
      if (!plano?.resultado.payload || plano.ambiente !== ambiente) return falhar("Plano fiscal aprovado ausente ou divergente.");
      const pendencias = await pendenciasAmbiente(sessao, modelo, ambiente); if (pendencias.length) return falhar(pendencias.map(p => p.mensagem).join(" "));
      const externo = await contexto.cliente.buscarEmpresa(), pre = await obterPreRequisitosBrasilNfe(sessao);
      const cadastro = await prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { enderecoEstruturado: true } }), endereco = objeto(cadastro.enderecoEstruturado);
      const municipios = externo.endereco.codigoMunicipio ? MUNICIPIOS_NFSE.filter(m => m.codigo === externo.endereco.codigoMunicipio) : [];
      // Município IBGE unívoco determina a UF; isso não preenche cadastro externo
      // nem aceita divergência com a UF efetivamente devolvida pelo fornecedor.
      const ufIbge = municipios.length === 1 && externo.endereco.codigoMunicipio === plano.parametros.emitente.codMunicipio ? municipios[0].uf : null;
      const uf = externo.endereco.uf ?? ufIbge ?? (ufAusenteConferidaNoPainelBrasilNfe(pre) ? pre.evidenciaPainel?.ufEmitente : null);
      if (externo.cnpj !== i.emitenteCnpj || externo.crt !== plano.parametros.emitente.crt || externo.inscricaoEstadual?.replace(/[.-]/g, "") !== plano.parametros.emitente.ie || uf !== endereco.uf
        || externo.endereco.cep !== endereco.cep || externo.endereco.numero !== endereco.numero || externo.endereco.codigoMunicipio !== plano.parametros.emitente.codMunicipio) return falhar("Emitente externo diverge de CNPJ, IE, CRT ou endereço aprovado. Nenhuma nota foi transmitida.");
      const csc = ambiente === "HOMOLOGACAO" ? externo.nfceHomologacao : externo.nfceProducao;
      if (modelo === 65 && (!csc?.cscConfigurado || !csc.idCscConfigurado)) return falhar("CSC e identificador do ambiente não confirmados. Nenhuma NFC-e foi transmitida.");
      await prisma.$transaction(async tx => {
        await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await conferirAcesso(tx, sessao, ["revisar", "fiscal"]); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
        const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, include: { pedido: true } });
        const vigente = await habilitacao(tx, ambiente), config = await tx.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" }, select: { versao: true } });
        const autorizacao = await tx.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-autorizada:${documentoId}` } }), a = objeto(autorizacao?.dados);
        const hashFiscal = createHash("sha256").update(serializarPayloadLocalBrasilNfe(plano.resultado)).digest("hex");
        if (!habilitacaoCorrespondeBrasilNfe(vigente, atual, ambiente, modelo) || vigente?.id !== h?.id || config.versao !== atual.versao || !autorizacao || a.usuarioId !== sessao.userId || a.hashSnapshot !== d.hashPayload || a.hashPayloadFiscal !== hashFiscal || a.habilitacaoId !== h?.id || a.versaoConfiguracao !== atual.versao || a.emitenteHash !== atual.emitenteHash
          || a.planoId !== plano.planoId || a.parametrosHash !== plano.evidencia.parametrosHash || d.ambiente !== ambiente || d.acao !== "ENVIAR" || d.status !== "PROCESSANDO" || d.tentativas !== 1 || !d.leaseToken || !d.leaseAte || d.leaseAte <= new Date()
          || d.pedido.status !== "CONFIRMADO" || d.pedido.versao !== d.versaoPedido || d.pedido.origem !== "INTERNO" || d.pedido.referenciaOrigem || await acompanhamentoDoPedido(tx, d.pedidoId)
          || await tx.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-consumida:${documentoId}` } })) return falhar("Autorização consumida, pedido externo, fotografia divergente ou trava inválida. Não reenviar.");
        await tx.eventoFiscalSaida.create({ data: { documentoId, chave: `emissao-manual-consumida:${documentoId}`, tipo: "EMISSAO_MANUAL_EXECUCAO_INICIADA", dados: { usuarioId: sessao.userId, leaseToken: d.leaseToken, hashPayloadFiscal: hashFiscal, ambiente, modelo, ufConferidaPor: externo.endereco.uf ? "RESPOSTA_BRASIL_NFE" : ufIbge ? "CORRESPONDENCIA_IBGE_UNIVOCA" : "EVIDENCIA_PAINEL" } } });
      });
    } else await prisma.$transaction(async tx => {
      await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await conferirAcesso(tx, sessao, ["fiscal"]);
      const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId } });
      // Cancelamento pode usar credencial atual para a mesma autorização fiscal.
      // A consulta do seu evento segue essa confirmação específica, sem exigir
      // que um diagnóstico posterior conserve a versão histórica da emissão.
      const cancelamento = await tx.eventoFiscalSaida.findUnique({ where: { chave: `cancelamento-manual-autorizado:${documentoId}` }, select: { dados: true } });
      const a = objeto(cancelamento?.dados ?? (await tx.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-autorizada:${documentoId}` } }))?.dados);
      if (d.provedor !== "BRASIL_NFE" || d.ambiente !== ambiente || a.hashSnapshot !== d.hashPayload || a.emitenteHash !== atual.emitenteHash || a.versaoConfiguracao !== atual.versao) return falhar("Leitura não corresponde à identidade originalmente autorizada. Preserve o resultado e faça conferência administrativa.");
    });
  } }, ambiente);
  const conferirFalha = async <T>(operacao: string, acao: () => Promise<T>): Promise<T> => {
    try { return await acao(); } catch (erro) {
      const metadados = sanitizarMetadadosErroBrasilNfe(erro instanceof ErroHttpBrasilNfe || erro instanceof ErroConsultaBrasilNfe ? erro.diagnosticoSeguro : null);
      await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["fiscal"]); const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, select: { leaseToken: true } });
        if (d.leaseToken) await tx.eventoFiscalSaida.upsert({ where: { chave: `emissao-manual-falha:${documentoId}:${operacao}:${d.leaseToken}` }, create: { documentoId, chave: `emissao-manual-falha:${documentoId}:${operacao}:${d.leaseToken}`, tipo: "EMISSAO_MANUAL_FALHA_TECNICA", dados: json({ operacao, metadados }) }, update: {} }); });
      throw erro;
    }
  };
  const conferirSerie = (r: Awaited<ReturnType<AdaptadorFiscalSaida["consultar"]>>) => r.status === "AUTORIZADO" && (!r.serie || !/^\d{1,3}$/.test(r.serie) || Number(r.serie) !== (modelo === 55 ? 6 : 7))
    ? { ...r, status: "PENDENTE_CONFERENCIA" as const, erro: "Autorização recebida em série divergente da configuração manual. Preservar a chave e conferir; não reenviar." } : r;
  return registrarCapacidadeEmissaoManualBrasilNfe({ id: base.id, ambiente, enviar: async (i, p) => { exigirTransmissaoBrasilNfeLiberada({ documentoId, ambiente, modelo, emitenteCnpj: contexto.emitenteCnpj }); return conferirFalha("ENVIAR", async () => conferirSerie(await base.enviar(i, p))); }, consultar: i => conferirFalha("CONSULTAR", async () => {
    const r = conferirSerie(await base.consultar(i));
    if (r.status === "AUTORIZADO") await prisma.eventoFiscalSaida.upsert({ where: { chave: `emissao-consulta-confirmada:${documentoId}:${r.eventoId}` }, create: { documentoId, chave: `emissao-consulta-confirmada:${documentoId}:${r.eventoId}`, tipo: "EMISSAO_MANUAL_CONSULTA_CONFIRMADA", dados: json({ ambiente, modelo, chave: r.chave, protocolo: r.protocolo }) }, update: {} });
    return r;
  }), cancelar: base.cancelar.bind(base), async obterDocumentos(i) {
    const arquivos = await base.obterDocumentos(i);
    if (arquivos.xml) {
      // Fotografia autorizada, sem reaplicar vigência/regras atuais ao passado.
      const d = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["consultar", "fiscal"]); return tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, select: { payload: true } }); });
      const documentoFiscal = objeto(objeto(objeto(d.payload).tributacao).documento);
      if (objeto(d.payload).versao === 2) conferirTotaisDocumentoXmlBrasilNfe(arquivos.xml, documentoFiscal);
      conferirFciXmlBrasilNfe(arquivos.xml, documentoFiscal.Produtos);
    }
    return arquivos;
  }, autenticarRetorno: async () => null }, documentoId);
}
export async function emitirNotaPedidoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  let e = validarComandoEmissaoPedidoBrasilNfe(entrada);
  const configuracaoInicial = await obterClienteHomologacaoBrasilNfe(sessao, e.ambiente), habilitacaoInicial = await prisma.$transaction(tx => habilitacao(tx, e.ambiente));
  if (!habilitacaoCorrespondeBrasilNfe(habilitacaoInicial, configuracaoInicial, e.ambiente, e.modelo)) return falhar("Emissão manual suspensa ou não habilitada para este modelo e ambiente.");
  const pendenciasIniciais = await pendenciasAmbiente(sessao, e.modelo, e.ambiente);
  if (pendenciasIniciais.length) return falhar(pendenciasIniciais.map(p => p.mensagem).join(" "));
  const original = await prisma.$transaction(async tx => { await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await conferirAcesso(tx, sessao, ["revisar", "fiscal"]); return tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: e.documentoId } }); });
  const t = objeto(objeto(original.payload).tributacao), revisao = objeto(t.revisaoConsolidada);
  if (original.hashPayload !== e.hashSnapshot || original.ambiente !== e.ambiente || original.modeloDocumento !== e.modelo || original.tentativas || original.acao || original.leaseToken || !["SEM_EMISSOR", "PREPARADO"].includes(original.status)
    || e.indicadorPresenca !== undefined && objeto(t.documento).IndicadorPresenca !== e.indicadorPresenca) return falhar("Documento, presença, modelo, ambiente ou revisão divergem do resumo confirmado. Atualize; nenhuma aprovação ou transmissão foi realizada.");
  if (revisao.tipo === "PROPOSTAS_PARA_REVISAO") {
    const confirmacao = e.revisaoConsolidada, selecionadas = (Array.isArray(revisao.versoes) ? revisao.versoes : []).map(v => ({ id: String(objeto(v).id), hash: String(objeto(v).hash) }));
    if (!confirmacao || hashRevisaoConsolidadaGrazing1(selecionadas) !== confirmacao.hash || hashRevisaoConsolidadaGrazing1(confirmacao.versoes) !== confirmacao.hash || original.hashPayload !== e.hashSnapshot) return falhar("Revise e confirme os parâmetros consolidados e as versões desta fotografia.");
    const previo = await obterComplementosAprovadosDocumentoBrasilNfe(e.documentoId, sessao, { somentePrevia: true });
    if (!previo?.resultado.payload || createHash("sha256").update(serializarPayloadLocalBrasilNfe(previo.resultado)).digest("hex") !== e.hashPayloadFiscal || previo.resultado.payload.ValorTotal !== e.total) return falhar("O resumo mudou. Reabra a revisão antes de emitir.");
    if (e.ambiente === "HOMOLOGACAO") {
      if (e.modelo !== 55 || objeto(t.documento).TipoAmbiente !== 2) return falhar("Esta autorização de teste abrange somente a NF-e modelo 55 em homologação.");
      await prisma.$transaction(async tx => {
        await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await conferirAcesso(tx, sessao, ["revisar", "fiscal"]); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
        const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: original.id } });
        if (d.hashPayload !== e.hashSnapshot || d.tentativas || d.acao || !["SEM_EMISSOR", "PREPARADO"].includes(d.status)) return falhar("Teste já processado ou revisão alterada. Não reenviar.");
        await tx.eventoFiscalSaida.upsert({ where: { chave: `emissao-revisao-homologacao:${d.id}` }, create: { documentoId: d.id, chave: `emissao-revisao-homologacao:${d.id}`, tipo: "EMISSAO_MANUAL_REVISAO_HOMOLOGACAO", dados: json({ hashSnapshot: d.hashPayload, hashVersoes: hashFiscal(revisao.versoes), usuarioId: sessao.userId, aprovacaoInterna: false, finalidade: "TESTE_HOMOLOGACAO" }) }, update: {} });
      });
    } else {
      await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["revisar", "fiscal"]); await aprovarRevisaoConsolidadaNaTransacao(tx, confirmacao.versoes, confirmacao.hash, sessao); }, { timeout: 30000 });
      const nova = await prepararEmissaoPedidoBrasilNfe(original.pedidoId, original.versaoPedido, e.modelo, e.ambiente, sessao, e.indicadorPresenca === undefined ? {} : { indicadorPresenca: e.indicadorPresenca });
      if (!nova.documento?.hashPayloadFiscal || nova.pendencias.length) return falhar("Revisão aprovada. Confira a nova prévia antes da transmissão; nenhum envio foi realizado.");
      const final = await obterComplementosAprovadosDocumentoBrasilNfe(nova.documento.id, sessao);
      const conteudo = (v: ResultadoPayloadLocalBrasilNfe) => hashFiscal(Object.fromEntries(Object.entries(v.payload ?? {}).filter(([k]) => k !== "IdentificadorInterno")));
      if (!final?.resultado.payload || conteudo(previo.resultado) !== conteudo(final.resultado) || nova.total !== e.total) return falhar("A ativação mudou o conteúdo fiscal. Confira a nova revisão; nenhum envio foi realizado.");
      e = { ...e, documentoId: nova.documento.id, hashSnapshot: nova.documento.hashSnapshot, hashPayloadFiscal: nova.documento.hashPayloadFiscal };
    }
  } else if (e.revisaoConsolidada) return falhar("A revisão consolidada não corresponde ao documento apresentado. Atualize o resumo.");
  const plano = await obterComplementosAprovadosDocumentoBrasilNfe(e.documentoId, sessao);
  if (!plano?.resultado.payload || !plano.evidencia.primeiraEmissaoPendente || plano.modelo !== e.modelo || plano.ambiente !== e.ambiente || plano.resultado.hashPayload !== e.hashSnapshot
    || createHash("sha256").update(serializarPayloadLocalBrasilNfe(plano.resultado)).digest("hex") !== e.hashPayloadFiscal || plano.resultado.payload.ValorTotal !== e.total) return falhar("A confirmação não corresponde à primeira emissão desta revisão. Preserve o resultado anterior; não reenviar.");
  const contexto = await obterClienteHomologacaoBrasilNfe(sessao, e.ambiente), h = await prisma.$transaction(tx => habilitacao(tx, e.ambiente));
  if (!habilitacaoCorrespondeBrasilNfe(h, contexto, e.ambiente, e.modelo)) return falhar("Ambiente não habilitado para emissão manual. Produção exige homologação comprovada e aprovação específica.");
  const sequenciaConferida = await conferirSequenciaManual(sessao, e.modelo, e.ambiente, contexto.versao);
  const autorizacaoId = await prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await conferirAcesso(tx, sessao, ["revisar", "fiscal"]); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: e.documentoId }, include: { pedido: true } });
    if (d.acao || d.tentativas || d.leaseToken || d.chaveFiscal || !["SEM_EMISSOR", "PREPARADO"].includes(d.status) || d.hashPayload !== e.hashSnapshot || d.pedido.origem !== "INTERNO" || d.pedido.referenciaOrigem
      || await acompanhamentoDoPedido(tx, d.pedidoId) || await tx.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: { notIn: ["PREPARADO", "EMISSAO_MANUAL_REVISAO_HOMOLOGACAO"] } } })
      || await tx.documentoFiscalSaida.count({ where: { pedidoId: d.pedidoId, id: { not: d.id }, AND: [whereAmbienteConflitanteFiscalSaida(e.ambiente, e.modelo), { OR: [{ status: { in: ["AUTORIZADO", "DENEGADO", "PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"] } }, { referenciaProvedor: { not: null }, status: { notIn: ["REJEITADO", "CANCELADO"] } }, { acao: { not: null } }] }] } })) return falhar("Já existe resultado, tentativa ou documento externo desta venda neste ambiente. Conferir o histórico; emissão duplicada bloqueada.");
    await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { ambiente: e.ambiente, provedor: "BRASIL_NFE" } });
    const autorizacao = await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `emissao-manual-autorizada:${d.id}`, tipo: "EMISSAO_MANUAL_AUTORIZADA", dados: json({ ...e, usuarioId: sessao.userId, habilitacaoId: h!.id, versaoConfiguracao: contexto.versao, emitenteHash: contexto.emitenteHash, planoId: plano.planoId, parametrosHash: plano.evidencia.parametrosHash, sequenciaConferida, emissorPerfil: texto(objeto(objeto(d.payload).tributacao).perfilEmissor, 30), trocaGlobalEmissor: false }) } });
    return autorizacao.id;
  });
  const a = await obterAdaptadorFiscalSaida({ sessao, documentoId: e.documentoId }); if (!a) return falhar("Habilitação invalidada; autorização preservada, sem transmissão.");
  await executarComAutorizacaoManualBrasilNfe({ empresaId: "singleton", emitenteCnpj: contexto.emitenteCnpj, usuarioId: sessao.userId, documentoId: e.documentoId, modelo: e.modelo, ambiente: e.ambiente, hashSnapshot: e.hashSnapshot, hashPayloadFiscal: e.hashPayloadFiscal, versaoConfiguracao: contexto.versao, habilitacaoId: h!.id, autorizacaoId },
    () => executarFiscalSaidaManual(a, e.documentoId, "ENVIAR", "Transmissão única do documento apresentado e especificamente confirmado.", sessao),
    acaoHTTP => prisma.$transaction(async tx => {
      await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar"); await conferirAcesso(tx, sessao, ["revisar", "fiscal"]);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
      await tx.$queryRaw`SELECT id FROM "ConfiguracaoLoja" WHERE id='singleton' FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${original.pedidoId} FOR SHARE`;
      const lojaAtual = await tx.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
      const hashEmitenteAtual = createHash("sha256").update(JSON.stringify(lojaAtual)).digest("hex");
      const atual = await tx.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" }, select: { versao: true } }), vigente = await habilitacao(tx, e.ambiente);
      const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: e.documentoId }, include: { pedido: true } });
      const consumo = objeto((await tx.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-consumida:${d.id}` }, select: { dados: true } }))?.dados);
      const autorizacao = await tx.eventoFiscalSaida.findUnique({ where: { id: autorizacaoId }, select: { dados: true } }), dadosAutorizacao = objeto(autorizacao?.dados);
      if (hashEmitenteAtual !== contexto.emitenteHash || !habilitacaoCorrespondeBrasilNfe(vigente, contexto, e.ambiente, e.modelo) || vigente?.id !== h!.id || atual.versao !== contexto.versao || dadosAutorizacao.usuarioId !== sessao.userId || dadosAutorizacao.hashPayloadFiscal !== e.hashPayloadFiscal
        || consumo.leaseToken !== d.leaseToken || consumo.usuarioId !== sessao.userId || d.hashPayload !== e.hashSnapshot || d.ambiente !== e.ambiente || d.modeloDocumento !== e.modelo || d.provedor !== "BRASIL_NFE"
        || d.acao !== "ENVIAR" || d.status !== "PROCESSANDO" || d.tentativas !== 1 || !d.leaseToken || !d.leaseAte || d.leaseAte <= new Date() || d.pedido.versao !== d.versaoPedido || d.pedido.status !== "CONFIRMADO") return falhar("Autorização, acesso, configuração ou habilitação mudou antes do envio. Não retransmitir; conferir este documento.");
      await conferirCalculoAtualFiscalSaida(tx, d, { enviar: true });
      const numeracaoEmAndamento = await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: "NUMERACAO_ATUALIZACAO_INICIADA" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
      if (numeracaoEmAndamento) {
        const operacaoId = objeto(numeracaoEmAndamento.dados).operacaoId;
        const final = typeof operacaoId === "string" ? await tx.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: "NUMERACAO_ATUALIZACAO_RESULTADO", dados: { path: ["operacaoId"], equals: operacaoId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } }) : null;
        if (!["CONFIRMADA", "RECUSADA"].includes(objeto(final?.dados).situacao as string)) return falhar("Há administração de numeração pendente. Conferir antes de enviar; nenhum contador será presumido.");
      }
      // A configuração e a suspensão administrativa usam as mesmas travas. O
      // único POST começa dentro delas, depois de conferir novamente a revisão.
      return acaoHTTP();
    }, { timeout: 20_000, maxWait: 5_000 }));
  return resultadoPedido(e.documentoId, sessao);
}
async function resultadoPedido(id: string, sessao: SessaoAtual) {
  const d = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["consultar"]); return tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, select: { pedidoId: true } }); });
  return (await consultarFiscalSaida(d.pedidoId, sessao)).find(r => r.id === id)!;
}
export async function consultarEmissaoPedidoBrasilNfe(id: string, sessao: SessaoAtual) {
  const a = await obterAdaptadorFiscalSaida({ sessao, documentoId: identidadeRegraBrasilNfe(id) }); if (!a) return falhar("Emissor ou configuração original não habilitados. Resultado preservado para conferência.");
  await executarFiscalSaidaManual(a, id, "CONSULTAR", "Consulta exclusiva do documento desta venda, sem reenvio.", sessao); return resultadoPedido(id, sessao);
}
export async function obterDocumentosEmissaoPedidoBrasilNfe(id: string, sessao: SessaoAtual) {
  const a = await obterAdaptadorFiscalSaida({ sessao, documentoId: identidadeRegraBrasilNfe(id) }); if (!a) return falhar("Emissor ou configuração original não habilitados.");
  await obterArquivosFiscalSaidaManual(a, id, sessao); return resultadoPedido(id, sessao);
}
