"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { importarXmlAvulso, importarXmlNaNota } from "@/lib/sefaz/importar-xml-avulso";

export async function importarXmlAvulsoAction(formulario: FormData): Promise<{ mensagem: string } | { erro: string }> {
  await exigirPermissao("notas", "adicionar");
  await exigirPermissao("notas", "editar");
  if (!(await getSession())) return { erro: "Sua sessão expirou. Entre novamente." };
  const resultado = await importarXmlAvulso(formulario);
  if (!("erro" in resultado)) {
    revalidatePath("/notas-fiscais");
  }
  return resultado;
}

export async function importarXmlNotaAction(notaFiscalId: string, formulario: FormData): Promise<{ ok: true } | { erro: string }> {
  await exigirPermissao("notas", "editar");
  if (!(await getSession())) return { erro: "Sua sessão expirou. Entre novamente." };
  const resultado = await importarXmlNaNota(notaFiscalId, formulario);
  if (!("erro" in resultado)) {
    revalidatePath("/notas-fiscais");
  }
  return resultado;
}
