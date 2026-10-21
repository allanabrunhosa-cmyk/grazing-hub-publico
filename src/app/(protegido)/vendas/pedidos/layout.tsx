import type { ReactNode } from "react";
import { ShellPopupsPedidos } from "./popup-direto";

export default function PedidosLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <ShellPopupsPedidos modal={modal}>{children}</ShellPopupsPedidos>;
}
