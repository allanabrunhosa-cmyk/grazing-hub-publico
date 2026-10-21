import { dadosResumoPedido } from "@/lib/vendas/resumo-pedido";

export const pedidoResumoSintetico = {
  id: "pedido-sintetico", numero: 1284, versao: 2, status: "CONFIRMADO", createdAt: "2026-10-09T17:24:00Z", fusoHorario: "America/Sao_Paulo", atendimento: "ENTREGA", previsaoData: "2026-10-15T00:00:00Z", previsaoJanela: "17:00 - 18:00", referenciaPedido: "Evento de apresentação",
  compradorSnapshot: { nome: "Empresa de exemplo", tipo: "PJ", razaoSocial: "Empresa de exemplo Ltda.", documento: "00.000.000/0000-00", contato: "Contato de exemplo", telefone: "+551100000000", email: "contato@example.test" },
  destinatarioSnapshot: { nome: "Equipe do evento" }, enderecoSnapshot: { logradouro: "Rua de exemplo", numero: "100", complemento: "Salão do evento", bairro: "Bairro de exemplo", cidade: "Cidade de exemplo", uf: "SP", cep: "00000-000" }, cobrancaSnapshot: { logradouro: "Avenida de exemplo", numero: "200", cidade: "Cidade de exemplo", uf: "SP", cep: "00000-000" },
  pagamentoInformadoSnapshot: { nome: "Pix", tipo: "PIX", parcelas: 1, vencimentos: [] }, subtotal: "560.00", desconto: "20.00", frete: "35.00", outrosCustos: "0.00", total: "575.00", observacoes: "Montagem para o encontro.\nEntregar na recepção.",
  itens: [
    { produtoSnapshot: { nome: "Grazing Box" }, quantidade: "2", unidadeSnapshot: "UN", precoAplicado: "180.00", precoUnitarioResumo: "200.00", totalLinha: "385.71", totalResumo: "400.00", escolhasSnapshot: [{ quantidade: 1, opcaoNome: "Seleção especial de queijos" }], observacoes: "Sem castanhas" },
    { produtoSnapshot: { nome: "Seleção de frutas da estação" }, quantidade: "1", unidadeSnapshot: "UN", precoAplicado: "160.00", totalLinha: "154.29", totalResumo: "160.00", escolhasSnapshot: [], observacoes: "" },
  ],
};
export const dadosResumoSintetico = dadosResumoPedido(pedidoResumoSintetico);
