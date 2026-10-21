import { podeAcessar } from "@/lib/permissoes/servidor";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSession();
  if (!sessao) return new Response(null, { status: 401 });
  if (!await podeAcessar("insumos")) return new Response(null, { status: 403 });


  const insumo = await prisma.insumo.findUnique({
    where: { id },
    select: { fotoData: true, fotoMimeType: true },
  });

  if (!insumo?.fotoData || !insumo.fotoMimeType) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(insumo.fotoData), {
    headers: {
      "Content-Type": insumo.fotoMimeType,
      "Cache-Control": "private, no-store",
    },
  });
}
