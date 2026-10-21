import { Card, CardContent } from "@/components/ui/card";
import { BarraAcoes } from "@/components/padroes-operacionais";
import type { AppModule } from "@/lib/modules";

export function ModuleComingSoon({ module }: { module: AppModule }) {
  const Icon = module.icon;

  return (
    <div className="space-y-6">
      <BarraAcoes titulo={module.name} descricao={module.subtitle} />

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
          <span
            className="flex size-12 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: module.color }}
          >
            <Icon className="size-6" />
          </span>
          <p className="font-medium">Módulo em construção.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {module.name} ainda não tem telas neste sistema. Ele já aparece na navegação pra você
            visualizar a estrutura completa do Grazing HUB.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
