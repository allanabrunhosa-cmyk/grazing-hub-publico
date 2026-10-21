// Prévia visual. Todas as operações são bloqueadas e nenhum dispositivo é acessado.
const bloqueado = async () => ({ erro: "Prévia sem gravação ou impressão." });
export const criarPontoImpressaoAction = bloqueado;
export const atualizarPontoImpressaoAction = bloqueado;
export const emitirCodigoPontoAction = bloqueado;
export const revogarPontoAction = bloqueado;
export const selecionarImpressoraPontoAction = bloqueado;
export const enfileirarPontoAction = bloqueado;
export const imprimirTestePontoAction = bloqueado;
export const solicitarMudancaWifiPontoAction = bloqueado;
export const confirmarSaidaFisicaPontoAction = bloqueado;
