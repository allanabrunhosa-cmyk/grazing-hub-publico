import { consultarHistoricoImportado, ErroConsultaHistorica } from "@/lib/vendas/historico-consultas";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const resultado = await consultarHistoricoImportado({ tipo: p.get("tipo") ?? undefined, mes: p.get("mes") ?? undefined,
      numero: p.get("numero") ?? undefined, pagina: Number(p.get("pagina") ?? 1) });
    return Response.json(resultado, { headers });
  } catch (erro) {
    return Response.json({ erro: erro instanceof ErroConsultaHistorica ? erro.message : "Não foi possível consultar o histórico." },
      { headers, status: erro instanceof ErroConsultaHistorica ? erro.status : 503 });
  }
}
