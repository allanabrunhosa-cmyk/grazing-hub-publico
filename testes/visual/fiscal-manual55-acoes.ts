import type { PreviaEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";

/** Respostas exclusivamente sintéticas para inspeção visual. Sem API ou banco. */
export async function prepararEmissaoPedidoBrasilNfeAction(pedidoId: string, versaoPedido: number, modelo: 55 | 65, _ambiente: "HOMOLOGACAO" | "PRODUCAO", contexto?: { indicadorPresenca?: 1 | 2 | 3 | 4 | 5 | 9 }) {
  const estado = new URLSearchParams(location.search).get("estado"), ambiente = estado === "homologacao" ? "HOMOLOGACAO" : "PRODUCAO";
  const suspensa = estado === "suspensa", bloqueada = modelo === 65 || estado === "impedida";
  const previa: PreviaEmissaoPedidoBrasilNfe = {
    pedidoId, versaoPedido, numeroPedido: 101, modelo, ambiente, modeloSugerido: 55, ambientesDisponiveis: ["HOMOLOGACAO", "PRODUCAO"],
    emitente: { nome: "Empresa exclusivamente fictícia para validação visual", cnpj: "00000000000000", ie: "000000000000", crtDescricao: "1 · Simples Nacional" },
    destinatario: { nome: "Comprador exclusivamente fictício", documento: "00000000000", endereco: "Rua sintética, 10 · São Paulo, SP" },
    itens: [{ id: "item-ficticio", produtoId: "produto-ficticio", nome: "Tábua de exemplo exclusivamente sintética", quantidade: "1", unidade: "UN", total: "139.00", fiscal: { ncm: "21069090", cfop: "5101", origem: "5", icms: "102", pis: "49", cofins: "49" } }],
    total: "165.00", valores: { subtotal: "139.00", desconto: "0.00", frete: "26.00", outrosCustos: "0.00" },
    numeracao: { versaoConfiguracao: 1, emitente: { nome: "Empresa fictícia", cnpj: "00000000000000" }, consulta: { situacao: "CONCLUIDA", consultadoEm: "2026-10-15T12:00:00.000Z", httpStatus: 200, falha: null, avisosPresentes: false }, linhas: [{ modelo, ambiente: ambiente === "PRODUCAO" ? 1 : 2, serie: modelo === 55 ? "6" : "7", proximoNumero: "1", padrao: true, ultimaAutorizadaLocal: null, divergencia: null }], pendencias: [] },
    contextoOperacao: { indicadorPresenca: contexto?.indicadorPresenca ?? (estado === "presenca" ? null : 2), exigeEscolhaPresenca: estado === "presenca" },
    revisaoConsolidada: { hash: "c".repeat(64), pendente: true, podeAprovar: !bloqueada, versoes: [{ id: "classificacao-ficticia", hash: "d".repeat(64), tipo: "CLASSIFICACAO", rotulo: "Produto fictício · versão 4", status: "PROPOSTA" }, { id: "regra-ficticia", hash: "e".repeat(64), tipo: "REGRA", rotulo: "Operação fictícia · versão 2", status: "PROPOSTA" }], parametros: [{ campo: "ncm", rotulo: "NCM", valor: "21069090" }, { campo: "cfop", rotulo: "CFOP", valor: "5101" }, { campo: "origem", rotulo: "Origem ICMS", valor: "5 · Declarada pelo responsável" }, { campo: "fci", rotulo: "FCI", valor: "Dispensa declarada, restrita à operação apresentada" }], declaracoes: ["Declarado pelo responsável, sem apuração CI/FCI comprovada.", "A declaração não se estende à NFC-e 65 nem a outros produtos ou destinos."] },
    controleManual: { suspensa, motivo: suspensa ? "Novos envios suspensos pela administração." : null },
    podeEmitir: !bloqueada && !suspensa, liberacaoTransmissao: { liberada: !bloqueada, motivo: modelo === 65 ? "NFC-e requer homologação própria comprovada." : bloqueada ? "Parâmetros ainda precisam de conferência." : null },
    pendencias: bloqueada ? [{ campo: "homologacao", mensagem: modelo === 65 ? "A NFC-e 65 ainda não possui homologação própria." : "Conferir a regra da operação sintética.", href: "/financeiro/fiscal/cobertura?aba=regras" }] : [],
    documento: { id: "documento-exclusivamente-sintetico", versaoPedido, provedor: "BRASIL_NFE", referenciaProvedor: null, modeloDocumento: null, status: "PREPARADO", ambiente, hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), numero: null, serie: null, chaveFiscal: null, protocolo: null, ultimoErro: null, xmlDisponivel: false, formatoImpressao: null, tentativas: 0, eventos: [] },
  };
  return { ok: true as const, previa };
}
export async function emitirNotaPedidoBrasilNfeAction() { return { erro: "Prévia sintética: nenhuma transmissão foi realizada." }; }
export async function consultarEmissaoPedidoBrasilNfeAction() { return { erro: "Prévia sintética: nenhuma consulta externa foi realizada." }; }
export async function obterDocumentosEmissaoPedidoBrasilNfeAction() { return { erro: "Prévia sintética: nenhum documento externo foi obtido." }; }
export async function cancelarNotaPedidoBrasilNfeAction() { return { erro: "Prévia sintética: nenhum cancelamento externo foi realizado." }; }

// O consumidor atual emite diretamente; esta fixture conserva apenas dados fictícios.
export { emitirNotaPedidoDiretaBrasilNfeAction, consultarResultadoEmissaoPedidoBrasilNfeAction } from "./pedido-fiscal-acoes";
