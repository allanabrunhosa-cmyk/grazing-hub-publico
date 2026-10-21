export { default, usePathname, useSearchParams, unstable_isUnrecognizedActionError } from "./layout-navegacao";
export function useRouter() { return { push() {}, refresh() {}, replace(rota: string) { Object.assign(window, { ultimoFiltroEntrada: rota }); } }; }
