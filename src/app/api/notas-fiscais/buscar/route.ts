import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { agendarBusca } from "@/lib/sefaz/busca-agendada";

export async function POST() {
  if (!(await getSession())) {
    return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  }
  if (!(await podeAcessar("notas", "adicionar"))) {
    return Response.json({ erro: "Seu perfil não permite buscar novas notas." }, { status: 403 });
  }

  try {
    return Response.json(await agendarBusca());
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Erro desconhecido ao consultar a SEFAZ." },
      { status: 500 }
    );
  }
}
