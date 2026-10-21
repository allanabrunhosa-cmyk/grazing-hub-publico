import { extrairEvidenciaFiscal, modeloPelaChave, moedaFiscal, type EvidenciaDocumentoFiscal } from "./dominio";
import { limitesPeriodoDashboard, pertenceAoPeriodoDashboard, mesCandidatoDashboard, tipoDocumentoDashboard } from "./periodo";
import { centavosFiscais } from "./dominio";
import type { DashboardFiscalDto, DocumentoDashboardFiscal, FiltrosDashboardFiscal, MetricaDashboardFiscal, PendenciaDashboardFiscal } from "./tipos";

export type SaidaParaDashboard = {
  id: string; ambiente: string; status: string; chaveFiscal: string | null; protocolo: string | null;
  numero: string | null; xml: string | null; pedidoId: string; pedidoNumero: number | string;
};
export type EntradaParaDashboard = {
  id: string; chave: string; evidencia: EvidenciaDocumentoFiscal; ambienteComprovado: boolean; foraDoEmitente?: boolean; cancelamentoPendente?: boolean;
};
type Soma = { total: bigint; quantidade: number; valoresAusentes: number; datasAusentes: number; identidadesAusentes: number };
const novaSoma = (): Soma => ({ total: BigInt(0), quantidade: 0, valoresAusentes: 0, datasAusentes: 0, identidadesAusentes: 0 });
function somar(soma: Soma, valor: bigint | null) {
  soma.quantidade++;
  if (valor === null) soma.valoresAusentes++; else soma.total += valor;
}
function metrica(soma: Soma, motivo: string | null = null): MetricaDashboardFiscal {
  const indisponivel = motivo ?? (soma.datasAusentes ? "Há documentos sem data fiscal oficial; a competência não pode ser confirmada." : soma.identidadesAusentes ? "Há documentos sem comprovação suficiente de identidade, situação ou ambiente fiscal." : soma.valoresAusentes ? "Há documentos sem total fiscal oficial; a soma está indisponível." : null);
  return { valor: indisponivel ? null : moedaFiscal(soma.total), quantidade: motivo || soma.datasAusentes || soma.identidadesAusentes ? null : soma.quantidade, motivo: indisponivel };
}

/** Conserva os totais e até oito documentos por tipo e situação (cancelado/demais). */
export class AgregadorDashboardFiscal {
  private saidas = novaSoma();
  private entradas = novaSoma();
  private canceladas = novaSoma();
  private modelos = new Map<55 | 65, Soma>([[55, novaSoma()], [65, novaSoma()]]);
  private dias: Map<string, { saidas: Soma; entradas: Soma }>;
  private documentos: DocumentoDashboardFiscal[] = [];
  private contadores = new Map<string, number>();
  private motivoSaidas: string | null = null;
  private motivoEntradas: string | null = null;
  constructor(readonly filtros: FiltrosDashboardFiscal, private emitenteCnpj: string | null) {
    this.dias = new Map();
  }
  private movimento(dia: string) {
    if (!this.dias.has(dia)) this.dias.set(dia, { saidas: novaSoma(), entradas: novaSoma() });
    return this.dias.get(dia)!;
  }
  private tipos = { NF_ENTRADA: 0, NFC_ENTRADA: 0, NF_SAIDA: 0, NFS_ENTRADA: 0 };
  private contar(codigo: string) { this.contadores.set(codigo, (this.contadores.get(codigo) ?? 0) + 1); }
  private recente(documento: DocumentoDashboardFiscal) {
    this.tipos[tipoDocumentoDashboard(documento)]++;
    this.documentos.push(documento);
    this.documentos.sort((a, b) => (b.dataFiscal ?? "").localeCompare(a.dataFiscal ?? "") || b.id.localeCompare(a.id));
    const grupos = new Map<string, number>();
    this.documentos = this.documentos.filter(doc => {
      const chave = `${tipoDocumentoDashboard(doc)}:${doc.status === "CANCELADO" ? "CANCELADO" : "OUTROS"}`;
      const quantidade = (grupos.get(chave) ?? 0) + 1;
      grupos.set(chave, quantidade); return quantidade <= 8;
    });
  }
  indisponibilizarSaidas() { this.motivoSaidas = "Não foi possível ler os documentos de saída do HUB."; }
  indisponibilizarEntradas(motivo: string) { this.motivoEntradas = motivo; }
  adicionarSaida(documento: SaidaParaDashboard) {
    if (documento.ambiente === "NAO_CONFIGURADO") { this.contar("SAIDAS_SEM_AMBIENTE"); return; }
    if (documento.ambiente !== this.filtros.ambiente) return;
    const evidencia = extrairEvidenciaFiscal(documento.xml);
    const dia = evidencia.diaEmissao;
    const pertinente = !!dia && pertenceAoPeriodoDashboard(dia, this.filtros);
    if (!["AUTORIZADO", "CANCELADO"].includes(documento.status)) {
      if (!dia || pertinente) this.contar(documento.status === "REJEITADO" ? "SAIDAS_REJEITADAS" : "SAIDAS_PENDENTES");
      if (!dia) this.contar("PENDENTES_SEM_DATA");
      return;
    }
    if (documento.status === "CANCELADO") {
      const identidadeVinculada = evidencia.ambiente === this.filtros.ambiente && evidencia.chave === documento.chaveFiscal
        && !!this.emitenteCnpj && evidencia.chave?.slice(6, 20) === this.emitenteCnpj;
      // O protocolo atual pode ser o de cancelamento. O XML de autorização conserva
      // seu protocolo original; ambos devem existir e a identidade fiscal deve coincidir.
      const autorizacaoVinculada = identidadeVinculada && evidencia.autorizado
        && evidencia.emitenteCnpj === this.emitenteCnpj && !!evidencia.protocolo && !!documento.protocolo;
      // O retorno normalizado existente não conserva dhRegEvento. createdAt não é a data do cancelamento.
      const dataCancelamento = identidadeVinculada && evidencia.cancelado && evidencia.protocolo === documento.protocolo
        ? evidencia.diaCancelamento : null;
      if (!dataCancelamento) { this.canceladas.datasAusentes++; this.contar("CANCELADAS_SEM_DATA"); }
      else if (pertenceAoPeriodoDashboard(dataCancelamento, this.filtros)) somar(this.canceladas, evidencia.total);
      if (!autorizacaoVinculada && !dataCancelamento) this.contar("CANCELADAS_SEM_COMPROVACAO");
      if (autorizacaoVinculada && pertinente) this.recente({ id: documento.id, origem: "SAIDA", modelo: modeloPelaChave(documento.chaveFiscal), numero: documento.numero,
        status: "CANCELADO", dataFiscal: dia,
        valor: evidencia.total !== null ? moedaFiscal(evidencia.total) : null,
        pedidoId: documento.pedidoId, pedidoNumero: String(documento.pedidoNumero) });
      return;
    }
    if (dia && !pertinente) return;
    if (!dia) {
      // A chave identifica o mês de emissão, mas não substitui a data fiscal oficial do gráfico.
      const mesChave = documento.chaveFiscal && /^\d{44}$/.test(documento.chaveFiscal) ? `20${documento.chaveFiscal.slice(2, 4)}-${documento.chaveFiscal.slice(4, 6)}` : null;
      if (mesChave && !mesCandidatoDashboard(mesChave, this.filtros)) return;
      this.saidas.datasAusentes++; this.contar("SAIDAS_SEM_DATA"); return;
    }
    const comprovado = evidencia.autorizado && evidencia.ambiente === this.filtros.ambiente
      && evidencia.chave === documento.chaveFiscal && evidencia.protocolo === documento.protocolo
      && !!this.emitenteCnpj && evidencia.emitenteCnpj === this.emitenteCnpj;
    if (!comprovado) { this.saidas.identidadesAusentes++; this.contar("SAIDAS_SEM_COMPROVACAO"); return; }
    somar(this.saidas, evidencia.total);
    const movimento = this.movimento(dia);
    if (movimento) somar(movimento.saidas, evidencia.total);
    if (evidencia.modelo) somar(this.modelos.get(evidencia.modelo)!, evidencia.total);
    if (evidencia.total === null) this.contar("SAIDAS_SEM_VALOR");
    this.recente({ id: documento.id, origem: "SAIDA", modelo: evidencia.modelo, numero: evidencia.numero, status: documento.status,
      dataFiscal: dia, valor: evidencia.total === null ? null : moedaFiscal(evidencia.total), pedidoId: documento.pedidoId, pedidoNumero: String(documento.pedidoNumero) });
  }
  adicionarEntrada({ id, chave, evidencia, ambienteComprovado, foraDoEmitente, cancelamentoPendente }: EntradaParaDashboard) {
    if (foraDoEmitente) return;
    if (evidencia.ambiente && evidencia.ambiente !== this.filtros.ambiente) return;
    const dia = evidencia.diaEmissao;
    if (dia && !pertenceAoPeriodoDashboard(dia, this.filtros)) return;
    if (!dia) {
      const mesChave = /^\d{44}$/.test(chave) ? `20${chave.slice(2, 4)}-${chave.slice(4, 6)}` : null;
      if (mesChave && !mesCandidatoDashboard(mesChave, this.filtros)) return;
      this.entradas.datasAusentes++; this.contar("ENTRADAS_INCOMPLETAS"); return;
    }
    if (evidencia.cancelado) {
      this.contar("ENTRADAS_CANCELADAS");
      this.recente({ id, origem: "ENTRADA", modelo: evidencia.modelo, numero: evidencia.numero, status: "CANCELADO", dataFiscal: dia,
        valor: evidencia.total === null ? null : moedaFiscal(evidencia.total), pedidoId: null, pedidoNumero: null });
      return;
    }
    if (cancelamentoPendente) { this.entradas.identidadesAusentes++; this.contar("ENTRADAS_CANCELAMENTO_PENDENTE"); return; }
    if (!ambienteComprovado || !evidencia.autorizado) { this.entradas.identidadesAusentes++; this.contar("ENTRADAS_INCOMPLETAS"); return; }
    somar(this.entradas, evidencia.total);
    const movimento = this.movimento(dia);
    if (movimento) somar(movimento.entradas, evidencia.total);
    if (evidencia.total === null) this.contar("ENTRADAS_INCOMPLETAS");
    this.recente({ id, origem: "ENTRADA", modelo: evidencia.modelo, numero: evidencia.numero,
      status: evidencia.resumo ? "RESUMO_AUTORIZADO" : "AUTORIZADO", dataFiscal: dia,
      valor: evidencia.total === null ? null : moedaFiscal(evidencia.total), pedidoId: null, pedidoNumero: null });
  }
  adicionarServico(nota: { id: string; numero: string | null; status: string; dataFiscal: string | null; valor: string | null; comprovado: boolean }) {
    if (nota.dataFiscal && !pertenceAoPeriodoDashboard(nota.dataFiscal, this.filtros)) return;
    if (!nota.dataFiscal || !nota.comprovado) {
      this.entradas.identidadesAusentes++; this.contar("ENTRADAS_INCOMPLETAS"); return;
    }
    const valor = centavosFiscais(nota.valor);
    const cancelada = nota.status === "CANCELADA";
    if (!cancelada) { somar(this.entradas, valor); somar(this.movimento(nota.dataFiscal).entradas, valor); }
    this.recente({ id: nota.id, origem: "ENTRADA", tipo: "NFS_ENTRADA", modelo: null, numero: nota.numero,
      status: cancelada ? "CANCELADO" : "RECEBIDA", dataFiscal: nota.dataFiscal, valor: valor === null ? null : moedaFiscal(valor), pedidoId: null, pedidoNumero: null });
  }
  concluir(): Pick<DashboardFiscalDto, "metricas" | "movimentoDiario" | "receitaPorDocumento" | "ultimosDocumentos" | "documentosPorTipo" | "pendencias"> {
    const limites = limitesPeriodoDashboard(this.filtros), observados = [...this.dias.keys()].sort();
    const de = limites.de || observados[0], ate = limites.ate || observados.at(-1);
    if (de && ate) {
      const inicio = new Date(`${de}T12:00:00Z`), fim = new Date(`${ate}T12:00:00Z`);
      // Intervalos extensos conservam todos os valores e mostram os dias observados.
      if ((fim.getTime() - inicio.getTime()) / 86400000 <= 3660) for (const data = inicio; data <= fim; data.setUTCDate(data.getUTCDate() + 1)) this.movimento(data.toISOString().slice(0, 10));
    }
    const faturamento = metrica(this.saidas, this.motivoSaidas), entradas = metrica(this.entradas, this.motivoEntradas);
    const canceladas = metrica(this.canceladas, this.motivoSaidas);
    const ticketMedio: MetricaDashboardFiscal = faturamento.valor === null ? { ...faturamento } : {
      valor: this.saidas.quantidade ? moedaFiscal((this.saidas.total + BigInt(Math.floor(this.saidas.quantidade / 2))) / BigInt(this.saidas.quantidade)) : null,
      quantidade: this.saidas.quantidade, motivo: this.saidas.quantidade ? null : "Sem documentos autorizados no período para calcular a média.",
    };
    const descricoes: Record<string, [string, string]> = {
      SAIDAS_SEM_AMBIENTE: ["Solicitações sem ambiente", "Solicitações locais sem emitente configurado. Não entram nos valores de produção ou homologação e não têm competência fiscal atribuída."],
      SAIDAS_PENDENTES: ["Saídas pendentes", "Solicitações aguardando preparação, processamento ou conferência. Não compõem o faturamento autorizado."],
      SAIDAS_REJEITADAS: ["Documentos rejeitados", "Rejeições exigem conferência fiscal e não compõem o faturamento."],
      PENDENTES_SEM_DATA: ["Pendências sem data fiscal", "Contagem operacional do ambiente, sem atribuição ao mês selecionado; nenhuma data interna substitui a emissão."],
      SAIDAS_SEM_DATA: ["Saídas sem data de emissão", "A emissão oficial está ausente; faturamento e movimento diário não podem ser fechados para a competência."],
      SAIDAS_SEM_VALOR: ["Saídas sem total fiscal", "O XML autorizado não contém vNF válido. O total comercial do pedido não será usado como estimativa."],
      SAIDAS_SEM_COMPROVACAO: ["Autorização incompleta", "Confira XML, chave, protocolo, emitente e ambiente. O registro local não comprova todos os dados necessários à métrica."],
      CANCELADAS_SEM_DATA: ["Cancelamentos sem data oficial", "O registro atual não conserva a data fiscal do cancelamento. A contagem e o valor mensal permanecem indisponíveis."],
      CANCELADAS_SEM_COMPROVACAO: ["Canceladas com evidência incompleta", "O XML não comprova autorização original ou cancelamento da mesma chave, emitente e ambiente. O documento não recebe competência pela data de um XML contraditório."],
      ENTRADAS_INCOMPLETAS: ["Entradas com evidência incompleta", "Há notas recebidas sem ambiente, situação, data ou valor fiscal comprovado. A soma não pode ser fechada."],
      ENTRADAS_CANCELADAS: ["Entradas canceladas", "Notas recebidas canceladas ficam fora do total de entradas. Cancelamento do fornecedor não é recusa ou reversão interna."],
      ENTRADAS_CANCELAMENTO_PENDENTE: ["Cancelamentos recebidos a conferir", "O diário contém resumo de evento de cancelamento da mesma chave, sem confirmação completa da situação. A entrada não será somada como autorizada até a conferência fiscal."],
    };
    const pendencias: PendenciaDashboardFiscal[] = [...this.contadores].map(([codigo, quantidade]) => ({ codigo, titulo: descricoes[codigo][0], descricao: descricoes[codigo][1], quantidade, href: null }));
    if (this.motivoSaidas) pendencias.push({ codigo: "SAIDAS_INDISPONIVEIS", titulo: "Saídas indisponíveis", descricao: this.motivoSaidas, quantidade: null, href: null });
    if (this.motivoEntradas) pendencias.push({ codigo: "ENTRADAS_INDISPONIVEIS", titulo: "Entradas indisponíveis", descricao: this.motivoEntradas, quantidade: null, href: null });
    return {
      metricas: { faturamento, entradas, canceladas, ticketMedio },
      movimentoDiario: [...this.dias].sort(([a], [b]) => a.localeCompare(b)).map(([dia, movimento]) => ({ dia,
        saidas: this.motivoSaidas || this.saidas.datasAusentes || this.contadores.has("SAIDAS_SEM_COMPROVACAO") ? null : metrica(movimento.saidas).valor,
        entradas: this.motivoEntradas || this.entradas.datasAusentes || this.entradas.identidadesAusentes || this.contadores.has("ENTRADAS_INCOMPLETAS") ? null : metrica(movimento.entradas).valor })),
      receitaPorDocumento: [...this.modelos].map(([modelo, soma]) => ({ modelo,
        valor: faturamento.valor === null ? null : metrica(soma).valor, quantidade: soma.quantidade })),
      ultimosDocumentos: this.documentos, documentosPorTipo: { ...this.tipos }, pendencias,
    };
  }
}
