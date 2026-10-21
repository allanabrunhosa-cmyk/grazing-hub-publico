import { consultarAtividades } from "@/lib/atividades/consulta";
import { ErroConsultaAtividades } from "@/lib/atividades/filtros";
import type { FiltrosAtividades } from "@/lib/atividades/types";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params, p = new URL(request.url).searchParams;
  // Nenhum autor/origem de registro vem desta API: ela só consulta o alvo autorizado.
  try {
    const resultado = await consultarAtividades({ usuarioId: id, de: p.get("de") ?? "", ate: p.get("ate") ?? "",
      modulo: p.get("modulo") ?? undefined, acao: p.get("acao") ?? undefined, resultado: p.get("resultado") ?? undefined,
      origem: p.get("origem") ?? undefined, perspectiva: (p.get("perspectiva") ?? "autor") as FiltrosAtividades["perspectiva"],
      cursor: p.get("cursor") ?? undefined });
    return Response.json(resultado, { headers: { "Cache-Control": "private, no-store" } });
  } catch (erro) {
    return Response.json({ erro: erro instanceof ErroConsultaAtividades ? erro.message : "Não foi possível consultar atividades. Tente novamente." },
      { status: erro instanceof ErroConsultaAtividades ? erro.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
