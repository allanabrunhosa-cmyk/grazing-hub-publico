import { getSession } from "@/lib/session";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { prisma } from "@/lib/prisma";
export async function GET(_pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSession();
  if (!sessao) return new Response(null, { status: 401 });
  const acessoCatalogo = sessao.admin || ["vendas.produtos", "vendas.fiscal"].some(recurso => permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "visualizar"));
  const acessoPedidos = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "vendas.pedidos", "visualizar");
  if (!acessoCatalogo && !acessoPedidos) return new Response(null, { status: 403 });
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response(null, { status: 404 });
  if (!acessoCatalogo && !await prisma.produtoVenda.findFirst({ where: { fotoUrl: `/api/vendas/fotos/${id}`, itensPedidoVenda: { some: { vigente: true } } }, select: { id: true } })) return new Response(null, { status: 403 });
  const foto = await prisma.fotoProdutoVenda.findUnique({ where: { id }, select: { dados: true, mime: true } });
  if (!foto) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(foto.dados), { headers: { "Content-Type": foto.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
}
