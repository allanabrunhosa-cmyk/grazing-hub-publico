const indisponivel = async () => ({ erro: "Prévia: nenhuma alteração será salva." });

export const excluirPontoImpressaoAction = indisponivel;

// Cenário local explícito. Nenhuma chamada ao servidor ou persistência.
export const baixarEtiquetaAction = async () => {
  if (new URLSearchParams(location.search).get("baixa") !== "sucesso") return indisponivel();
  await new Promise(resolve => setTimeout(resolve, 1200));
  return { ok: true as const };
};

export const configurarUsuarioResponsavelAction = indisponivel;

export const salvarResponsavelEtiquetaAction = indisponivel;

export const restaurarPontoImpressaoAction = indisponivel;
