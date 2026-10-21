import { useMemo, useSyncExternalStore } from "react";
export { default, unstable_isUnrecognizedActionError, redirect, notFound } from "./navegacao-simulada";
let caminhoAtual = "/vendas/pedidos";
let buscaAtual = typeof location === "undefined" ? "" : location.search;
export function atualizarNavegacaoGestor(caminho: string) {
  const url = new URL(caminho, location.origin);
  caminhoAtual = url.pathname; buscaAtual = url.search;
  window.dispatchEvent(new CustomEvent("gestor-consulta-simulada", { detail: `${caminhoAtual}${buscaAtual}` }));
}
function assinar(alterar: () => void) { window.addEventListener("gestor-consulta-simulada", alterar); return () => window.removeEventListener("gestor-consulta-simulada", alterar); }
const router = { push: atualizarNavegacaoGestor, replace: atualizarNavegacaoGestor, refresh() { atualizarNavegacaoGestor(`${caminhoAtual}${buscaAtual}`); } };
export function useRouter() { return router; }
export function usePathname() { return useSyncExternalStore(assinar, () => caminhoAtual, () => "/vendas/pedidos"); }
export function useSearchParams() { const busca = useSyncExternalStore(assinar, () => buscaAtual, () => ""); return useMemo(() => new URLSearchParams(busca), [busca]); }
