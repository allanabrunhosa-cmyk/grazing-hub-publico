export const LIMITE_MARCAS = 30;
export const LIMITE_NOME_MARCA = 120;

export function normalizarMarca(marca: string): string {
  return marca.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function validarMarcas(valor: unknown): { erro: string } | { marcas: string[] } {
  if (!Array.isArray(valor) || valor.length > LIMITE_MARCAS) return { erro: `Cadastre até ${LIMITE_MARCAS} marcas homologadas por insumo.` };
  const marcas: string[] = [];
  const nomes = new Set<string>();
  for (const item of valor) {
    if (typeof item !== "string") return { erro: "Lista de marcas homologadas inválida." };
    const marca = normalizarMarca(item);
    if (!marca || marca.length > LIMITE_NOME_MARCA) return { erro: `Cada marca deve ter de 1 a ${LIMITE_NOME_MARCA} caracteres.` };
    const chave = marca.toLocaleLowerCase("pt-BR");
    if (!nomes.has(chave)) {
      marcas.push(marca);
      nomes.add(chave);
    }
  }
  return { marcas };
}

export function marcasDoInsumo(insumo?: { marca?: string | null; marcasHomologadas?: string[] }): string[] {
  if (insumo?.marcasHomologadas?.length === 0) return [];
  const marcas = [...new Map((insumo?.marcasHomologadas ?? []).map(normalizarMarca).filter(Boolean).map(m => [m.toLocaleLowerCase("pt-BR"), m])).values()];
  const legada = normalizarMarca(insumo?.marca ?? "");
  const principal = marcas.find(m => m.toLocaleLowerCase("pt-BR") === legada.toLocaleLowerCase("pt-BR"))
    ?? marcas[0] ?? legada;
  return principal ? [principal, ...marcas.filter(m => m.toLocaleLowerCase("pt-BR") !== principal.toLocaleLowerCase("pt-BR")).sort((a,b) => a.localeCompare(b,"pt-BR"))] : [];
}

export function lerMarcasJson(texto: string): ReturnType<typeof validarMarcas> {
  try { return validarMarcas(JSON.parse(texto)); }
  catch { return { erro: "Lista de marcas homologadas inválida." }; }
}
