import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { TAMANHO_MAXIMO_XML } from "@/lib/sefaz/validar-importacao";
import { importarXmlAvulso, importarXmlNaNota } from "@/lib/sefaz/importar-xml-avulso";

const LIMITE_REQUISICAO = TAMANHO_MAXIMO_XML + 64 * 1024;

export async function POST(requisicao: Request) {
  if (!(await getSession())) {
    return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  }
  const tamanho = Number(requisicao.headers.get("content-length"));
  if (Number.isFinite(tamanho) && tamanho > LIMITE_REQUISICAO) {
    return Response.json({ erro: "Selecione um XML de até 800 KB." }, { status: 413 });
  }

  try {
    const formulario = await requisicao.formData();
    const notaFiscalId = formulario.get("notaFiscalId");
    const emNotaExistente = typeof notaFiscalId === "string" && notaFiscalId.trim() !== "";
    const podeEditar = await podeAcessar("notas", "editar");
    const podeAdicionar = emNotaExistente || await podeAcessar("notas", "adicionar");
    if (!podeEditar || !podeAdicionar) {
      return Response.json({ erro: "Seu perfil não permite importar XML de notas." }, { status: 403 });
    }
    const resultado = emNotaExistente
      ? await importarXmlNaNota(notaFiscalId, formulario)
      : await importarXmlAvulso(formulario);
    if ("erro" in resultado) return Response.json(resultado, { status: 400 });
    revalidatePath("/notas-fiscais");
    return Response.json(resultado);
  } catch {
    return Response.json({ erro: "Não foi possível importar o XML." }, { status: 400 });
  }
}
