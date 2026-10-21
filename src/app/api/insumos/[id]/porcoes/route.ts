import { getSession } from "@/lib/session";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { consultarPorcoes, ErroPorcao, RECURSOS_LEITURA } from "@/lib/insumos/porcoes-servidor";
import { identificadorPorcaoValido } from "@/lib/insumos/porcoes";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou. Entre novamente." }, { status: 401, headers });
  if (!sessao.admin && !RECURSOS_LEITURA.some(recurso => permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "visualizar"))) {
    return Response.json({ erro: "Seu acesso não permite consultar porções." }, { status: 403, headers });
  }
  const { id } = await params;
  if (!identificadorPorcaoValido(id)) return Response.json({ erro: "Escolha um insumo válido." }, { status: 400, headers });
  try {
    return Response.json(await consultarPorcoes(id, sessao), { headers });
  } catch (erro) {
    return Response.json({ erro: erro instanceof ErroPorcao ? erro.message : "Não foi possível consultar as porções. Tente novamente." }, { status: erro instanceof ErroPorcao ? 400 : 503, headers });
  }
}
