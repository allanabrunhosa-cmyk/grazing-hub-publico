"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ErroAsaas } from "@/lib/asaas/dominio";
import { estadoAsaas, reprocessarFalhasAsaas, testarAsaas } from "@/lib/asaas/painel";
import { ErroSite } from "@/lib/site/adaptador";
import { estadoSite, reprocessarFalhasSite, salvarIntegracaoSite, testarSite } from "@/lib/site/configuracao";

const falha = (e: unknown) => ({ erro: e instanceof ErroAsaas || e instanceof ErroSite ? e.message : "Não foi possível concluir. Tente novamente." });
const CAMINHO = "/configuracoes/integracoes";

/** Cada serviço relê a sessão e exige administrador dentro da própria transação. */
export async function testarAsaasAction() {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return await testarAsaas(s); } catch (e) { return falha(e); }
}
export async function reprocessarAsaasAction() {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { const quantidade = await reprocessarFalhasAsaas(s); revalidatePath(CAMINHO); return { ok: true as const, quantidade, estado: await estadoAsaas() }; } catch (e) { return falha(e); }
}
export async function salvarSiteAction(canalId: string, ativa: boolean) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { await salvarIntegracaoSite({ canalId, ativa }, s); revalidatePath(CAMINHO); return { ok: true as const, estado: await estadoSite() }; } catch (e) { return falha(e); }
}
export async function testarSiteAction() {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return await testarSite(s); } catch (e) { return falha(e); }
}
export async function reprocessarSiteAction() {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { const quantidade = await reprocessarFalhasSite(s); revalidatePath(CAMINHO); return { ok: true as const, quantidade, estado: await estadoSite() }; } catch (e) { return falha(e); }
}
