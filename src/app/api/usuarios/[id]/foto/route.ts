import { podeAcessar } from "@/lib/permissoes/servidor";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSession();
  if (!sessao) return new Response(null, { status: 401 });
  if (sessao.userId !== id && !await podeAcessar("configuracoes.usuarios")) return new Response(null, { status: 403 });


  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { fotoData: true, fotoMimeType: true },
  });

  if (!usuario?.fotoData || !usuario.fotoMimeType) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(usuario.fotoData), {
    headers: {
      "Content-Type": usuario.fotoMimeType,
      "Cache-Control": "private, no-store",
    },
  });
}
