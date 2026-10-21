// A prévia de auditoria nunca grava rascunhos nem publica versões.
const indisponivel = async () => ({ erro: "Persistência indisponível nesta prévia sintética. Use o ambiente de integração isolado." });
export const salvarRascunhoDesignAction = indisponivel;
export const publicarRascunhoDesignAction = indisponivel;
export const restaurarVersaoDesignAction = indisponivel;
