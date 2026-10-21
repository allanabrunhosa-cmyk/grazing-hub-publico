import type { ComponentProps } from "react";
export function usePathname() { return "/vendas/bi"; }
export function useSearchParams() { return new URLSearchParams(location.search); }
export function useRouter() { return { push(url: string) { history.pushState(null, "", url); }, replace(url: string) { history.replaceState(null, "", url); }, refresh() {} }; }
export function unstable_isUnrecognizedActionError() { return false; }
export default function LinkSimulado({ href, onClick, ...props }: ComponentProps<"a">) { return <a href={href} onClick={e => { e.preventDefault(); onClick?.(e); }} {...props} />; }
export { LinkSimulado as LinkPedidoProtegido };
