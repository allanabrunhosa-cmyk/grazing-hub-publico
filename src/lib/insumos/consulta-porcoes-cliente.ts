import type { PorcaoInsumoOption } from "./porcoes";

type Resultado = { porcoes: PorcaoInsumoOption[]; podeCadastrar: boolean } | { erro: string };

/** Leitura por URL estável: não depende dos IDs de Server Actions de cada publicação. */
export async function consultarPorcoesNoCliente(insumoId: string): Promise<Resultado> {
  const resposta = await fetch(`/api/insumos/${encodeURIComponent(insumoId)}/porcoes`, {
    cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" },
  });
  if (resposta.redirected || resposta.status === 401) return { erro: "Sua sessão expirou. Entre novamente." };
  if (resposta.status === 403) return { erro: "Seu acesso não permite consultar porções." };
  if (!resposta.headers.get("content-type")?.includes("application/json")) throw new Error("Resposta de porções inválida.");
  const resultado = await resposta.json();
  if (typeof resultado?.erro === "string") return { erro: resultado.erro };
  if (!resposta.ok || !Array.isArray(resultado?.porcoes) || typeof resultado.podeCadastrar !== "boolean") throw new Error("Resposta de porções inválida.");
  return resultado;
}
