import type { ComponentProps } from "react";
export { usePathname, useRouter, unstable_isUnrecognizedActionError } from "./layout-navegacao";
export function redirect(destino: string): never { throw new Error(`Redirecionamento simulado: ${destino}`); }
export function useSearchParams() { return new URLSearchParams(location.search); }
export default function LinkSimulado({ href, ...props }: ComponentProps<"a">) {
  const destino = href?.startsWith("/?") ? `/etiquetas.html${href.slice(1)}` : href === "/" ? "/etiquetas.html" : href;
  return <a href={destino} {...props} />;
}
