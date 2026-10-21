import { autenticarDispositivo, finalizarEnvio } from "@/lib/etiquetas/pontos";
import { lerJsonLimitado } from "@/lib/etiquetas/pontos-payload";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) return new Response(null, { status: 401 });
  const corpo = await lerJsonLimitado(request, 512);
  const estado = corpo?.estado;
  if (estado !== "ENVIADO_USB" && estado !== "FALHA" && estado !== "INCERTO") return new Response(null, { status: 400 });
  const { id } = await context.params;
  const concluido = await finalizarEnvio(dispositivo.pontoId, id, estado);
  return Response.json({ concluido }, { status: concluido ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}
