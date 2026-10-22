import type { ComponentProps } from "react";
export function usePathname() { return new URLSearchParams(location.search).get("rota") ?? "/financeiro/fiscal/vinculos"; }
export function useSearchParams() { return new URLSearchParams(location.search); }
export function destinoFiscal(url: string) {
  if (!url.startsWith("/")) return url;
  const p = new URLSearchParams({ rota: url.split("?")[0].split("#")[0] });
  if (new URLSearchParams(location.search).has("escuro")) p.set("escuro", "");
  return `/fiscal-unificado.html?${p}`;
}
export function useRouter() { return { push(url: string) { location.assign(destinoFiscal(url)); }, refresh() {} }; }
export function unstable_isUnrecognizedActionError() { return false; }
export default function Link({ href, ...props }: ComponentProps<"a">) { return <a href={href ? destinoFiscal(href) : undefined} {...props} />; }
