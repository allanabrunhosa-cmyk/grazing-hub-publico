import { podeAcessar } from "@/lib/permissoes/servidor";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** Foto já cadastrada. Usa a autorização do catálogo de Validades. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return new Response(null, { status: 401 });
  if (!await podeAcessar("producao")) return new Response(null, { status: 403 });
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response(null, { status: 404 });
  const produto = await prisma.insumo.findUnique({ where: { id }, select: { fotoData: true, fotoMimeType: true } });
  if (!produto?.fotoData || !produto.fotoMimeType || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(produto.fotoMimeType)) {
    return new Response(null, { status: 404 });
  }
  return new Response(new Uint8Array(produto.fotoData), { headers: {
    "Content-Type": produto.fotoMimeType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
