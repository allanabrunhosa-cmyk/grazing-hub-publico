import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Card de métrica pra faixa de KPIs no topo das listagens. Só leva `badge`/`progress`
// quando o número representa uma proporção real (ex.: % de itens ativos) — nunca decoração.
export function KpiCard({
  label,
  value,
  badge,
  progress,
}: {
  label: string;
  value: string | number;
  badge?: string;
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {badge && <Badge variant="success">{badge}</Badge>}
        </div>
        <p className="font-heading text-stat text-foreground tabular-nums tracking-tight">{value}</p>
        {progress != null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
