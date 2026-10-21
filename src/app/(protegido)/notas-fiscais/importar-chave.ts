"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { revalidatePath } from "next/cache";
import { normalizarChaveAcesso } from "@/lib/sefaz/chave-acesso";
import { importarPelaChave } from "@/lib/sefaz/importar-chave";
export async function importarChaveAction(valor: string): Promise<{mensagem:string}|{erro:string}> {
  await exigirPermissao("notas", "adicionar");
  await exigirPermissao("notas", "editar");
  const chave = normalizarChaveAcesso(valor);
  if (!chave) return {erro:"Informe uma chave válida de NF-e modelo 55, com 44 dígitos."};
  try { const resultado = await importarPelaChave(chave); revalidatePath("/notas-fiscais"); return resultado; }
  catch {return {erro:"Não foi possível consultar a nota. Confira o certificado configurado e tente novamente mais tarde."};}
}
