"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AcoesEdicao } from "@/components/padroes-operacionais";
import { configurarUsuarioResponsavelAction, salvarResponsavelEtiquetaAction } from "./operacao-actions";
export type ConfiguracaoResponsaveis = { usuarios: Pessoa[]; cadastros: Pessoa[] };
type Pessoa = { id: string; nome: string; ativo: boolean };
function LinhaResponsavel({ pessoa, usuario }: { pessoa: Pessoa; usuario: boolean }) {
  const [ativo, setAtivo] = useState(pessoa.ativo);
  const [nome, setNome] = useState(pessoa.nome);
  const [pendente, iniciar] = useTransition();
  const roteador = useRouter();
  return <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
    {usuario ? <strong className="min-w-0 break-words text-sm">{pessoa.nome}</strong> : <Input aria-label={`Nome de ${pessoa.nome}`} value={nome} maxLength={120} disabled={pendente} onChange={e => setNome(e.target.value.replace(/[\u0000-\u001f\u007f]/g, ""))} />}
    <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={ativo} disabled={pendente} onCheckedChange={setAtivo} /> Disponível</label>
    <AcoesEdicao nome={`responsável ${pessoa.nome}`} alterado={ativo !== pessoa.ativo || nome !== pessoa.nome} salvando={pendente} invalido={!nome.trim()} destacarAlterado confirmar={() => iniciar(async () => {
      const r = usuario ? await configurarUsuarioResponsavelAction(pessoa.id, ativo) : await salvarResponsavelEtiquetaAction({ id: pessoa.id, nome, ativo });
      if ("erro" in r) toast.error(r.erro); else { toast.success("Responsável salvo."); roteador.refresh(); }
    })} cancelar={() => { setAtivo(pessoa.ativo); setNome(pessoa.nome); }} />
  </div>;
}
export function ResponsaveisConfiguracao({ dados }: { dados: ConfiguracaoResponsaveis }) {
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();
  const roteador = useRouter();
  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>Usuários como responsáveis</CardTitle><CardDescription>Escolha quem pode aparecer na emissão. A opção não altera o acesso do usuário ao sistema.</CardDescription></CardHeader><CardContent className="space-y-2">{dados.usuarios.map(pessoa => <LinhaResponsavel key={`${pessoa.id}-${pessoa.ativo}`} pessoa={pessoa} usuario />)}{!dados.usuarios.length && <p className="text-sm text-muted-foreground">Nenhum usuário ativo.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Responsáveis sem conta</CardTitle><CardDescription>Cadastre pessoas da operação sem criar um acesso ao sistema.</CardDescription></CardHeader><CardContent className="space-y-3">
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={e => { e.preventDefault(); iniciar(async () => { const r = await salvarResponsavelEtiquetaAction({ nome, ativo: true }); if ("erro" in r) toast.error(r.erro); else { setNome(""); roteador.refresh(); toast.success("Responsável cadastrado."); } }); }}><div className="min-w-0 flex-1 space-y-1"><Label htmlFor="novo-responsavel">Nome do responsável</Label><Input id="novo-responsavel" value={nome} maxLength={120} disabled={pendente} onChange={e => setNome(e.target.value.replace(/[\u0000-\u001f\u007f]/g, ""))} /></div><Button type="submit" disabled={pendente || !nome.trim()}>Cadastrar responsável</Button></form>
      {dados.cadastros.map(pessoa => <LinhaResponsavel key={`${pessoa.id}-${pessoa.nome}-${pessoa.ativo}`} pessoa={pessoa} usuario={false} />)}
      {!dados.cadastros.length && <p className="text-sm text-muted-foreground">Nenhum responsável sem conta cadastrado.</p>}
    </CardContent></Card>
  </div>;
}
