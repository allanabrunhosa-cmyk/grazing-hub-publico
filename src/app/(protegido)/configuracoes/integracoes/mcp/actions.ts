"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { alterarAdministracaoMcp, diagnosticarMcp } from "@/lib/mcp/administracao";
import { ErroMcp } from "@/lib/mcp/politica";
import { limitarMcp } from "@/lib/mcp/servidor";

export async function salvarMcpAction(entrada: unknown): Promise<{ ok: true } | { erro: string }> {
  const sessao = await exigirPermissao("configuracoes.mcp", "editar");
  try { await limitarMcp(`admin:${sessao.userId}`, 30); await alterarAdministracaoMcp(entrada, sessao.userId); }
  catch (e) { return { erro: e instanceof ErroMcp ? e.message : "Não foi possível salvar. Confira os campos, nomes únicos e a versão atual." }; }
  revalidatePath("/configuracoes/integracoes/mcp"); return { ok: true };
}
export async function diagnosticarMcpAction(): Promise<{ ok: true } | { erro: string }> {
  const sessao = await exigirPermissao("configuracoes.mcp", "visualizar");
  try { await limitarMcp(`diagnostico:${sessao.userId}`, 5); await diagnosticarMcp(sessao.userId); }
  catch { return { erro: "Diagnóstico indisponível. Verifique as migrations e a configuração do servidor." }; }
  revalidatePath("/configuracoes/integracoes/mcp"); return { ok: true };
}
