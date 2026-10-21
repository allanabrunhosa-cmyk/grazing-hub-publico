import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { exportarConsultaBiCsv } from "@/lib/vendas/bi-consultas";
import { entradaBiDaUrl } from "@/lib/vendas/bi-url";
import { ErroBi } from "@/lib/vendas/bi-filtros";

export async function GET(requisicao: Request) {
  const cabecalhos = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!await getSession()) return Response.json({ erro: "Sua sessão expirou." }, { status: 401, headers: cabecalhos });
  if (!await podeAcessar("vendas.bi") || !await podeAcessar("vendas.bi.exportar")) {
    return Response.json({ erro: "Seu perfil não permite exportar o Dashboard." }, { status: 403, headers: cabecalhos });
  }
  const [contatos, custos, pedidos] = await Promise.all([
    podeAcessar("vendas.bi.contatos"), podeAcessar("vendas.bi.custos"), podeAcessar("vendas.pedidos"),
  ]);
  try {
    const entrada = entradaBiDaUrl(Object.fromEntries(new URL(requisicao.url).searchParams));
    const conteudo = await exportarConsultaBiCsv(entrada, { contatos, custos, pedidos, exportar: true });
    return new Response(conteudo, { headers: {
      ...cabecalhos, "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bi-de-vendas.csv"',
    } });
  } catch (erro) {
    return Response.json({ erro: erro instanceof ErroBi ? erro.message : "Não foi possível exportar a seleção. Confira os filtros e tente novamente." }, { status: erro instanceof ErroBi ? erro.status : 400, headers: cabecalhos });
  }
}
