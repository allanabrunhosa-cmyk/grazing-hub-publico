import type { ComponentProps } from "react";

export function usePathname() { return new URLSearchParams(location.search).get("rota") ?? "/fornecedores"; }
export function useSearchParams() { return new URLSearchParams(location.search); }
export function useRouter() { return { push() {}, refresh() {} }; }
export function unstable_isUnrecognizedActionError() { return false; }
export default function LinkSimulado({ href, ...props }: ComponentProps<"a">) {
  return <a href={href?.startsWith("/") ? `/layout.html?rota=${encodeURIComponent(href)}` : href} {...props} />;
}
