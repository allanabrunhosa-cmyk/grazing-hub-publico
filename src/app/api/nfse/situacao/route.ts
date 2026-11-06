import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { decidirNfse, validarEntradaDecisaoNfse } from "@/lib/nfse/situacao";

export async function POST(requisicao: Request) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "editar"))) return Response.json({ erro: "Seu perfil não permite alterar esta nota." }, { status: 403 });
  try {
    const dados = validarEntradaDecisaoNfse(await requisicao.json());
    if ("erro" in dados) return Response.json(dados, { status: 400 });
    const resultado = await decidirNfse({ ...dados, autorNome: sessao.nome });
    if ("erro" in resultado) return Response.json(resultado, { status: 409 });
    revalidatePath("/financeiro/manifesto-nfs");
    return Response.json(resultado);
  } catch {
    return Response.json({ erro: "Não foi possível alterar a situação. Tente novamente." }, { status: 400 });
  }
}
