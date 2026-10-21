// Somente a suíte visual isolada; nunca importado pela aplicação.
export { usePathname, useSearchParams, useRouter, unstable_isUnrecognizedActionError } from "./layout-navegacao";
export function redirect(): never { throw new Error("Prévia visual: navegação de servidor indisponível."); }
export function notFound(): never { throw new Error("Prévia visual: rota de servidor indisponível."); }
