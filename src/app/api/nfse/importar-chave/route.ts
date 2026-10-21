import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { importarNfsePorChave } from "@/lib/nfse/servico";

export async function POST(requisicao: Request) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "adicionar"))) return Response.json({ erro: "Seu perfil não permite importar NFS-e." }, { status: 403 });
  try {
    const corpo = await requisicao.json() as Record<string, unknown>;
    const chave = typeof corpo.chave === "string" ? corpo.chave : "";
    const resultado = await importarNfsePorChave(chave, sessao.nome);
    if ("erro" in resultado) return Response.json(resultado, { status: 400 });
    revalidatePath("/financeiro/manifesto-nfs");
    return Response.json({ mensagem: resultado.nova ? "NFS-e localizada e importada com sucesso." : "Esta NFS-e já estava no manifesto." });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e pela chave." }, { status: 400 });
  }
}
