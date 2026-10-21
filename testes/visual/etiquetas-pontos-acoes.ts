// A prévia não acessa banco, rede, credenciais ou impressoras.
const indisponivel = async () => ({ erro: "Prévia: nenhuma operação será executada." });
export const criarPontoImpressaoAction = indisponivel;
export const atualizarPontoImpressaoAction = indisponivel;
export const emitirCodigoPontoAction = indisponivel;
export const revogarPontoAction = indisponivel;
export const selecionarImpressoraPontoAction = indisponivel;
export const enfileirarPontoAction = indisponivel;
export const imprimirTestePontoAction = indisponivel;
export const solicitarMudancaWifiPontoAction = indisponivel;
export const confirmarSaidaFisicaPontoAction = indisponivel;
