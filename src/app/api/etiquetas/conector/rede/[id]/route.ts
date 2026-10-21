import { autenticarDispositivo } from "@/lib/etiquetas/pontos";
import { prisma } from "@/lib/prisma";
import { lerJsonLimitado } from "@/lib/etiquetas/pontos-payload";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) return new Response(null, { status: 401 });
  const corpo = await lerJsonLimitado(request, 256);
  const estado = corpo?.estado;
  if (estado !== "CONFIRMADA" && estado !== "REVERTIDA" && estado !== "FALHA") return new Response(null, { status: 400 });
  const { id } = await context.params;
  const atualizado = await prisma.mudancaWifiPonto.updateMany({ where: { id, pontoId: dispositivo.pontoId, estado: "ENTREGUE" }, data: { estado, finalizadoEm: new Date() } });
  return Response.json({ concluido: atualizado.count === 1 }, { status: atualizado.count === 1 ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}
