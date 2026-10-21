import { Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { LocaisDialog } from "@/app/(protegido)/inventario/locais-dialog";

export default async function InventarioLayout({ children }: { children: React.ReactNode }) {
  const locais = await prisma.localEstoque.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Estoque" descricao="Inventário, movimentações e contagens">
        <LocaisDialog
          locais={locais}
          trigger={
            <Button variant="outline" className="gap-1.5">
              <Warehouse className="size-4" />
              Locais
            </Button>
          }
        />
      </BarraAcoes>

      {children}
    </div>
  );
}
