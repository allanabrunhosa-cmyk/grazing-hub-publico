import type { ComponentProps } from "react";
export function useRouter() { return { push() {}, refresh() {} }; }
export function usePathname() { return "/financeiro/movimentacoes"; }
export function useSearchParams() { return new URLSearchParams(location.search); }
export function unstable_isUnrecognizedActionError() { return false; }
export function redirect() {}
export function notFound() {}
export default function LinkSimulado(props: ComponentProps<"a">) { return <a {...props} />; }
