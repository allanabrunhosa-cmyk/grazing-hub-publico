let temporizador: ReturnType<typeof setTimeout> | null = null;

/** Chamado depois de gravar ingrediente, preparação ou composição de produto. Não bloqueia
 * nem falha a gravação: a conferência de revisão de NCM roda em seguida, agrupando
 * alterações próximas. O import tardio evita ciclo com os serviços de cadastro. */
export function agendarVerificacaoRevisaoNcm() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void import("./revisao-ncm-alerta").then(m => m.verificarEAlertarRevisoesNcm()).catch(() => { /* A próxima conferência repete a tentativa. */ });
  }, 5000);
  temporizador.unref?.();
}
