import { autenticarDispositivo } from "@/lib/etiquetas/pontos";
import { entregarMudancaWifi } from "@/lib/etiquetas/pontos-wifi";

export async function GET(request: Request) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) return new Response(null, { status: 401 });
  const pedido = await entregarMudancaWifi(dispositivo.pontoId);
  return Response.json({ pedido }, { headers: { "Cache-Control": "no-store" } });
}
