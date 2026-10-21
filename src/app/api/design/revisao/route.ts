import { getSession } from "@/lib/session";
import { obterTemaPublicado } from "@/lib/design-system/servico";

export async function GET() {
  if (!(await getSession())) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const tema = await obterTemaPublicado();
  return Response.json({ revisao: tema.revisao }, { headers: { "Cache-Control": "no-store" } });
}
