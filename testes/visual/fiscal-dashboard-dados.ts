import type { DashboardFiscalDto } from "@/lib/fiscal-dashboard/tipos";

/** Somente dados sintéticos; esta prévia não importa banco nem serviços fiscais. */
export function criarDashboardFiscalFicticio(mes = "2026-10", ambiente: "PRODUCAO" | "HOMOLOGACAO" = "PRODUCAO", indisponivel = false): DashboardFiscalDto {
  const totalDias = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).getUTCDate();
  const fator = mes === "2026-10" ? ambiente === "HOMOLOGACAO" ? 0.025 : 1 : 0;
  const centavos = [0, 42000, 182000, 86000, 0, 125000, 364000, 692000, 420000, 176000, 248000, 0, 38000, 92000, 218000, 386000, 0, 138000, 295000, 148000, 0, 82000, 458000, 623000, 275000, 95000, 0, 47000, 189000, 326000, 172000];
  const dinheiro = (v: number) => (v / 100).toFixed(2);
  const movimentoDiario = Array.from({ length: totalDias }, (_, i) => ({ dia: `${mes}-${String(i + 1).padStart(2, "0")}`, saidas: indisponivel ? null : dinheiro(Math.round(centavos[i] * fator)), entradas: indisponivel ? null : dinheiro(Math.round((i % 4 === 2 ? centavos[i] * 0.42 : i % 7 === 1 ? 150000 : 0) * fator)) }));
  const valorSaidas = movimentoDiario.reduce((soma, d) => soma + Math.round(Number(d.saidas ?? 0) * 100), 0);
  const valorEntradas = movimentoDiario.reduce((soma, d) => soma + Math.round(Number(d.entradas ?? 0) * 100), 0);
  const quantidade = movimentoDiario.filter(d => Number(d.saidas) > 0).length;
  const qtdEntradas = movimentoDiario.filter(d => Number(d.entradas) > 0).length;
  const valor55 = movimentoDiario.filter((_, i) => i % 2 === 0).reduce((soma, d) => soma + Math.round(Number(d.saidas ?? 0) * 100), 0);
  const motivo = indisponivel ? "Dados fiscais oficiais indisponíveis" : null;
  const metrica = (v: number, q: number) => ({ valor: indisponivel ? null : dinheiro(v), quantidade: indisponivel ? null : q, motivo });
  const dados: DashboardFiscalDto = {
    filtros: { mes, ambiente }, emitente: { nome: "Emitente fictício · Grazing HUB", cnpj: null },
    regimeFiscal: { dia: "2026-10-14", regime: "Simples Nacional", crt: 1, descricaoCrt: "Simples Nacional", ie: "000000000000", vigenteDesde: "2026-10-14", vigenteAte: null, modelos: { 55: "perfil-sintetico", 65: "perfil-sintetico" }, pendencias: [], verificacoes: [] },
    metricas: { faturamento: metrica(valorSaidas, quantidade), entradas: metrica(valorEntradas, qtdEntradas), canceladas: metrica(fator ? Math.round(96000 * fator) : 0, fator ? 2 : 0), ticketMedio: indisponivel ? metrica(0, 0) : quantidade ? metrica(Math.round(valorSaidas / quantidade), quantidade) : { valor: null, quantidade: 0, motivo: "Sem documentos autorizados para calcular a média" } },
    movimentoDiario,
    receitaPorDocumento: [{ modelo: 55, valor: indisponivel ? null : dinheiro(valor55), quantidade: movimentoDiario.filter((d, i) => i % 2 === 0 && Number(d.saidas) > 0).length }, { modelo: 65, valor: indisponivel ? null : dinheiro(valorSaidas - valor55), quantidade: movimentoDiario.filter((d, i) => i % 2 === 1 && Number(d.saidas) > 0).length }],
    ultimosDocumentos: indisponivel || !fator ? [] : movimentoDiario.filter(d => Number(d.saidas) > 0).slice(-4).reverse().map((d, i) => ({ id: `ficticio-${i}`, origem: i === 2 ? "ENTRADA" : "SAIDA", modelo: i % 2 === 0 ? 55 : 65, numero: String(1042 - i), status: i === 2 ? "RECEBIDA" : "AUTORIZADO", dataFiscal: `${d.dia}T12:00:00-03:00`, valor: i === 2 ? "1280.00" : d.saidas, pedidoId: null, pedidoNumero: i === 2 ? null : String(284 - i) })),
    pendencias: fator ? [{ codigo: "conferencia", titulo: "Documentos em conferência", descricao: "Retorno fiscal pendente de confirmação. Nenhum valor estimado compõe o faturamento.", quantidade: 3, href: null }, { codigo: "vinculos", titulo: "Vínculos fiscais incompletos", descricao: "Revise o grupo fiscal dos produtos antes de preparar novos documentos.", quantidade: 2, href: "/financeiro/fiscal/vinculos" }] : [],
    integracao: { ambienteConfigurado: "HOMOLOGACAO", configurada: true, credenciaisConfiguradas: true, situacao: "NAO_VERIFICADA", verificadaEm: null, servicos: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null }, certificado: { situacao: "A_VENCER", validoAte: "2026-11-07T12:00:00.000Z", diasParaVencer: 26 }, emissaoHabilitada: false },
    links: { grupos: "/financeiro/fiscal/grupos", vinculos: "/financeiro/fiscal/vinculos", notasRecebidas: "/notas-fiscais", configuracao: "/configuracoes/integracoes/brasilnfe" },
    avisos: ["Saídas: total oficial autorizado e data fiscal de emissão, sem estimar pelo pedido.", "Entradas: documentos recebidos locais por data de emissão, sem duplicar resumos e XMLs.", ...(indisponivel ? ["Há documentos sem valor ou data fiscal oficial. Os indicadores afetados permanecem indisponíveis."] : [])],
  };
  if (!indisponivel && fator) dados.ultimosDocumentos.push(
    { id: "nfs-sintetica", origem: "ENTRADA", tipo: "NFS_ENTRADA", modelo: null, numero: "908", status: "RECEBIDA", dataFiscal: `${mes}-30`, valor: "350.00", pedidoId: null, pedidoNumero: null },
    { id: "nfc-entrada-sintetica", origem: "ENTRADA", tipo: "NFC_ENTRADA", modelo: 65, numero: "220", status: "AUTORIZADO", dataFiscal: `${mes}-28`, valor: "120.00", pedidoId: null, pedidoNumero: null },
    { id: "cancelada-sintetica", origem: "SAIDA", tipo: "NF_SAIDA", modelo: 55, numero: "1001", status: "CANCELADO", dataFiscal: `${mes}-27`, valor: "960.00", pedidoId: null, pedidoNumero: null },
  );
  dados.ultimosDocumentos.sort((a,b) => (b.dataFiscal ?? "").localeCompare(a.dataFiscal ?? ""));
  if (ambiente === "HOMOLOGACAO") {
    dados.metricas.entradas = { valor: null, quantidade: null, motivo: "Entradas de homologação indisponíveis na distribuição SEFAZ existente" };
    dados.movimentoDiario = dados.movimentoDiario.map(dia => ({ ...dia, entradas: null }));
    dados.ultimosDocumentos = dados.ultimosDocumentos.filter(doc => doc.origem !== "ENTRADA");
  }
  return dados;
}
