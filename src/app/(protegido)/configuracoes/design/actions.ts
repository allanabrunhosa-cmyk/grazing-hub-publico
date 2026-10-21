"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ErroDesign, publicarRascunhoDesign, restaurarVersaoDesign, salvarRascunhoDesign } from "@/lib/design-system/servico";
import type { ResultadoDesign } from "@/lib/design-system/tipos";

function exigirAdministrador(admin: boolean) {
  if (!admin) redirect("/sem-acesso");
}

function revalidarDesign() {
  revalidatePath("/", "layout");
  revalidatePath("/configuracoes/design");
}

function resultadoErro(erro: unknown): ResultadoDesign {
  return { erro: erro instanceof ErroDesign ? erro.message : "Não foi possível concluir a alteração visual. Tente novamente." };
}

export async function salvarRascunhoDesignAction(input: { valores: unknown; revisao: number; versaoBase: number }): Promise<ResultadoDesign> {
  const sessao = await exigirPermissao("configuracoes.design");
  exigirAdministrador(sessao.admin);
  try {
    const rascunho = await salvarRascunhoDesign({ ...input, autorId: sessao.userId });
    revalidarDesign();
    return { ok: true, mensagem: "Rascunho salvo. A operação continua usando a versão publicada.", rascunho };
  } catch (erro) { return resultadoErro(erro); }
}

export async function publicarRascunhoDesignAction(input: { revisao: number; motivo: unknown; chaveIdempotencia: unknown }): Promise<ResultadoDesign> {
  const sessao = await exigirPermissao("configuracoes.design");
  exigirAdministrador(sessao.admin);
  try {
    const resultado = await publicarRascunhoDesign({ ...input, autorId: sessao.userId });
    revalidarDesign();
    return { ok: true, mensagem: resultado.repetida ? "Esta publicação já foi concluída." : "Tema publicado para os componentes conectados.", publicada: resultado.versao, revisaoPublicada: resultado.versao.numero, rascunho: null };
  } catch (erro) { return resultadoErro(erro); }
}

export async function restaurarVersaoDesignAction(input: { versaoId: unknown; versaoBase: number; motivo: unknown; chaveIdempotencia: unknown }): Promise<ResultadoDesign> {
  const sessao = await exigirPermissao("configuracoes.design");
  exigirAdministrador(sessao.admin);
  try {
    const resultado = await restaurarVersaoDesign({ ...input, autorId: sessao.userId });
    revalidarDesign();
    return { ok: true, mensagem: resultado.repetida ? "Esta restauração já foi concluída." : "Versão restaurada e publicada como novo histórico.", publicada: resultado.versao, revisaoPublicada: resultado.versao.numero };
  } catch (erro) { return resultadoErro(erro); }
}
