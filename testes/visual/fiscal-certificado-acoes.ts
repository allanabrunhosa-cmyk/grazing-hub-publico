/** Simulação exclusiva da prévia. Não importa ações de servidor. */
export async function uploadCertificadoAction() { return { erro: "Simulação: nenhum certificado foi alterado." }; }
export async function removerCertificadoAction() { return { erro: "Simulação: nenhum certificado foi removido." }; }
export async function obterSenhaCertificadoAction() { return { erro: "Simulação: nenhuma senha real está disponível." }; }
