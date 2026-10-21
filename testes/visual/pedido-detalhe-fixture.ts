import type { Capacidades, Dados } from "@/app/(protegido)/vendas/pedidos/editor-pedido";
import type { PedidoDetalhado } from "@/app/(protegido)/vendas/pedidos/detalhe-pedido";
export const capacidadesDetalhe: Capacidades = { rascunho: true, confirmar: true, revisar: true, desconto: true, preco: true, cancelar: true, receber: true, condicao: true };
export const dadosDetalhe: Dados = {
  catalogo: { tiposEmbalagem: [], categorias: [], categoriasGrupos: [], gruposFiscais: [], insumos: [], produtos: [], grupos: [] },
  clientes: [], canais: [], formas: [], categorias: [], categoriasTaxa: [], categoriasDevolucao: [], creditos: {}, contas: [{ id: "conta-sintetica", nome: "Conta de teste" }], horarios: null,
};
export function criarDetalheFixture(): PedidoDetalhado {
  return {
    id: "pedido-sintetico", numero: 101, versao: 2, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", origem: "HUB", createdAt: "2026-10-08T12:00:00Z", fusoHorario: "America/Sao_Paulo", modoFinanceiro: "HUB", versaoFinanceiro: 1,
    clienteId: "cliente-sintetico", canalId: "site-sintetico", canalNomeSnapshot: "SITE", compradorSnapshot: { nome: "Cliente Exemplo" }, destinatarioSnapshot: { nome: "Destinatária Exemplo", contato: "Contato de teste" },
    atendimento: "ENTREGA", prazo: "AGENDADO", previsaoData: "2026-10-09T00:00:00Z", previsaoJanela: "14:00–16:00", enderecoSnapshot: { cep: "00000000", logradouro: "Rua Exemplo", numero: "10", complemento: "Casa", bairro: "Centro", cidade: "São Paulo", uf: "SP" },
    observacoes: "Entregar na portaria. Manter a caixa na posição indicada.", subtotal: "285.00", desconto: "0.00", frete: "15.00", outrosCustos: "0.00", total: "300.00", formaPagamentoInformada: "PIX", pagamentoInformadoSnapshot: { formaId: "pix-sintetico", nome: "Pix", parcelas: 1, vencimentos: [] }, confirmadoEm: "2026-10-08T12:10:00Z", entregueEm: null, rascunho: null,
    itens: [{ id: "item-sintetico", produtoId: "produto-sintetico", quantidade: "1", unidadeSnapshot: "UN", precoOriginal: "285.00", precoAplicado: "285.00", acrescimos: "0.00", desconto: "0.00", totalLinha: "285.00", estadoComposicao: "VALIDO", produtoSnapshot: { nome: "Caixa Grazing média" }, escolhasSnapshot: [{ opcaoId: "opcao-sintetica", opcaoNome: "Queijo brie", quantidade: 1 }, { opcaoId: "opcao-sintetica-2", opcaoNome: "Geleia de frutas", quantidade: 1 }], observacoes: "Separar os complementos." }],
    financeiro: { recebido: "90.00", saldo: "210.00", saldoCliente: "210.00", elegivel: "0.00", elegivelCancelamento: "90.00", capturado: "0.00", creditoRestauravel: "0.00", titulos: [{ id: "titulo-sintetico", raiz: "parcela-1", valorOriginal: "210.00", valor: "210.00", status: "PENDENTE", vencimento: "2026-10-09T12:00:00Z", forma: { nome: "Pix", tipo: "PIX" }, dataPagamento: null }], tratamentos: [] },
    historico: [{ id: "hist-sintetico", tipo: "CONFIRMADO", usuarioNome: "Operador Exemplo", createdAt: "2026-10-08T12:10:00Z", motivo: null, versaoAnterior: 1, versaoNova: 2, antes: null, depois: { total: "300.00" } }],
    historicoFinanceiro: [{ id: "hist-fin-sintetico", tipo: "RECEBIMENTO", usuarioNome: "Operador Exemplo", createdAt: "2026-10-08T12:15:00Z", detalhes: { recebido: "90.00" } }],
  };
}
