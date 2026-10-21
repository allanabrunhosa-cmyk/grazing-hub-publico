"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SelecaoFormulario } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FUNCOES_MCP } from "@/lib/mcp/catalogo";
import { consentirMcpAction } from "./actions";

export function ConsentimentoMcp({ solicitacao, politicas }: { solicitacao: string; politicas: { id: string; nome: string; detalhe: string; escopos: string[]; revisao: string }[] }) {
  const [estado, action, pendente] = useActionState(consentirMcpAction, { erro: null });
  const [selecionada, setSelecionada] = useState(politicas[0]?.id ?? "");
  return <form action={action} className="space-y-4">
    <input type="hidden" name="solicitacao" value={solicitacao} />
    <input type="hidden" name="revisao" value={politicas.find(p => p.id === selecionada)?.revisao ?? ""} />
    <label className="block space-y-2 text-sm font-medium">Política de acesso<SelecaoFormulario name="autorizacao" required disabled={pendente} value={selecionada} onValueChange={setSelecionada}>{politicas.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.detalhe}</option>)}</SelecaoFormulario></label>
    <ul className="list-disc space-y-1 pl-5 text-sm">{FUNCOES_MCP.filter(f => politicas.find(p => p.id === selecionada)?.escopos.includes(f.escopo)).map(f => <li key={f.nome}>{f.titulo}: {f.descricao}</li>)}</ul>
    <label className="flex items-start gap-2 text-sm"><Checkbox name="consentimento" value="on" required disabled={pendente} className="mt-1" />Autorizo esta aplicação a usar exclusivamente as consultas e ações listadas acima, dentro das minhas permissões atuais. Escritas sensíveis exigirão também revisão humana autenticada no HUB.</label>
    <p className="text-sm text-muted-foreground">A credencial vence em uma hora e exige nova autorização. Novas funções não serão concedidas a tokens anteriores. Você pode solicitar suspensão ou revogação em Integrações → MCP, sem perder seu acesso normal ao HUB.</p>
    {estado.erro && <p role="alert" className="text-sm text-destructive">{estado.erro}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" render={<Link href="/" />}>Cancelar</Button><Button type="submit" disabled={pendente || !politicas.length}>{pendente ? "Autorizando..." : "Autorizar acesso"}</Button></div>
  </form>;
}
