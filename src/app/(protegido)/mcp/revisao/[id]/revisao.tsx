"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { aprovarMcpAction } from "./actions";
export function RevisaoMcp({ id, conteudoHash, disponivel }: { id: string; conteudoHash: string; disponivel: boolean }) {
  const [estado, action, pendente] = useActionState(aprovarMcpAction, { erro: null, ok: false });
  return <form action={action} className="space-y-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="conteudoHash" value={conteudoHash} />
    <label className="flex items-start gap-2 text-sm"><Checkbox name="revisado" value="on" required disabled={!disponivel || pendente || estado.ok} />Revisei os registros, alterações e impactos e autorizo esta operação específica.</label>
    {estado.erro && <p role="alert" className="text-sm text-destructive">{estado.erro}</p>}
    {estado.ok && <p role="status" className="text-sm">Revisão aprovada. Retorne à conversa e solicite a execução desta proposta. A operação ainda não foi executada.</p>}
    <GrupoAcoes><Button variant="outline" render={<Link href="/" />}>Voltar ao HUB</Button><Button type="submit" disabled={!disponivel || pendente || estado.ok}>{pendente ? "Aprovando..." : "Aprovar operação revisada"}</Button></GrupoAcoes>
  </form>;
}
