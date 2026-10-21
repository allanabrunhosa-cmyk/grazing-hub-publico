import type { ComponentProps } from "react";
export { usePathname, useSearchParams, useRouter, unstable_isUnrecognizedActionError } from "./layout-navegacao";
export default function LinkSimulado({ href, ...props }: ComponentProps<"a">) {
  return <a href={href?.startsWith("/") ? `/responsividade.html?rota=${encodeURIComponent(href)}` : href} {...props} />;
}
