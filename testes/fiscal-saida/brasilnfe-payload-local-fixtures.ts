import { createHash } from "node:crypto";
import type { ParametrosPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local-tipos";

/** Exclusivamente sintético: códigos e parâmetros não representam o emitente contratado. */
export function massaPayloadLocal() {
  const endereco = { cep: "00000000", logradouro: "Rua de teste", numero: "1", bairro: "Bairro fictício", cidade: "São Paulo", uf: "SP", codMunicipio: "3550308", codPais: 1058, pais: "BRASIL" };
  const cadastro = { nome: "Empresa fictícia", cnpj: "00000000000000", enderecoEstruturado: endereco };
  const payload = {
    schema: "grazing.fiscal-saida", versao: 1, pedido: { id: "pedido-ficticio", revisao: 1 },
    emitente: { nome: cadastro.nome, cnpj: cadastro.cnpj }, comprador: { nome: "Pessoa fictícia", documento: "00000000000" },
    pagamento: { formaId: "forma-ficticia" }, parcelas: [{ formaPagamentoId: "forma-ficticia", valor: "24.53", dataVencimento: "2026-11-01T12:00:00.000Z" }],
    valores: { subtotal: "26.50", desconto: "2.00", frete: "0.02", outrosCustos: "0.01", total: "24.53" },
    itens: [{ id: "item-ficticio", produtoId: "produto-ficticio", produto: { nome: "Produto fictício" }, quantidade: "2", unidade: "UN", preco: "10.10", acrescimos: "3.15", desconto: "2.00", total: "24.50",
      fiscal: { versaoCadastro: 1, produto: { ncm: "00000000", origem: "0", cfop: "5102", csosn: "102", cstIcms: "", pis: "07", cofins: "07", ean: "SEM GTIN", unidadeTributavel: "UN", cest: "", ipi: "", fcp: "" } } }],
  };
  const documento = { id: "documento-ficticio", hashPayload: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), versaoPedido: 1, payload };
  const parametros: ParametrosPayloadLocalBrasilNfe = {
    vinculo: { documentoId: documento.id, hashPayload: documento.hashPayload, revisaoPedido: 1 }, referenciaConfirp: "DECISAO-SOMENTE-TESTE",
    emitente: { crt: 1, ie: "000000000000", codMunicipio: endereco.codMunicipio, codPais: 1058, pais: "BRASIL" },
    operacao: { NaturezaOperacao: "Venda fictícia", Finalidade: 1, IndicadorPresenca: 1, ConsumidorFinal: true, CalcularIBPT: false, ModalidadeFrete: 9, intermediadorAplicavel: false },
    destinatario: { identificar: true, origem: "comprador", IndicadorIe: 9, endereco },
    pagamentos: { fonte: "TOTAL", incluirCobranca: false, troco: "0", mapeamentos: [{ formaId: "forma-ficticia", FormaPagamento: "01", IndicadorPagamento: 0 }] },
    itens: [{ itemId: payload.itens[0].id, produtoId: payload.itens[0].produtoId, versaoCadastro: 1, referenciaConfirp: "DECISAO-ITEM-SOMENTE-TESTE", fatorTributavel: "1", cestAplicavel: false,
      icms: { tratamento: "SEM_DESTAQUE" }, pis: { tratamento: "SEM_DESTAQUE" }, cofins: { tratamento: "SEM_DESTAQUE" },
      ipiAplicavel: false, stAplicavel: false, fcpAplicavel: false, difalAplicavel: false, ibsCbsAplicavel: false, beneficioFiscalAplicavel: false }],
  };
  return { documento, cadastro, parametros };
}
