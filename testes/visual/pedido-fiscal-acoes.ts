/** Transporte simulado exclusivamente na prévia sintética de testes. */
export async function prepararEmissaoPedidoBrasilNfeAction(pedidoId: string, versaoPedido: number, modelo: 55 | 65, ambiente: "HOMOLOGACAO" | "PRODUCAO") {
  return { ok: true as const, previa: {
    pedidoId, numeroPedido: 101, versaoPedido, modelo, ambiente, ambientesDisponiveis: ["HOMOLOGACAO", "PRODUCAO"] as const, modeloSugerido: 65,
    emitente: { nome: "Empresa de exemplo", cnpj: "00000000000000", ie: "000000000000", crtDescricao: "1 — Simples Nacional" },
    numeracao: { versaoConfiguracao: 1, emitente: { cnpj: "00000000000000", nome: "Empresa de exemplo" }, consulta: { situacao: "NAO_CONSULTADA", consultadoEm: null, httpStatus: null, falha: null, avisosPresentes: false }, linhas: [], pendencias: [] },
    destinatario: { nome: "Cliente Exemplo", documento: "00000000000", endereco: "Rua Exemplo, 10 · São Paulo, SP" },
    itens: [{ id: "item-sintetico", produtoId: "produto-sintetico", nome: "Caixa Grazing média", quantidade: "1", unidade: "UN", total: "285.00" }],
    total: "300.00", valores: { subtotal: "285.00", desconto: "0.00", frete: "15.00", outrosCustos: "0.00" },
    pendencias: [{ campo: "item", mensagem: "Caixa Grazing média: aprove a classificação fiscal desta apresentação.", href: "/financeiro/fiscal/regras-brasilnfe" }, ...(modelo === 65 ? [{ campo: "csc", mensagem: "Conferir CSC e identificador de homologação no canal protegido.", href: "/configuracoes/integracoes/brasilnfe" }] : [])],
    podeEmitir: false, liberacaoTransmissao: { liberada: false, motivo: "Emissão ainda não liberada." }, documento: { id: "documento-sintetico", versaoPedido, provedor: "BRASIL_NFE", referenciaProvedor: null, modeloDocumento: null, status: "SEM_EMISSOR", ambiente, hashSnapshot: "a".repeat(64), hashPayloadFiscal: null, numero: null, serie: null, chaveFiscal: null, protocolo: null, ultimoErro: null, xmlDisponivel: false, formatoImpressao: null, tentativas: 0, eventos: [] },
  } };
}
export async function emitirNotaPedidoBrasilNfeAction() { return { erro: "A prévia de testes não transmite documentos." }; }
export async function consultarEmissaoPedidoBrasilNfeAction() { return { erro: "A prévia de testes não consulta serviços externos." }; }
export async function obterDocumentosEmissaoPedidoBrasilNfeAction() { return { erro: "A prévia de testes não obtém arquivos externos." }; }
export async function cancelarNotaPedidoBrasilNfeAction() { return { erro: "Cancelamento rejeitado: prazo legal encerrado. Código 501. Nenhuma operação externa foi realizada." }; }

export async function emitirNotaPedidoDiretaBrasilNfeAction(entrada: { modelo: 55 | 65; versaoPedido: number; indicadorPresenca?: number; pagamentoCartaoNaoIntegrado?: true }) {
  const estado = new URLSearchParams(location.search).get("fiscal");
  if (estado === "rede") throw new Error("Falha exclusivamente sintética de conexão.");
  if (estado === "erro" || estado === "presenca" && !entrada.indicadorPresenca || estado === "cartao" && !entrada.pagamentoCartaoNaoIntegrado) return {
    erro: "A nota não foi emitida. Corrija os pontos indicados.", documento: null, conferirAntesDeRepetir: false,
    exigeEscolhaPresenca: estado === "presenca", exigeEscolhaCartao: estado === "cartao",
    pendencias: [{ campo: estado === "presenca" ? "indicadorPresenca" : estado === "cartao" ? "pagamentoCartao" : "Produtos[0].NCM", mensagem: estado === "presenca" ? "Informe como a venda foi realizada. O canal não pode ser presumido." : estado === "cartao" ? "Pagamento com cartão: confirme se o pagamento foi processado fora do HUB." : "Caixa Grazing média: informe o NCM de oito dígitos na classificação fiscal do produto.", href: estado === "erro" ? "/financeiro/fiscal/cobertura" : null }],
  };
  return { ok: true as const, conferirAntesDeRepetir: true, documento: {
    id: "documento-exclusivamente-sintetico", versaoPedido: entrada.versaoPedido, modeloDocumento: entrada.modelo, status: "AUTORIZADO", ambiente: "PRODUCAO", provedor: "BRASIL_NFE", tentativas: 1, ultimoErro: null, referenciaProvedor: "referencia-exclusivamente-sintetica", chaveFiscal: "0".repeat(44), numero: "101", serie: "1", protocolo: "000000000000000", formatoImpressao: "PDF" as const, xmlDisponivel: true,
  } };
}
export async function consultarResultadoEmissaoPedidoBrasilNfeAction() { return { ok: true as const, documento: null, conferirAntesDeRepetir: false }; }
