import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
let versao = 1;
const retorno = (status: string) => ({ ok: true as const, id: "pedido-ficticio", numero: 101, versao: ++versao, status });
export async function criarRascunhoPedidoAction() { return retorno("RASCUNHO"); }
export async function salvarRascunhoPedidoAction() { return retorno("RASCUNHO"); }
export async function confirmarPedidoVendaAction() { return retorno("CONFIRMADO"); }
export async function consultarCreditoClientePedidoAction() { return { ok: true as const, limite: "50000.00", emAberto: "1200.00", disponivel: "48800.00" }; }
export async function revisarPedidoVendaAction() { return retorno("CONFIRMADO"); }
export async function editarInformacoesPedidoAction() { return retorno("CONFIRMADO"); }
export async function cancelarPedidoVendaAction() { return retorno("CANCELADO"); }
export async function registrarEntregaPedidoVendaAction() { return retorno("CONFIRMADO"); }
export async function registrarRecebimentoPedidoAction() { return retorno("CONFIRMADO"); }
export async function ajustarVencimentoPedidoAction() { return retorno("CONFIRMADO"); }
export async function registrarCapturaCartaoPedidoAction() { return retorno("CONFIRMADO"); }
export async function registrarEmissaoBoletoPedidoAction() { return retorno("CONFIRMADO"); }
export async function confirmarPagamentoBoletoPedidoAction() { return retorno("CONFIRMADO"); }
export async function registrarRepasseCartaoPedidoAction() { return retorno("CONFIRMADO"); }
export async function solicitarDevolucaoPedidoAction() { return retorno("CONFIRMADO"); }
export async function mudarEstadoDevolucaoPedidoAction() { return retorno("CONFIRMADO"); }
export async function concluirDevolucaoPedidoAction() { return retorno("CONFIRMADO"); }
export async function concederCreditoPedidoAction() { return retorno("CONFIRMADO"); }
export async function liberarCreditoAplicadoPedidoAction() { return retorno("CONFIRMADO"); }
export async function encerrarPedidoManualAction() { return retorno("DECLINADO"); }
export async function registrarCancelamentoBoletoPedidoAction() { return { erro: "Operação financeira não habilitada na prévia." }; }
export async function registrarEntradaTardiaBoletoPedidoAction() { return { erro: "Operação financeira não habilitada na prévia." }; }
export async function corrigirRecebimentoPedidoAction() { return { erro: "Operação financeira não habilitada na prévia." }; }
export async function buscarCepPedidoAction(cep: string) { return { endereco: { cep, logradouro: "Rua Fictícia", bairro: "Centro Fictício", cidade: "São Paulo", uf: "SP" } }; }
export async function criarClienteDoPedidoAction() { return { erro: "Cadastro simulado na prévia." }; }

export async function calcularFretePedidoAction(dados: PedidoEntrada, _origem?: string, destino?: string) {
  const moto = dados.veiculoEntregaId === "moto-ficticia";
  if (new URLSearchParams(location.search).has("confirmar-endereco") && !destino) return { resultado: {
    memoria: { estado: "ENDERECO_PENDENTE", motivo: "Endereço pendente de validação", frete: null },
    rota: null, recibo: "recibo-pendente-ficticio", calculadoEm: new Date().toISOString(), validoAte: new Date(Date.now() + 600000).toISOString(), versao: 1,
    origemInformada: "Origem fictícia", veiculo: "CARRO", pendencia: { lado: "destino", candidatos: [{ descricao: "Rua Exemplo, 1 — imóvel fictício", precisao: "RANGE_INTERPOLATED", confirmacao: "destino-ficticio" }] },
  } };
  return { resultado: {
    memoria: { estado: "PERMITIDO", motivo: "Atendimento permitido — cálculo fictício", faixaId: "faixa-ficticia", faixaDescricao: "Faixa fictícia", excecaoId: null, subtotalProdutos: "220.00", precoFaixa: "22.00", fixo: "0.00", acrescimo: "0.00", piso: null, pedidoMinimo: null, antesGratuidade: "22.00", descontoFrete: "0.00", frete: "22.00" },
    rota: null, recibo: "recibo-ficticio-sem-validade-no-servidor", calculadoEm: new Date().toISOString(), validoAte: new Date(Date.now() + 600000).toISOString(), versao: 1,
    origemInformada: "Origem fictícia", veiculo: moto ? "MOTO" : "CARRO",
    selecaoVeiculo: { id: moto ? "moto-ficticia" : "carro-ficticio", nome: moto ? "Moto fictícia" : "Carro fictício", perfil: moto ? "MOTO" : "CARRO", regraId: moto ? null : "regra-caixa-ficticia", escolha: dados.veiculoEntregaId ? "OPERADOR" : "REGRA", embalagens: ["caixa-media-ficticia"] },
  } };
}
export async function salvarCustoEntregaAction() { return { erro: "Persistência não habilitada na prévia." }; }

export async function salvarTipoEmbalagemAction() { return { erro: "Cadastro de embalagem simulado na prévia." }; }
export async function retomarDevolucaoPedidoAction() { return { erro: "Simulação de recuperação, sem movimentar dinheiro." }; }
export async function concluirDevolucaoContextualAction() { return { erro: "Simulação, sem movimentar dinheiro." }; }
export async function executarOperacaoPedidoAction() { return retorno("CONFIRMADO"); }

export { buscarCnpjPedidoAction } from "./clientes-acoes";
