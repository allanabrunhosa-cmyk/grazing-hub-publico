import { consumirCodigoVinculo } from "@/lib/etiquetas/pontos";
import { lerJsonLimitado } from "@/lib/etiquetas/pontos-payload";

export async function POST(request: Request) {
  const corpo = await lerJsonLimitado(request, 1024);
  const codigo = typeof corpo?.codigo === "string" ? corpo.codigo.trim().toUpperCase() : "";
  const vinculo = await consumirCodigoVinculo(codigo, request);
  if (!vinculo) return Response.json({ erro: "Código inválido, expirado ou limite de tentativas alcançado." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return Response.json(vinculo, { headers: { "Cache-Control": "no-store" } });
}
