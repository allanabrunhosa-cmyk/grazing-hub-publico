import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { consultarBiVendas } from "@/lib/vendas/bi-consultas";
import { consultarMapaBi } from "@/lib/vendas/bi-mapa-consultas";
import { entradaBiDaUrl } from "@/lib/vendas/bi-url";
import { ErroBi } from "@/lib/vendas/bi-filtros";
import { contextoDoHost } from "@/lib/hosts";

export async function POST(requisicao: Request) {
  const cabecalhos = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const host = contextoDoHost(requisicao.headers), origem = requisicao.headers.get("origin"), site = requisicao.headers.get("sec-fetch-site");
  if (!host || host.identidade !== "hub" || origem !== host.origem || (site !== null && site !== "same-origin")) {
    return Response.json({ erro: "Origem não permitida para consultar o mapa." }, { status: 403, headers: cabecalhos });
  }
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou." }, { status: 401, headers: cabecalhos });
  if (!await podeAcessar("vendas.bi")) return Response.json({ erro: "Seu perfil não permite consultar o Dashboard." }, { status: 403, headers: cabecalhos });
  const [contatos, custos, pedidos] = await Promise.all([
    podeAcessar("vendas.bi.contatos"), podeAcessar("vendas.bi.custos"), podeAcessar("vendas.pedidos"),
  ]);
  try {
    const entrada = entradaBiDaUrl(Object.fromEntries(new URL(requisicao.url).searchParams));
    const r = await consultarBiVendas(entrada, { contatos, custos, pedidos });
    return Response.json(await consultarMapaBi(r.locaisEntrega, { usuarioId: sessao.userId, totalEntregas: r.cobertura.entregas }), { headers: cabecalhos });
  } catch (erro) {
    return Response.json({ erro: erro instanceof ErroBi ? erro.message : "Não foi possível consultar o mapa desta seleção. Tente novamente." }, { status: erro instanceof ErroBi ? erro.status : 503, headers: cabecalhos });
  }
}
