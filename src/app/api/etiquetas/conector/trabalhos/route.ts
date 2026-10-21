import { autenticarDispositivo, reservarProximoEnvio } from "@/lib/etiquetas/pontos";

export async function GET(request: Request) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) return new Response(null, { status: 401 });
  if (!dispositivo.ponto.impressoraSelecionadaId || !dispositivo.impressoraDetectada) return Response.json({ trabalho: null, motivo: "IMPRESSORA_INDISPONIVEL" }, { headers: { "Cache-Control": "no-store" } });
  const envio = await reservarProximoEnvio(dispositivo.pontoId, dispositivo.ponto.lojaId);
  return Response.json({ trabalho: envio ? { id: envio.id, zpl: envio.zpl, impressoraId: dispositivo.ponto.impressoraSelecionadaId } : null }, { headers: { "Cache-Control": "no-store" } });
}
