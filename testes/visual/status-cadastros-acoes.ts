export const estados: Record<string, boolean> = {};
let versao = 0;
const ouvintes = new Set<() => void>();
export const observarStatus = (ouvinte: () => void) => { ouvintes.add(ouvinte); return () => { ouvintes.delete(ouvinte); }; };
export const versaoStatus = () => versao;
async function salvar(id: string, ativo: boolean) {
  if (new URLSearchParams(location.search).has("erro")) return { erro: "Falha simulada. O status foi mantido." };
  estados[id] = ativo;
  versao++;
  ouvintes.forEach(ouvinte => ouvinte());
  return { ok: true as const };
}
export const alterarStatusFornecedorAction = salvar;
export const alterarStatusInsumoAction = salvar;
