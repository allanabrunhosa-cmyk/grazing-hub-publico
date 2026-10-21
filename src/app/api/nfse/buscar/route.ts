import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { sincronizarNfse } from "@/lib/nfse/servico";

export async function POST() {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "adicionar"))) return Response.json({ erro: "Seu perfil não permite buscar novas NFS-e." }, { status: 403 });
  try {
    const resultado = await sincronizarNfse(sessao.nome);
    revalidatePath("/financeiro/manifesto-nfs");
    return Response.json(resultado, { status: "erro" in resultado ? 502 : 200 });
  } catch {
    return Response.json({ erro: "Não foi possível concluir a busca de NFS-e. Verifique a configuração do certificado e atualize a página para conferir o resultado antes de tentar novamente." }, { status: 502 });
  }
}
