import { createHash } from "node:crypto";
import { restaurarPreRequisitosBrasilNfe } from "../fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { habilitacaoCorrespondeBrasilNfe, restaurarHabilitacaoEmissaoBrasilNfe } from "../fiscal-saida/brasilnfe/operacional-dominio";
import type { IntegracaoDashboardFiscal, AmbienteDashboardFiscal, EstadoServicoDashboardFiscal } from "./tipos";

export type EmitenteIntegracaoDashboard = { id: string; nome: string | null; cnpj: string | null; enderecoEstruturado: unknown };
export type ConfiguracaoIntegracaoDashboard = { ambiente: string; tokenConfigurado: boolean; userTokenConfigurado: boolean; diagnostico: unknown; emitenteHash: string | null; versao?: number; preRequisitos?: unknown; preRequisitosEmitenteHash?: string | null };
export type EventoHabilitacaoDashboard = { id: string; dados: unknown; createdAt: Date };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const instante = (v: unknown): string | null => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
/** Reconhece somente o diagnóstico administrativo persistido e ainda ligado ao emitente. */
export function resumirIntegracaoDashboard(config: ConfiguracaoIntegracaoDashboard | null, loja: EmitenteIntegracaoDashboard | null, ambiente: AmbienteDashboardFiscal, eventosHabilitacao: EventoHabilitacaoDashboard[] = []): IntegracaoDashboardFiscal {
  const base: IntegracaoDashboardFiscal = {
    ambienteConfigurado: config?.ambiente ?? null, configurada: !!config,
    credenciaisConfiguradas: !!config?.tokenConfigurado && !!config.userTokenConfigurado,
    situacao: config ? "NAO_VERIFICADA" : "NAO_CONFIGURADA", verificadaEm: null,
    servicos: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null },
    certificado: { situacao: "NAO_VERIFICADO", validoAte: null, diasParaVencer: null }, emissaoHabilitada: false,
  };
  // Mesma projeção ordenada usada ao persistir configuração e pré-requisitos.
  // A ordem das propriedades do objeto recebido não altera a identidade fiscal.
  const identidade = loja ? { id: loja.id, nome: loja.nome, cnpj: loja.cnpj, enderecoEstruturado: loja.enderecoEstruturado } : null;
  const hashEmitente = createHash("sha256").update(JSON.stringify(identidade)).digest("hex");
  if (loja && Number.isSafeInteger(config?.versao) && (config?.versao ?? 0) > 0) {
    const ultimo = [...eventosHabilitacao].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .find(e => objeto(e.dados).ambiente === ambiente);
    const habilitacao = ultimo ? restaurarHabilitacaoEmissaoBrasilNfe(ultimo.id, ultimo.dados, ultimo.createdAt) : null;
    const contexto = { versao: config!.versao!, emitenteHash: hashEmitente };
    const nfe = habilitacaoCorrespondeBrasilNfe(habilitacao, contexto, ambiente, 55), nfce = habilitacaoCorrespondeBrasilNfe(habilitacao, contexto, ambiente, 65);
    const correspondente = habilitacao?.versaoConfiguracao === contexto.versao && habilitacao.emitenteHash === contexto.emitenteHash;
    base.emissaoManual = { nfe, nfce, atualizadaEm: correspondente ? habilitacao.criadaEm : null };
    base.emissaoHabilitada = nfe || nfce;
  }
  if (config?.preRequisitosEmitenteHash === hashEmitente && Number.isSafeInteger(config.versao) && (config.versao ?? 0) > 0 && config.versao === objeto(config.preRequisitos).versaoConfiguracao) {
    const pre = restaurarPreRequisitosBrasilNfe(config.preRequisitos, config.versao!);
    const painel = pre.evidenciaPainel, idade = painel ? Date.now() - Date.parse(painel.observadoEm) : NaN;
    if (painel && idade >= -60000 && idade <= 7 * 86400000) base.evidenciaPainel = { origem: painel.origem, observadoEm: painel.observadoEm, servicoNfeNfceAtivo: painel.servicoNfeNfceAtivo, certificadoValidade: painel.certificadoValidade };
    if (config.ambiente === ambiente && pre.empresaCorrespondente === true && pre.empresaVerificadaEm) { base.situacao = "CONECTADA"; base.verificadaEm = pre.empresaVerificadaEm; }
  }
  if (!config?.diagnostico) return base;
  if (hashEmitente !== config.emitenteHash) { if (!base.evidenciaPainel && base.situacao !== "CONECTADA") base.situacao = "DESATUALIZADA"; return base; }
  const diagnostico = objeto(config.diagnostico);
  const dataDiagnostico = instante(diagnostico.verificadaEm);
  if (!dataDiagnostico || config.ambiente !== ambiente) return base;
  if (!base.verificadaEm || dataDiagnostico > base.verificadaEm) base.verificadaEm = dataDiagnostico;
  if (diagnostico.acessoAutenticado === true && diagnostico.emitenteCorrespondente === true) base.situacao = "CONECTADA";
  else if (diagnostico.situacao === "FALHOU" && base.verificadaEm === dataDiagnostico) base.situacao = "FALHOU";
  const servicos = objeto(diagnostico.servicosEmissao);
  const dataServicos = instante(servicos.verificadosEm);
  if (base.situacao === "CONECTADA" && dataServicos) {
    const estado = (v: unknown): EstadoServicoDashboardFiscal => v === "ATIVO" || v === "INATIVO" ? v : "NAO_CONFIRMADO";
    base.servicos = { nfe: estado(servicos.nfe), nfce: estado(servicos.nfce), verificadosEm: dataServicos };
  }
  return base;
}
