import { Loader2 } from "lucide-react";

export default function CarregandoContagem() {
  return <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
    <Loader2 className="size-4 animate-spin" /> Abrindo contagem e recuperando os itens salvos...
  </div>;
}
