"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConteudoMenuLateral } from "./sidebar";
import { ConteudoMenuEtiquetas } from "./menu-etiquetas";
import { ConteudoMenuPedidos } from "./menu-pedidos";
import type { IdentidadeInterface } from "@/lib/hosts";

export function NavegacaoMovel({ dedicado = false, identidade = dedicado ? "etiquetas" : "hub" }: { dedicado?: boolean; identidade?: IdentidadeInterface }) {
  const [aberto, definirAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={definirAberto}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir navegação" />}>
        <Menu className="size-5" />
      </DialogTrigger>
      <DialogContent className={`menu-movel ${identidade === "hub" ? "" : `menu-${identidade}`} translate-x-0 translate-y-0`} onClick={(evento) => {
        if (evento.target instanceof Element && evento.target.closest("a[href]")) definirAberto(false);
      }}>
        <DialogTitle className="sr-only">Navegação do sistema</DialogTitle>
        {identidade === "pedidos" ? <ConteudoMenuPedidos /> : identidade === "etiquetas" ? <ConteudoMenuEtiquetas /> : <ConteudoMenuLateral />}
      </DialogContent>
    </Dialog>
  );
}
