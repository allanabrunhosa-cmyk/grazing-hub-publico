import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { importarNfseXml } from "@/lib/nfse/servico";
import { TAMANHO_MAXIMO_XML_NFSE } from "@/lib/nfse/parse";

export async function POST(requisicao: Request) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "adicionar"))) return Response.json({ erro: "Seu perfil não permite importar NFS-e." }, { status: 403 });
  try {
    const formulario = await requisicao.formData();
    const arquivo = formulario.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > TAMANHO_MAXIMO_XML_NFSE) return Response.json({ erro: "Selecione um XML de NFS-e de até 1,5 MB." }, { status: 400 });
    const resultado = await importarNfseXml(await arquivo.text(), "ARQUIVO", sessao.nome);
    if ("erro" in resultado) return Response.json(resultado, { status: 400 });
    revalidatePath("/financeiro/manifesto-nfs");
    return Response.json({ mensagem: resultado.nova ? "NFS-e importada com sucesso." : "NFS-e já existente; o XML foi atualizado quando estava pendente." });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e." }, { status: 400 });
  }
}
