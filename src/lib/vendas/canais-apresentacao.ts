export type CanalConhecido = "site" | "ifood" | "gf";
/** Mesmos aliases exatos usados pelo selo oficial; não une identidades de cadastro. */
const ALIASES: Readonly<Record<string, CanalConhecido>> = {
  site: "site", ifood: "ifood", "i food": "ifood", "i-food": "ifood",
  gf: "gf", "g f": "gf", "g.f.": "gf", "giuliana flores": "gf", giulianaflores: "gf",
};
const NOMES: Record<CanalConhecido, string> = { site: "Site", ifood: "iFood", gf: "GF" };
export function apresentacaoCanalVenda(canal: string | null | undefined) {
  const nomeOriginal = canal?.trim() || "Sem canal";
  const normalizado = nomeOriginal.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  const conhecido = Object.hasOwn(ALIASES, normalizado) ? ALIASES[normalizado] : undefined;
  return { nomeOriginal, conhecido, nome: conhecido ? NOMES[conhecido] : nomeOriginal };
}
