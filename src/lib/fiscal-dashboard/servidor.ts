import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { obterRegimeFiscalEmpresaBrasilNfe } from "../fiscal-saida/brasilnfe/regime-empresa";
import { SECOES } from "@/lib/permissoes/catalogo";
import { AgregadorDashboardFiscal, type SaidaParaDashboard } from "./agregacao";
import { centavosFiscais, extrairEvidenciaFiscal, modeloPelaChave, normalizarFiltrosDashboard } from "./dominio";
import { resumirIntegracaoDashboard } from "./integracao";
import { lerConfiguracaoOpcionalDashboard } from "./configuracao-opcional";
import { resumirCertificadoDashboard } from "./certificado";
import { recursoDocumentoDashboard } from "./documento";
import { tipoDocumentoDashboard } from "./periodo";
import { limitesPeriodoDashboard } from "./periodo";
import { NOTAS_NFSE_VISIVEIS } from "@/lib/nfse/visibilidade";
import { evidenciaServicoDashboard } from "./servicos";
import type { DashboardFiscalDto, FiltrosDashboardFiscal } from "./tipos";

const tamanhoPagina = 100;
const padraoDataFiscal = "<(?:[[:alnum:]_.-]+:)?(?:dhEmi|dEmi)>[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}";
const padraoChaveFiscal = "<(?:[[:alnum:]_.-]+:)?chNFe>[[:space:]]*([0-9]{44})[[:space:]]*</";
type NotaRecebidaParaDashboard = { id: string; chaveAcesso: string; xml: string | null; valorTotal: string | null; dataEmissao: Date | null; documentosSefaz: string[] | null };

async function lerSaidas(agregador: AgregadorDashboardFiscal) {
  let cursor = "";
  const { mes, ambiente } = agregador.filtros;
  const { de, ate } = limitesPeriodoDashboard(agregador.filtros);
  const diaXml = "<(?:[[:alnum:]_.-]+:)?(?:dhEmi|dEmi)>[[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2})";
  const intervalo = agregador.filtros.de !== undefined || agregador.filtros.ate !== undefined;
  while (true) {
    // Competência na fonte, ampliada somente para lacunas e pendências.
    // O parser confirma a data original do XML com seu offset e a identidade fiscal.
    const pagina = await prisma.$queryRaw<SaidaParaDashboard[]>(Prisma.sql`
      SELECT d.id, d.ambiente, d.status, d."chaveFiscal", d.protocolo, d.numero, d.xml,
        d."pedidoId", p.numero AS "pedidoNumero"
      FROM "DocumentoFiscalSaida" d
      JOIN "PedidoVenda" p ON p.id = d."pedidoId"
      WHERE d.id > ${cursor}
        AND d.ambiente IN (${ambiente}, 'NAO_CONFIGURADO')
        AND (${intervalo ? Prisma.sql`((${!de} OR substring(d.xml FROM ${diaXml}) >= ${de}) AND (${!ate} OR substring(d.xml FROM ${diaXml}) <= ${ate}))
          OR ((${!de} OR substring(d."chaveFiscal" FROM 3 FOR 4) >= ${de.replaceAll("-", "").slice(2, 6)}) AND (${!ate} OR substring(d."chaveFiscal" FROM 3 FOR 4) <= ${ate.replaceAll("-", "").slice(2, 6)}))`
          : Prisma.sql`d.xml LIKE ${`%${mes}-%`} OR substring(d."chaveFiscal" FROM 3 FOR 4) = ${mes.replace("-", "").slice(2)}`}
          OR d.xml IS NULL OR d.xml !~ ${padraoDataFiscal}
          OR d.status <> 'AUTORIZADO')
      ORDER BY d.id ASC LIMIT ${tamanhoPagina}
    `);
    for (const documento of pagina) agregador.adicionarSaida(documento);
    if (pagina.length < tamanhoPagina) break;
    cursor = pagina[pagina.length - 1].id;
  }
}

export function normalizarNotaRecebidaDashboard(nota: NotaRecebidaParaDashboard, cnpj: string) {
  const fontes = [nota.xml, ...(nota.documentosSefaz ?? [])].filter((xml): xml is string => !!xml).map(extrairEvidenciaFiscal);
  const mesmaChave = fontes.filter(fonte => fonte.chave === nota.chaveAcesso);
  const documento = mesmaChave.find(fonte => fonte.autorizado && !fonte.resumo)
    ?? mesmaChave.find(fonte => fonte.resumo) ?? extrairEvidenciaFiscal(null);
  const cancelamento = mesmaChave.find(fonte => fonte.cancelado && (fonte.ambiente === "PRODUCAO" || (fonte.resumo && fonte.ambiente === null && !!nota.documentosSefaz?.length)));
  // resNFe não contém tpAmb. Seu vínculo com o diário de distribuição do CNPJ
  // comprova produção: distribuicao.ts envia explicitamente tpAmb=1.
  const resumoDistribuido = documento.resumo && !!nota.documentosSefaz?.length && mesmaChave.some(f => f === documento);
  const ambienteComprovado = documento.ambiente === "PRODUCAO" && documento.destinatarioCnpj === cnpj
    || resumoDistribuido && documento.ambiente === null;
  const evidencia = { ...documento, cancelado: !!cancelamento, ambiente: documento.ambiente ?? (resumoDistribuido ? "PRODUCAO" as const : null) };
  const cancelamentoPendente = !cancelamento && mesmaChave.some(fonte => fonte.eventoCancelamentoResumido
    && (fonte.ambiente === "PRODUCAO" || fonte.ambiente === null && !!nota.documentosSefaz?.length));
  if (!evidencia.diaEmissao && nota.dataEmissao && Number.isFinite(nota.dataEmissao.getTime())) {
    // dataEmissao é projeção fiscal persistida, nunca createdAt/updatedAt.
    evidencia.diaEmissao = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(nota.dataEmissao);
  }
  // Projeções normalizadas só completam uma fonte que demonstra situação e ambiente.
  if (evidencia.total === null && evidencia.autorizado && ambienteComprovado) evidencia.total = centavosFiscais(nota.valorTotal);
  if (!evidencia.modelo) evidencia.modelo = modeloPelaChave(nota.chaveAcesso);
  const foraDoEmitente = !!documento.destinatarioCnpj && documento.destinatarioCnpj !== cnpj;
  return { id: nota.id, chave: nota.chaveAcesso, evidencia, ambienteComprovado, foraDoEmitente, cancelamentoPendente };
}

async function lerEntradas(agregador: AgregadorDashboardFiscal, cnpj: string | null) {
  if (agregador.filtros.ambiente !== "PRODUCAO") {
    agregador.indisponibilizarEntradas("A distribuição SEFAZ existente consulta somente produção; entradas de homologação não estão disponíveis nesta fonte.");
    return;
  }
  if (!cnpj || !/^\d{14}$/.test(cnpj)) {
    agregador.indisponibilizarEntradas("O CNPJ do emitente não está disponível para delimitar as notas recebidas.");
    return;
  }
  const { mes } = agregador.filtros;
  const { de, ate } = limitesPeriodoDashboard(agregador.filtros);
  // Ampliado em um dia para offsets; o XML decide o dia fiscal.
  const inicio = new Date(`${de || "0001-01-01"}T00:00:00Z`); if (de && de > "0001-01-01") inicio.setUTCDate(inicio.getUTCDate() - 1);
  const fim = new Date(`${ate || "9999-12-31"}T00:00:00Z`); fim.setUTCDate(fim.getUTCDate() + 2);
  const intervalo = agregador.filtros.de !== undefined || agregador.filtros.ate !== undefined;
  let cursor = "";
  while (true) {
    const pagina = await prisma.$queryRaw<Omit<NotaRecebidaParaDashboard, "documentosSefaz">[]>(Prisma.sql`
      WITH sefaz_mes AS MATERIALIZED (
        SELECT substring(s.xml FROM ${padraoChaveFiscal}) AS chave
        FROM "SefazDocumentoRecebido" s WHERE s.cnpj = ${cnpj} AND (${intervalo} OR s.xml LIKE ${`%${mes}-%`})
      )
      SELECT n.id, n."chaveAcesso", n.xml, n."valorTotal"::text AS "valorTotal", n."dataEmissao"
      FROM "NotaFiscalRecebida" n
      WHERE n.id > ${cursor}
        AND (n."dataEmissao" >= ${inicio} AND n."dataEmissao" < ${fim}
          OR (${intervalo} AND n.xml IS NOT NULL) OR n.xml LIKE ${`%${mes}-%`} OR n."dataEmissao" IS NULL
          OR n."chaveAcesso" IN (SELECT chave FROM sefaz_mes))
      ORDER BY n.id ASC LIMIT ${tamanhoPagina}
    `);
    if (pagina.length) {
      // Lê o diário uma vez por página de chaves, em vez de uma varredura por nota.
      const fontes = await prisma.$queryRaw<{ chave: string; xml: string }[]>(Prisma.sql`
        SELECT fonte.chave, fonte.xml FROM (
          SELECT substring(s.xml FROM ${padraoChaveFiscal}) AS chave, s.xml
          FROM "SefazDocumentoRecebido" s WHERE s.cnpj = ${cnpj}
        ) fonte WHERE fonte.chave IN (${Prisma.join(pagina.map(nota => nota.chaveAcesso))})
      `);
      const porChave = new Map<string, string[]>();
      for (const fonte of fontes) {
        const documentos = porChave.get(fonte.chave) ?? [];
        documentos.push(fonte.xml); porChave.set(fonte.chave, documentos);
      }
      for (const nota of pagina) agregador.adicionarEntrada(normalizarNotaRecebidaDashboard({ ...nota, documentosSefaz: porChave.get(nota.chaveAcesso) ?? [] }, cnpj));
    }
    if (pagina.length < tamanhoPagina) break;
    cursor = pagina[pagina.length - 1].id;
  }
}

async function lerServicos(agregador: AgregadorDashboardFiscal, cnpj: string | null) {
  if (!cnpj) return;
  const { de, ate } = limitesPeriodoDashboard(agregador.filtros);
  let cursor = "";
  while (true) {
    const notas = await prisma.notaFiscalServico.findMany({
      where: { AND: [NOTAS_NFSE_VISIVEIS, { tomadorCnpj: cnpj }, { id: { gt: cursor } }] },
      select: { id: true, numero: true, status: true, origem: true, importadaManualmente: true, xml: true, dataEmissao: true, valorServico: true },
      orderBy: { id: "asc" }, take: tamanhoPagina,
    });
    for (const nota of notas) {
      const xml = nota.xml ?? "";
      const evidencia = evidenciaServicoDashboard(xml, cnpj);
      const dia = evidencia.dataInformada ? evidencia.dia : nota.dataEmissao && Number.isFinite(nota.dataEmissao.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(nota.dataEmissao) : null;
      if (dia && (de && dia < de || ate && dia > ate)) continue;
      // A distribuição nacional existente usa os endpoints de produção. Arquivo
      // manual sem ambiente explícito não recebe um ambiente presumido.
      const ambiente = evidencia.ambiente ?? (!evidencia.ambienteInformado && nota.origem === "NACIONAL" && !nota.importadaManualmente ? "PRODUCAO" : null);
      if (ambiente && ambiente !== agregador.filtros.ambiente) continue;
      if (!ambiente && agregador.filtros.ambiente === "HOMOLOGACAO") continue;
      agregador.adicionarServico({ id: nota.id, numero: nota.numero, status: nota.status, dataFiscal: dia,
        valor: nota.valorServico?.toFixed(2) ?? null, comprovado: !!ambiente && evidencia.documento });
    }
    if (notas.length < tamanhoPagina) break;
    cursor = notas[notas.length - 1].id;
  }
}

/** Fronteira autorizada de leitura. Nenhuma consulta externa ou escrita fiscal. */
export async function obterDashboardFiscal(parametros: Record<string, string | string[] | undefined>, agora = new Date()): Promise<DashboardFiscalDto> {
  const sessao = await exigirPermissao("financeiro.fiscal.painel");
  const filtros: FiltrosDashboardFiscal = normalizarFiltrosDashboard(parametros, agora);
  const recursoIntegracaoDisponivel = SECOES.some(secao => secao.id === "configuracoes.brasilnfe" && secao.rota === "/configuracoes/integracoes/brasilnfe");
  const [loja, leituraConfiguracao, certificado, acessoFiscal, acessoNotas, acessoConfiguracao, acessoPedidos] = await Promise.all([
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } }),
    lerConfiguracaoOpcionalDashboard(),
    // Somente validade extraída do certificado; sem arquivo ou senha.
    prisma.certificadoDigital.findUnique({ where: { id: "singleton" }, select: { validoAte: true } }).catch(() => null),
    podeAcessar("vendas.fiscal"), podeAcessar("notas"), recursoIntegracaoDisponivel ? podeAcessar("configuracoes.brasilnfe") : false, podeAcessar("vendas.pedidos"),
  ]);
  const configuracao = leituraConfiguracao.configuracao;
  const cnpj = loja?.cnpj?.replace(/\D/g, "") ?? null;
  const agregador = new AgregadorDashboardFiscal(filtros, cnpj);
  const leituras = await Promise.allSettled([lerSaidas(agregador), lerEntradas(agregador, cnpj), lerServicos(agregador, cnpj)]);
  // Falha de leitura torna a fonte indisponível, sem mensagens ou dados internos do banco.
  if (leituras[0].status === "rejected") agregador.indisponibilizarSaidas();
  if (leituras[1].status === "rejected") agregador.indisponibilizarEntradas("Não foi possível ler as notas recebidas e o diário SEFAZ.");
  if (leituras[2].status === "rejected") agregador.indisponibilizarEntradas("Não foi possível ler as notas fiscais de serviço recebidas.");
  const agregados = agregador.concluir();
  const acessoServicos = await podeAcessar("financeiro.nfse");
  for (const documento of agregados.ultimosDocumentos) {
    const recurso = recursoDocumentoDashboard(tipoDocumentoDashboard(documento));
    documento.detalhesDisponiveis = recurso === "vendas.fiscal" ? acessoFiscal && acessoPedidos : recurso === "notas" ? acessoNotas : acessoServicos;
  }
  if (!acessoPedidos) for (const documento of agregados.ultimosDocumentos) {
    documento.pedidoId = null; documento.pedidoNumero = null;
  }
  const links = { grupos: acessoFiscal ? "/financeiro/fiscal/grupos" : null, vinculos: acessoFiscal ? "/financeiro/fiscal/vinculos" : null,
    notasRecebidas: acessoNotas ? "/notas-fiscais" : null, configuracao: acessoConfiguracao && leituraConfiguracao.tabelaDisponivel ? "/configuracoes/integracoes/brasilnfe" : null };
  // Somente metadados do controle manual. Não abre cliente, decifra credenciais
  // nem exige a permissão administrativa reservada à edição da integração.
  const habilitacoes = leituraConfiguracao.tabelaDisponivel && Number.isSafeInteger(configuracao?.versao) && (configuracao?.versao ?? 0) > 0
    ? await prisma.eventoConfiguracaoBrasilNfe.findMany({ where: { configuracaoId: "singleton", tipo: "EMISSAO_MANUAL_HABILITACAO" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, dados: true, createdAt: true } }).catch(() => []) : [];
  const integracao = resumirIntegracaoDashboard(configuracao, loja, filtros.ambiente, habilitacoes);
  integracao.certificado = resumirCertificadoDashboard(certificado, agora);
  if (!integracao.emissaoManual?.nfe) agregados.pendencias.push({ codigo: "EMISSAO_BLOQUEADA", titulo: "NF-e manual não habilitada", descricao: "Conferir homologação e habilitação manual do modelo 55 para este ambiente e emitente. Conexão administrativa e serviço contratado não substituem essas evidências.", quantidade: null, href: links.configuracao });
  if (!integracao.emissaoManual?.nfce) agregados.pendencias.push({ codigo: "NFCE_MANUAL_BLOQUEADA", titulo: "NFC-e manual não habilitada", descricao: "O modelo 65 exige sua própria homologação e habilitação neste ambiente. A liberação da NF-e não libera NFC-e.", quantidade: null, href: links.configuracao });
  for (const pendencia of agregados.pendencias) if (pendencia.codigo.startsWith("ENTRADAS_")) pendencia.href = links.notasRecebidas;
  const regimeFiscal = await obterRegimeFiscalEmpresaBrasilNfe(undefined, sessao);
  return { filtros, regimeFiscal, emitente: { nome: loja?.nome ?? null, cnpj: loja?.cnpj ?? null }, ...agregados, integracao, links,
    avisos: ["Saídas: documentos locais do HUB com XML autorizado, total vNF e data de emissão fiscal. Canceladas ficam fora do faturamento.",
      "Despesas: NF-e/NFC-e recebidas, deduplicadas por chave, e NFS-e do tomador nas fontes existentes. Usa a data de emissão e o valor fiscal do serviço; canceladas ficam fora da soma. Não representa pagamento financeiro.",
      "NFS-e sem comprovação de ambiente, XML ou valor tornam as despesas indisponíveis. A distribuição nacional automática existente comprova produção. Arquivos manuais exigem ambiente explícito.",
      "Intervalos acima de dez anos mostram no gráfico somente os dias com documentos; os totais conservam todo o período. Datas vazias abrangem o histórico disponível.",
      "Pendências sem data fiscal são operacionais e não pertencem automaticamente ao mês selecionado.",
      ...(filtros.ambiente === "HOMOLOGACAO" ? ["Ambiente de homologação: valores de teste, sem efeito fiscal de produção."] : []),
      ...(configuracao && configuracao.ambiente !== filtros.ambiente ? ["O diagnóstico administrativo salvo pertence a outro ambiente; serviços do ambiente selecionado não estão confirmados."] : []),
    ] };
}
