import { rotaGestor, type GestorFiltros } from "./gestor-dominio";

const gestor = "/vendas/pedidos";
const origem = "https://pedidos.grazinghub.com.br";

/** O retorno pertence somente ao gestor; filtros desconhecidos e origens externas são descartados. */
export function retornoGestorSeguro(valor: unknown): string {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//")) return gestor;
  try {
    const url = new URL(valor, origem);
    if (url.origin !== origem) return gestor;
    if (url.pathname === `${gestor}/cancelados`) { const pagina = Number(url.searchParams.get("pagina")); return `${gestor}/cancelados${Number.isSafeInteger(pagina) && pagina > 1 && pagina <= 10000 ? `?pagina=${pagina}` : ""}`; }
    if (url.pathname !== gestor) return gestor;
    return rotaGestor(Object.fromEntries(url.searchParams) as GestorFiltros);
  } catch { return gestor; }
}

export function filtrosDoRetornoGestor(valor: unknown): GestorFiltros {
  return Object.fromEntries(new URL(retornoGestorSeguro(valor), origem).searchParams) as GestorFiltros;
}

export function rotaPopupPedido(caminho: string, retorno?: string): string {
  const url = new URL(caminho, origem);
  if (url.origin !== origem || !url.pathname.startsWith(`${gestor}/`)) return retornoGestorSeguro(retorno);
  url.searchParams.set("retorno", retornoGestorSeguro(retorno));
  return `${url.pathname}${url.search}`;
}
