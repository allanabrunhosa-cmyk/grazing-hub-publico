import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { normalizarChaveAcesso } from "@/lib/sefaz/chave-acesso";
import { importarPelaChave } from "@/lib/sefaz/importar-chave";

export async function POST(requisicao: Request) {
  if (!(await getSession())) {
    return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  }
  const [podeAdicionar, podeEditar] = await Promise.all([
    podeAcessar("notas", "adicionar"),
    podeAcessar("notas", "editar"),
  ]);
  if (!podeAdicionar || !podeEditar) {
    return Response.json({ erro: "Seu perfil não permite importar notas pela chave." }, { status: 403 });
  }

  try {
    const corpo = await requisicao.json() as { chave?: unknown };
    const chave = normalizarChaveAcesso(corpo.chave);
    if (!chave) {
      return Response.json({ erro: "Informe uma chave válida de NF-e modelo 55, com 44 dígitos." }, { status: 400 });
    }
    const resultado = await importarPelaChave(chave);
    if ("erro" in resultado) return Response.json(resultado, { status: 400 });
    revalidatePath("/notas-fiscais");
    return Response.json(resultado);
  } catch {
    return Response.json(
      { erro: "Não foi possível consultar a nota. Confira o certificado configurado e tente novamente mais tarde." },
      { status: 500 }
    );
  }
}
