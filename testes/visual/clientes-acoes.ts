export const ajustarCreditoClienteAction = async () => ({ erro: "Ajuste desabilitado na prévia visual." });
export const consultarHistoricoPedidosClienteAction = async () => ({ pedidos: [
  { id: "pedido-ficticio-42", numero: 42, status: "CONFIRMADO", dataPedido: "2026-10-01T13:00:00Z", baseDataPedido: "CONFIRMACAO", previsaoData: "2026-10-02", previsaoJanela: "10:00–12:00", entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "320.50" },
  { id: "pedido-ficticio-41", numero: 41, status: "CONFIRMADO", dataPedido: "2026-09-24T15:00:00Z", baseDataPedido: "CONFIRMACAO", previsaoData: "2026-09-25", previsaoJanela: "14:00–16:00", entregueEm: "2026-09-25T18:30:00Z", fusoHorario: "America/Sao_Paulo", total: "280.00" },
  { id: "pedido-historico-ficticio", numero: 20001, status: "HISTORICO", dataPedido: "2026-09-01T02:59:00Z", baseDataPedido: "CRIACAO_HISTORICA", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "180.10" },
  { id: "pedido-revertido-ficticio", numero: 20000, status: "HISTORICO_REVERTIDO", dataPedido: "2026-08-31T20:00:00Z", baseDataPedido: "CRIACAO_HISTORICA", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "50.00" },
], total: 4, pagina: 1, tamanhoPagina: 25 });
export const buscarCepClienteAction = async () => {
  const estado = new URLSearchParams(location.search).get("cep");
  if (estado === "pendente") await new Promise(resolve => setTimeout(resolve, 4000));
  if (estado === "erro") return { erro: "Consulta de CEP indisponível na simulação." };
  return { endereco: { logradouro: "Rua fictícia", bairro: "Bairro fictício", cidade: "Cidade fictícia", uf: "SP" } };
};
export const buscarCepPedidoAction = buscarCepClienteAction;

export const buscarCnpjClienteAction = async () => ({ cadastro: { razaoSocial: "Empresa sintética Ltda", endereco: { pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", numero: "42", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } } });
export const buscarCnpjPedidoAction = buscarCnpjClienteAction;

export async function consultarIdentidadeClienteCadastro() { return { email: false, documento: false }; }
export const consultarIdentidadeClientePedido = consultarIdentidadeClienteCadastro;
