import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { decidirNfse, type DecisaoNfse } from "@/lib/nfse/situacao";

export async function POST(requisicao: Request) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "editar"))) return Response.json({ erro: "Seu perfil não permite alterar esta nota." }, { status: 403 });
  try {
    const corpo = await requisicao.json();
    if (typeof corpo?.nfseId !== "string" || (corpo?.decisao !== "ACEITAR" && corpo?.decisao !== "RECUSAR")) {
      return Response.json({ erro: "Informe a nota e escolha aceitar ou recusar." }, { status: 400 });
    }
    const resultado = await decidirNfse({ nfseId: corpo.nfseId, decisao: corpo.decisao as DecisaoNfse, autorNome: sessao.nome });
    if ("erro" in resultado) return Response.json(resultado, { status: 409 });
    revalidatePath("/financeiro/manifesto-nfs");
    return Response.json(resultado);
  } catch {
    return Response.json({ erro: "Não foi possível alterar a situação. Tente novamente." }, { status: 400 });
  }
}
