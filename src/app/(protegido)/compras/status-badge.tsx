import { Badge } from "@/components/ui/badge";
import { statusExibicaoLabels, type StatusExibicaoPedido } from "@/app/(protegido)/compras/types";
import { coresStatusPedido } from "./cores-status";

export function StatusPedidoBadge({ status }: { status: StatusExibicaoPedido }) {
  return <Badge variant="outline" className={coresStatusPedido[status]}>{statusExibicaoLabels[status]}</Badge>;
}
