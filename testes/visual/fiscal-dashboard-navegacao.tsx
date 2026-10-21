import type { ComponentProps } from "react";
export function usePathname() { return new URLSearchParams(location.search).get("rota") ?? (location.pathname.endsWith("fiscal-numeracao.html") ? "/financeiro/fiscal/configuracoes" : "/financeiro/fiscal"); }
export function useSearchParams() { return new URLSearchParams(location.search); }
function destino(url: string) {
  if (!url.startsWith("/")) return url;
  const alvo = new URL(url, location.origin);
  alvo.searchParams.set("rota", alvo.pathname);
  alvo.pathname = "/fiscal-dashboard.html";
  if (new URLSearchParams(location.search).has("escuro")) alvo.searchParams.set("escuro", "");
  const estado = new URLSearchParams(location.search).get("estado");
  if (estado) alvo.searchParams.set("estado", estado);
  return `${alvo.pathname}${alvo.search}`;
}
export function useRouter() { return { push(url: string) { location.assign(destino(url)); }, refresh() { location.reload(); } }; }
export function unstable_isUnrecognizedActionError() { return false; }
export default function LinkSimulado({ href, ...props }: ComponentProps<"a">) { return <a href={href ? destino(href) : undefined} {...props} />; }
// A prévia fiscal não abre pedidos nem carrega suas ações de servidor.
export { LinkSimulado as LinkPedidoProtegido };
