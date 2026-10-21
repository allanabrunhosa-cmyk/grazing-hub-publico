"use server";
import { z } from "zod";
import { aprovarRevisaoMcp } from "@/lib/mcp/operacoes";
import { ErroMcp } from "@/lib/mcp/politica";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/permissoes/servidor";
export async function aprovarMcpAction(_: { erro: string | null; ok: boolean }, form: FormData) {
  await exigirSessao();
  const p = z.object({ id: z.string().uuid(), conteudoHash: z.string().length(64), revisado: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!p.success) return { erro: "Confira e marque a revisão dos dados antes de aprovar.", ok: false };
  try { await aprovarRevisaoMcp(p.data.id, p.data.conteudoHash); revalidatePath(`/mcp/revisao/${p.data.id}`); return { erro: null, ok: true }; }
  catch (e) { return { erro: e instanceof ErroMcp ? e.message : "Não foi possível aprovar. Atualize a proposta antes de tentar novamente.", ok: false }; }
}
