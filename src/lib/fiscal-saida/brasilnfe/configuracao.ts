import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ConfiguracaoBrasilNfe, type ConfiguracaoLoja } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cifrar, decifrar } from "@/lib/crypto";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { ClienteBrasilNfe, ErroHttpBrasilNfe, ETAPAS_CONTRATO_BRASILNFE, obterDetalhesTemporariosErroBrasilNfe } from "./cliente";
import type { ConfiguracaoBrasilNfeDto, ConsultaAdministrativaBrasilNfe, DetalhesDiagnosticoBrasilNfeDto } from "./configuracao-dto";
import { restaurarPreRequisitosBrasilNfe } from "./pre-requisitos-dominio";
import { sanitizarMetadadosErroBrasilNfe, type DetalhesDiagnosticoServicosBrasilNfe, type MetadadosErroBrasilNfe } from "./diagnostico-http";
import { classificarServicosEmissaoBrasilNfe, diagnosticoBrasilNfeVazio, CONSULTAS_EMPRESA_BRASILNFE, ErroConfiguracaoBrasilNfe, validarSubstituicaoBrasilNfe, validarVersaoBrasilNfe, type DiagnosticoBrasilNfe } from "./configuracao-dominio";

const recurso = "configuracoes.brasilnfe";
const contextoToken = "grazing-hub-brasilnfe-token-v1";
const contextoUserToken = "grazing-hub-brasilnfe-usertoken-v1";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Emitente = Pick<ConfiguracaoLoja, "id" | "nome" | "cnpj" | "enderecoEstruturado">;
const selectEmitente = { id: true, nome: true, cnpj: true, enderecoEstruturado: true } as const;
const hashEmitente = (loja: Emitente | null) => createHash("sha256").update(JSON.stringify(loja)).digest("hex");
const cnpj = (valor: string | null | undefined) => (valor ?? "").replace(/[.\/-]/g, "").trim();
function enderecoCompleto(loja: Emitente | null) {
  const e = loja?.enderecoEstruturado;
  if (!e || typeof e !== "object" || Array.isArray(e)) return false;
  return ["logradouro", "numero", "bairro", "cidade"].every(k => typeof e[k] === "string" && !!e[k].trim()) && typeof e.cep === "string" && /^\d{8}$/.test(e.cep.replace(/-/g, "")) && typeof e.uf === "string" && /^[A-Z]{2}$/.test(e.uf);
}
function pendenciasLocais(c: ConfiguracaoBrasilNfe | null, loja: Emitente | null) {
  return [!c?.tokenCifrado && "Configurar Token da empresa.", !c?.userTokenCifrado && "Configurar UserToken para BuscarEmpresa e ConsultarServicos.", !/^\d{14}$/.test(cnpj(loja?.cnpj)) && "Completar CNPJ do emitente em Dados da empresa.", !loja?.nome?.trim() && "Completar nome do emitente em Dados da empresa.", !enderecoCompleto(loja) && "Completar endereço estruturado do emitente em Dados da empresa."].filter(Boolean) as string[];
}
/** Revalida sessão e permissões centrais dentro de cada transação crítica. */
async function autor(tx: Prisma.TransactionClient, sessao: SessaoAtual, acao: "visualizar" | "editar") {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0) || (u.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, u.permissoesPersonalizadas as Excecoes, recurso, acao))) throw new ErroConfiguracaoBrasilNfe("Seu acesso não permite administrar esta integração.");
  return u.id;
}
export { autor as conferirAcessoAdministrativoBrasilNfe };
async function ler(tx: Prisma.TransactionClient) {
  const config = await tx.configuracaoBrasilNfe.findUnique({ where: { id: "singleton" } });
  if (config && config.ambiente !== "HOMOLOGACAO") throw new ErroConfiguracaoBrasilNfe("Produção bloqueada no Marco 1.");
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: selectEmitente });
  return { config, loja };
}
const registro = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function instante(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
}
function restaurarDiagnostico(valor: unknown): DiagnosticoBrasilNfe {
  // Estrutura produzida pelo HUB; não serializar objetos/campos desconhecidos do JSON.
  const salvo = registro(valor), base = diagnosticoBrasilNfeVazio();
  base.verificadaEm = instante(salvo.verificadaEm);
  if (!base.verificadaEm) return base;
  if (["NAO_REALIZADA", "PARCIAL", "FALHOU", "CONECTADO_SERVICOS_PENDENTES"].includes(salvo.situacao as string)) base.situacao = salvo.situacao as DiagnosticoBrasilNfe["situacao"];
  base.acessoAutenticado = salvo.acessoAutenticado === true;
  base.empresaVerificadaEm = instante(salvo.empresaVerificadaEm) ?? (base.acessoAutenticado ? base.verificadaEm : null);
  base.emitenteCorrespondente = base.acessoAutenticado && typeof salvo.emitenteCorrespondente === "boolean" ? salvo.emitenteCorrespondente : null;
  // Pendências legadas contêm somente textos locais; novos metadados têm lista permitida própria.
  for (const campo of ["pendencias", "consultasIndisponiveis"] as const) {
    if (Array.isArray(salvo[campo]) && salvo[campo].length <= 100 && salvo[campo].every(v => typeof v === "string" && v.length <= 2000)) base[campo] = [...salvo[campo]] as string[];
  }
  const servicos = registro(salvo.servicosEmissao), dataServicos = instante(servicos.verificadosEm);
  if (base.emitenteCorrespondente && dataServicos) {
    base.servicosEmissao.verificadosEm = dataServicos;
    for (const modelo of ["nfe", "nfce"] as const) {
      if (servicos[modelo] === "ATIVO" || servicos[modelo] === "INATIVO") base.servicosEmissao[modelo] = servicos[modelo];
    }
  }
  if (Array.isArray(salvo.consultas)) for (const consulta of base.consultas) {
    const anterior = registro(salvo.consultas.find(v => registro(v).consulta === consulta.consulta));
    const dataConsulta = instante(anterior.verificadaEm);
    if (dataConsulta && (anterior.situacao === "CONCLUIDA" || anterior.situacao === "FALHOU")) {
      consulta.situacao = anterior.situacao; consulta.verificadaEm = dataConsulta;
      consulta.falha = anterior.situacao === "FALHOU" ? sanitizarMetadadosErroBrasilNfe(anterior.falha) : null;
    }
  }
  if (base.situacao === "CONECTADO_SERVICOS_PENDENTES" && (!base.acessoAutenticado || base.emitenteCorrespondente !== true)) base.situacao = "PARCIAL";
  return base;
}
function dto({ config: c, loja }: Awaited<ReturnType<typeof ler>>): ConfiguracaoBrasilNfeDto {
  const vigente = !!c?.diagnostico && c.emitenteHash === hashEmitente(loja);
  const base = vigente ? restaurarDiagnostico(c.diagnostico) : diagnosticoBrasilNfeVazio();
  const pre = c?.preRequisitosEmitenteHash === hashEmitente(loja) ? restaurarPreRequisitosBrasilNfe(c.preRequisitos, c.versao) : null;
  const empresaVerificadaEm = pre?.empresaVerificadaEm ?? pre?.verificadoEm;
  if (pre?.empresaCorrespondente === true && empresaVerificadaEm && (!base.empresaVerificadaEm || empresaVerificadaEm > base.empresaVerificadaEm)) {
    // Projeção da leitura posterior da empresa, sem alterar a consulta histórica
    // de serviços ou interpretar seu status1 como sucesso.
    base.acessoAutenticado = true; base.emitenteCorrespondente = true; base.empresaVerificadaEm = empresaVerificadaEm;
    base.situacao = "CONECTADO_SERVICOS_PENDENTES";
    const empresa = base.consultas.find(v => v.consulta === "BuscarEmpresa");
    if (empresa) { empresa.situacao = "CONCLUIDA"; empresa.verificadaEm = empresaVerificadaEm; empresa.falha = null; }
  }
  const textosLegados: Record<string, string> = {
    "Confirp: confirmar CRT, IE e regras tributárias por operação/produto para NF-e e NFC-e.": "Revisão fiscal: confirmar CRT, IE e fundamentação por operação/produto, com aprovação interna para NF-e e NFC-e.",
    "Brasil NFe e Confirp: conferir IE e CRT do emitente.": "Conferir IE e CRT do emitente no cadastro e na fundamentação fiscal.",
    "NFC-e: conferir CSC e identificador CSC de homologação com Brasil NFe/Confirp.": "NFC-e: conferir CSC e identificador de homologação com o responsável fiscal e Brasil NFe.",
  };
  // Apenas projeção atual: evidências e mensagens antigas não são reescritas.
  base.pendencias = base.pendencias.map(p => textosLegados[p] ?? p);
  if (c?.preRequisitosEmitenteHash === hashEmitente(loja) && restaurarPreRequisitosBrasilNfe(c.preRequisitos, c.versao).certificado.situacao === "VALIDO") {
    // O diagnóstico histórico fica intacto; a leitura considera a conferência posterior.
    base.pendencias = base.pendencias.filter(p => p !== "Verificação do certificado externo pendente: contrato do fornecedor precisa ser confirmado; nenhum certificado será alterado.");
  }
  if (!vigente && !base.acessoAutenticado) {
    base.pendencias.unshift(c?.diagnostico ? "Cadastro do emitente alterado: validar conexão novamente." : "Validação externa ainda não realizada.");
    base.consultasIndisponiveis = !c?.tokenCifrado || !c?.userTokenCifrado ? [...CONSULTAS_EMPRESA_BRASILNFE] : [];
  }
  return { versao: c?.versao ?? 0, ambiente: "HOMOLOGACAO", producaoBloqueada: true, emissaoHabilitada: false,
    tokenConfigurado: !!c?.tokenCifrado, userTokenConfigurado: !!c?.userTokenCifrado,
    emitente: { id: "singleton", nome: loja?.nome ?? null, cnpj: loja?.cnpj ?? null, enderecoCompleto: enderecoCompleto(loja) },
    configuracaoSalva: !!c, validacaoExterna: { ...base, pendencias: [...new Set([...pendenciasLocais(c, loja), ...base.pendencias])] }, homologacaoFiscal: "PENDENTE" };
}
function mensagemFalha(consulta: ConsultaAdministrativaBrasilNfe, falha: MetadadosErroBrasilNfe): string {
  if (falha.categoria === "HTTP") {
    if (falha.httpStatus === 401) return `${consulta}: autenticação desta consulta recusada (HTTP 401).`;
    if (falha.httpStatus === 403) return `${consulta}: acesso a esta operação recusado (HTTP 403). A causa precisa ser esclarecida; isso não comprova token incorreto.`;
    return `${consulta}: resposta HTTP ${falha.httpStatus ?? "não identificada"}; verificação não concluída.`;
  }
  const mensagens: Record<MetadadosErroBrasilNfe["categoria"], string> = {
    TRANSPORTE: "falha de transporte; verificação não concluída.", TIMEOUT: "prazo da consulta excedido; verificação não concluída.",
    HTTP: "resposta HTTP não confirmada.", NAO_JSON: "resposta recebida não é JSON.", JSON_INVALIDO: "JSON recebido inválido.",
    CONTRATO: "campo incompatível com o contrato.", NEGOCIO: "fornecedor informou erro de negócio; detalhes externos não são armazenados.",
    LIMITE: "resposta excedeu o limite permitido.", CONFIGURACAO: "não foi possível acessar a configuração protegida ou concluir a consulta.",
  };
  return `${consulta}: ${mensagens[falha.categoria]}`;
}
export async function obterConfiguracaoBrasilNfe(sessao: SessaoAtual) {
  return prisma.$transaction(async tx => { await autor(tx, sessao, "visualizar"); return dto(await ler(tx)); });
}
/** Uso exclusivamente servidor na execução manual autorizada. Nunca incluir
 * cliente ou segredos em DTO/action, logs, eventos ou mensagens de erro. */
export async function obterClienteHomologacaoBrasilNfe(sessao: SessaoAtual, ambiente: "HOMOLOGACAO" | "PRODUCAO" = "HOMOLOGACAO") {
  return prisma.$transaction(async tx => {
    await autor(tx, sessao, "editar");
    const s = await ler(tx);
    if (!s.config?.tokenCifrado || !s.loja?.cnpj || s.config.ambiente !== "HOMOLOGACAO") throw new ErroConfiguracaoBrasilNfe("Configure a empresa e a credencial protegida de homologação.");
    return { cliente: new ClienteBrasilNfe({ token: decifrar(s.config.tokenCifrado, contextoToken), ...(s.config.userTokenCifrado ? { userToken: decifrar(s.config.userTokenCifrado, contextoUserToken) } : {}) }, { ambienteNota: ambiente === "PRODUCAO" ? 1 : 2 }),
      versao: s.config.versao, emitenteHash: hashEmitente(s.loja), emitenteCnpj: cnpj(s.loja.cnpj) };
  });
}
export async function salvarConfiguracaoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  const e = validarSubstituicaoBrasilNfe(entrada);
  return prisma.$transaction(async tx => {
    const usuarioId = await autor(tx, sessao, "editar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const antes = await ler(tx);
    if ((antes.config?.versao ?? 0) !== e.versao) throw new ErroConfiguracaoBrasilNfe("Configuração alterada em outra tela. Reabra antes de salvar.");
    if (!antes.loja) throw new ErroConfiguracaoBrasilNfe("Salve o cadastro em Dados da empresa antes de vincular o emitente.");
    if (!e.tokenSubstituicao && !e.userTokenSubstituicao) return dto(antes);
    // AES-256-GCM existente, nonce aleatório e contextos distintos. AUTH_SECRET fica fora do banco.
    const substituicoes = { ...(e.tokenSubstituicao ? { tokenCifrado: cifrar(e.tokenSubstituicao, contextoToken) } : {}), ...(e.userTokenSubstituicao ? { userTokenCifrado: cifrar(e.userTokenSubstituicao, contextoUserToken) } : {}) };
    const depois = await tx.configuracaoBrasilNfe.upsert({ where: { id: "singleton" },
      create: { id: "singleton", lojaId: antes.loja.id, ...substituicoes },
      update: { ...substituicoes, versao: { increment: 1 }, diagnostico: Prisma.DbNull, emitenteHash: null, diagnosticoIniciadoEm: null, preRequisitos: Prisma.DbNull, preRequisitosEmitenteHash: null, preRequisitosIniciadoEm: null },
    });
    await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: depois.id, usuarioId, tipo: "CREDENCIAIS_SUBSTITUIDAS", dados: json({ versao: depois.versao, tokenSubstituido: !!e.tokenSubstituicao, userTokenSubstituido: !!e.userTokenSubstituicao, ambiente: "HOMOLOGACAO", emissaoHabilitada: false }) } });
    return dto({ config: depois, loja: antes.loja });
  });
}
/** Somente BuscarEmpresa/ConsultarServicos; não consulta SEFAZ nem documentos/pedidos. */
export async function validarConexaoBrasilNfe(entrada: unknown, sessao: SessaoAtual): Promise<ConfiguracaoBrasilNfeDto & { detalhesDiagnostico?: DetalhesDiagnosticoBrasilNfeDto }> {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada) || Object.keys(entrada).some(k => k !== "versao")) throw new ErroConfiguracaoBrasilNfe("Diagnóstico inválido.");
  const versao = (entrada as { versao: unknown }).versao; validarVersaoBrasilNfe(versao);
  const inicio = await prisma.$transaction(async tx => {
    await autor(tx, sessao, "editar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const atual = await ler(tx);
    if (!atual.config || atual.config.versao !== versao) throw new ErroConfiguracaoBrasilNfe("Salve a configuração atual antes de validar conexão.");
    if (atual.config.diagnosticoIniciadoEm && Date.now() - atual.config.diagnosticoIniciadoEm.getTime() < 30000) throw new ErroConfiguracaoBrasilNfe("Aguarde 30 segundos antes de repetir o diagnóstico.");
    await tx.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { diagnosticoIniciadoEm: new Date() } });
    return atual;
  });
  // Cada tentativa produz evidências novas, vinculadas à configuração/emitente conferidos.
  // Falha de serviços conserva a evidência de empresa desta tentativa, sem reutilizar confirmação antiga.
  const diagnostico = diagnosticoBrasilNfeVazio();
  // Conteúdo saneado só em memória desta chamada; não adicionar ao diagnóstico/auditoria.
  let detalhesTemporarios: DetalhesDiagnosticoServicosBrasilNfe | undefined;
  diagnostico.situacao = "PARCIAL"; diagnostico.verificadaEm = new Date().toISOString();
  if (!inicio.config!.tokenCifrado || !inicio.config!.userTokenCifrado || !/^\d{14}$/.test(cnpj(inicio.loja?.cnpj))) {
    diagnostico.consultasIndisponiveis = [...CONSULTAS_EMPRESA_BRASILNFE];
    diagnostico.pendencias.unshift("BuscarEmpresa e ConsultarServicos indisponíveis: exigem Token, UserToken e CNPJ local completo.");
  } else {
    let consultaAtual: ConsultaAdministrativaBrasilNfe = "BuscarEmpresa";
    try {
      const cliente = new ClienteBrasilNfe({ token: decifrar(inicio.config!.tokenCifrado, contextoToken), userToken: decifrar(inicio.config!.userTokenCifrado, contextoUserToken) });
      const empresa = await cliente.buscarEmpresa();
      diagnostico.acessoAutenticado = true;
      diagnostico.empresaVerificadaEm = new Date().toISOString();
      diagnostico.emitenteCorrespondente = cnpj(empresa.cnpj) === cnpj(inicio.loja?.cnpj);
      Object.assign(diagnostico.consultas[0], { situacao: "CONCLUIDA", verificadaEm: diagnostico.empresaVerificadaEm });
      if (!diagnostico.emitenteCorrespondente) {
        diagnostico.situacao = "FALHOU";
        diagnostico.pendencias.unshift("CNPJ do Brasil NFe diverge do cadastro do emitente no HUB. Conferir o Token da empresa.");
        diagnostico.consultasIndisponiveis = ["ConsultarServicos (emitente divergente)"];
      } else {
        if (!empresa.inscricaoEstadual || !empresa.crt) diagnostico.pendencias.unshift("Conferir IE e CRT do emitente no cadastro e na fundamentação fiscal.");
        if (!empresa.nfceHomologacao.cscConfigurado || !empresa.nfceHomologacao.idCscConfigurado) diagnostico.pendencias.unshift("NFC-e: conferir CSC e identificador de homologação com o responsável fiscal e Brasil NFe.");
        consultaAtual = "ConsultarServicos";
        const servicos = await cliente.consultarServicos();
        diagnostico.servicosEmissao = { ...classificarServicosEmissaoBrasilNfe(servicos.servicos), verificadosEm: new Date().toISOString() };
        Object.assign(diagnostico.consultas[1], { situacao: "CONCLUIDA", verificadaEm: diagnostico.servicosEmissao.verificadosEm });
        for (const [modelo, chave] of [["NF-e (55)", "nfe"], ["NFC-e (65)", "nfce"]] as const) {
          const estado = diagnostico.servicosEmissao[chave];
          if (estado === "INATIVO") diagnostico.pendencias.unshift(`Brasil NFe: serviço ${modelo} explicitamente inativo no catálogo consultado.`);
          if (estado === "NAO_CONFIRMADO") diagnostico.pendencias.unshift(`Brasil NFe: liberação do serviço ${modelo} não confirmada para este emitente.`);
        }
        if (servicos.avisosPresentes) diagnostico.pendencias.unshift("Fornecedor retornou avisos. Conferir no painel do Brasil NFe; detalhes sensíveis não são armazenados.");
      }
    } catch (erro) {
      if (consultaAtual === "ConsultarServicos") detalhesTemporarios = obterDetalhesTemporariosErroBrasilNfe(erro) ?? undefined;
      diagnostico.situacao = consultaAtual === "ConsultarServicos" && diagnostico.emitenteCorrespondente ? "CONECTADO_SERVICOS_PENDENTES" : "FALHOU";
      diagnostico.consultasIndisponiveis = consultaAtual === "BuscarEmpresa" ? [...CONSULTAS_EMPRESA_BRASILNFE] : ["ConsultarServicos"];
      const falha = (erro instanceof ErroHttpBrasilNfe ? sanitizarMetadadosErroBrasilNfe(erro.diagnosticoSeguro) : null) ?? {
        categoria: "CONFIGURACAO" as const, httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null,
      };
      Object.assign(diagnostico.consultas[consultaAtual === "BuscarEmpresa" ? 0 : 1], { situacao: "FALHOU", verificadaEm: new Date().toISOString(), falha });
      diagnostico.pendencias.unshift(mensagemFalha(consultaAtual, falha));
      if (falha.categoria === "CONTRATO" && falha.etapaContrato) diagnostico.pendencias.unshift(`${consultaAtual}: contrato inválido em ${ETAPAS_CONTRATO_BRASILNFE[falha.etapaContrato]}; nenhum valor da resposta foi armazenado.`);
    }
  }
  return prisma.$transaction(async tx => {
    const usuarioId = await autor(tx, sessao, "editar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const atual = await ler(tx);
    if (atual.config?.versao !== versao || hashEmitente(atual.loja) !== hashEmitente(inicio.loja)) throw new ErroConfiguracaoBrasilNfe("Configuração ou emitente mudou durante a consulta. Valide novamente a versão atual.");
    const depois = await tx.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { diagnostico: json(diagnostico), emitenteHash: hashEmitente(atual.loja), versao: { increment: 1 } } });
    await tx.eventoConfiguracaoBrasilNfe.create({ data: { configuracaoId: depois.id, usuarioId, tipo: "DIAGNOSTICO", dados: json({ versao: depois.versao, situacao: diagnostico.situacao, acessoAutenticado: diagnostico.acessoAutenticado, emitenteCorrespondente: diagnostico.emitenteCorrespondente, empresaVerificadaEm: diagnostico.empresaVerificadaEm, servicosEmissao: diagnostico.servicosEmissao, consultas: diagnostico.consultas, preRequisitosConferidos: false, consultasIndisponiveis: diagnostico.consultasIndisponiveis, homologacaoFiscal: "PENDENTE" }) } });
    const dados = dto({ config: depois, loja: atual.loja });
    // A autorização, versão e emitente foram novamente conferidos nesta transação.
    // Texto não passa por json(), Prisma, logs ou qualquer cache de sessão.
    return detalhesTemporarios ? { ...dados, detalhesDiagnostico: {
      ...detalhesTemporarios, versao: depois.versao,
      verificadaEm: diagnostico.consultas[1].verificadaEm!,
      expiraEm: new Date(Date.now() + 5 * 60_000).toISOString(),
    } } : dados;
  });
}
