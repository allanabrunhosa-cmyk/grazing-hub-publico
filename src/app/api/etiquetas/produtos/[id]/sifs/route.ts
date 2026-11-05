import { consultarSifsSalvos } from "@/lib/etiquetas/sifs-salvos";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return new Response(null, { status: 401 });
  if (!await podeAcessar("producao.imprimir", "adicionar")) return new Response(null, { status: 403 });
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response(null, { status: 404 });
  const sifs = await consultarSifsSalvos("singleton", id);
  return Response.json([...sifs], { headers: { "Cache-Control": "private, no-store" } });
}
