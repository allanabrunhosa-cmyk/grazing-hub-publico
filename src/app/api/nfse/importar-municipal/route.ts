import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { importarNfseMunicipal } from "@/lib/nfse/servico";

export const runtime = "nodejs";

export async function POST(requisicao: Request) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "adicionar"))) return Response.json({ erro: "Seu perfil não permite importar NFS-e." }, { status: 403 });
  try {
    const corpo = await requisicao.json() as Record<string, unknown>;
    const texto = (valor: unknown) => typeof valor === "string" ? valor : "";
    const resultado = await importarNfseMunicipal({
      municipioCodigo: texto(corpo.municipioCodigo), cnpjPrestador: texto(corpo.cnpjPrestador),
      numero: texto(corpo.numero), dataEmissao: texto(corpo.dataEmissao), codigoVerificacao: texto(corpo.codigoVerificacao),
    }, sessao.nome);
    if ("erro" in resultado) return Response.json(resultado, { status: 400 });
    revalidatePath("/financeiro/manifesto-nfs");
    return Response.json({ mensagem: resultado.nova ? "NFS-e municipal localizada e importada como pendente." : "Esta NFS-e já estava no manifesto. Seus lançamentos e sua situação foram preservados." });
  } catch {
    return Response.json({ erro: "Não foi possível importar a NFS-e municipal. Confira os dados e tente novamente." }, { status: 400 });
  }
}
