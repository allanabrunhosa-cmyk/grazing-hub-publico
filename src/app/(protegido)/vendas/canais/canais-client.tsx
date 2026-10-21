"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";
import { salvarCanalVendaAction } from "./actions";

type Canal = { id: string; nome: string; versao: number; categoriaDevolucaoId?: string | null; categoriaReceitaId: string | null; categoriaReceita: { nome: string } | null };
export function CanaisVenda({ canais, categorias, editar, deducoes = [] }: { deducoes?: CategoriaOption[]; canais: Canal[]; categorias: CategoriaOption[]; editar: boolean }) {
  const [selecionado, setSelecionado] = useState<Canal | "novo" | null>(null);
  return <div className="space-y-5">
    <BarraAcoes titulo="Canais de venda" descricao="Identifique a origem das vendas e defina a categoria de receita usada nos novos pedidos de cada canal. Pedidos anteriores conservam sua classificação.">{editar && <Button onClick={() => setSelecionado("novo")}><Plus />Novo canal de venda</Button>}</BarraAcoes>
    <Card><CardContent><Table><TableHeader><TableRow><TableHead>Canal</TableHead><TableHead>Categoria de receita</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
      {canais.map(c => <TableRow key={c.id}><TableCell>{c.nome}</TableCell><TableCell>{c.categoriaReceita?.nome ?? "Categoria não configurada"}</TableCell><TableCell>{editar && <GrupoAcoes alinhamento="inicio"><Button variant="editar" aria-label={`Editar canal ${c.nome}`} onClick={() => setSelecionado(c)} /></GrupoAcoes>}</TableCell></TableRow>)}
      {!canais.length && <TableRow><TableCell colSpan={3}>Nenhum canal cadastrado.</TableCell></TableRow>}
    </TableBody></Table></CardContent></Card>
    {selecionado && <EditorCanal deducoes={deducoes} inicial={selecionado === "novo" ? null : selecionado} categorias={categorias} fechar={() => setSelecionado(null)} />}
  </div>;
}
function EditorCanal({ inicial, categorias, fechar, deducoes }: { deducoes: CategoriaOption[]; inicial: Canal | null; categorias: CategoriaOption[]; fechar: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [categoriaReceitaId, setCategoria] = useState(inicial?.categoriaReceitaId ?? "");
  const [categoriaDevolucaoId, setDevolucao] = useState(inicial?.categoriaDevolucaoId ?? "");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const alterado = categoriaDevolucaoId !== (inicial?.categoriaDevolucaoId ?? "") || nome !== (inicial?.nome ?? "") || categoriaReceitaId !== (inicial?.categoriaReceitaId ?? "");
  async function salvar() {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro("");
    const dados = { id: inicial?.id, versao: inicial?.versao, nome, categoriaReceitaId, categoriaDevolucaoId };
    const assinatura = JSON.stringify(dados);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    try {
      const r = await salvarCanalVendaAction({ ...dados, chave: tentativa.current.chave });
      if ("erro" in r) setErro(r.erro ?? "Não foi possível salvar."); else { fechar(); router.refresh(); }
    } catch { setErro("Resultado não confirmado. Seu preenchimento foi mantido; confira antes de repetir."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <Dialog open alterado={alterado} protegerAlteracoes={!ocupado} onOpenChange={aberto => { if (!aberto && !ocupado) fechar(); }}><DialogContent>
    <DialogHeader><DialogTitle>{inicial ? "Editar canal" : "Novo canal de venda"}</DialogTitle><DialogDescription>A categoria será usada na receita dos novos pedidos do canal. Salvar não reclassifica pedidos existentes.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <fieldset disabled={ocupado} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="canal-nome">Nome do canal</Label><Input id="canal-nome" value={nome} required maxLength={60} onChange={e => setNome(e.target.value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 60))} /></div>
        <div className="space-y-2"><Label>Categoria de receita</Label><CategoriaFinanceiraCombobox categorias={categorias} value={categoriaReceitaId} onChange={setCategoria} ariaLabel="Categoria de receita do canal" disabled={ocupado} /></div>
        <div className="space-y-2"><Label>Categoria de devoluções</Label><CategoriaFinanceiraCombobox categorias={deducoes} value={categoriaDevolucaoId} onChange={setDevolucao} ariaLabel="Categoria de devoluções do canal" disabled={ocupado} /><p className="text-xs text-muted-foreground">Usada ao concluir devoluções comprovadas. Não altera lançamentos anteriores.</p></div>
        {inicial?.categoriaReceitaId && !categorias.some(c => c.id === inicial.categoriaReceitaId) && <p role="status" className="text-sm text-muted-foreground">Categoria anterior: {inicial.categoriaReceita?.nome}. Selecione uma categoria ativa para salvar.</p>}
        {!categorias.length && <p role="status" className="text-sm text-muted-foreground">Cadastre uma categoria de receita bruta no Plano de contas.</p>}
      </fieldset>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <GrupoAcoes><DialogClose render={<Button type="button" variant="outline" disabled={ocupado} />}>Cancelar</DialogClose><Button type="submit" disabled={ocupado || !nome.trim() || !categoriaReceitaId}>{ocupado ? "Salvando…" : "Salvar"}</Button></GrupoAcoes>
    </form>
  </DialogContent></Dialog>;
}
