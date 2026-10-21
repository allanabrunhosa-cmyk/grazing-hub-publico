import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { atualizarNavegacaoGestor } from "./gestor-navegacao";

type Props = ComponentPropsWithoutRef<"a"> & { prefetch?: boolean; replace?: boolean; scroll?: boolean };
/** Somente navegação interna na prévia; respeita cancelamento do consumidor e links externos. */
const LinkGestor = forwardRef<HTMLAnchorElement, Props>(function LinkGestor(props, ref) {
  const { href, onClick, ...atributos } = props;
  delete atributos.prefetch; delete atributos.replace; delete atributos.scroll;
  return <a {...atributos} ref={ref} href={href} onClick={evento => {
    onClick?.(evento);
    if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey || props.target === "_blank" || props.download || !href) return;
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith("/vendas/pedidos")) return;
    evento.preventDefault(); atualizarNavegacaoGestor(`${url.pathname}${url.search}`);
  }} />;
});
export default LinkGestor;
