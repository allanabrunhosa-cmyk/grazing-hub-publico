export {default} from "./layout-navegacao";
export function usePathname(){return "/financeiro/movimentacoes";}
export function useRouter(){return {push(){}, refresh(){window.dispatchEvent(new Event("conciliacao-atualizada"));}};}
export function redirect(){}
