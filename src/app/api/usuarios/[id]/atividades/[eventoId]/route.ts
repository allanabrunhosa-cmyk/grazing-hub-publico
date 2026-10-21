import { consultarDetalheAtividade } from "@/lib/atividades/consulta";
import { ErroConsultaAtividades } from "@/lib/atividades/filtros";
export async function GET(_request: Request, context: { params: Promise<{ id: string; eventoId: string }> }) {
  try {
    const { id, eventoId } = await context.params;
    return Response.json(await consultarDetalheAtividade(id, eventoId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (erro) {
    return Response.json({ erro: erro instanceof ErroConsultaAtividades ? erro.message : "Não foi possível consultar os detalhes. Tente novamente." },
      { status: erro instanceof ErroConsultaAtividades ? erro.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
