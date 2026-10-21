import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tipoMovimentacaoEstoqueLabels } from "@/lib/labels";

// Detalhe somente leitura das fontes que ainda não possuem uma URL individual.
export default async function OrigemMovimentacaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao("insumos");
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) notFound();
  const referencia = await prisma.movimentacaoEstoque.findUnique({ where: { id }, select: { insumoId: true, producaoPreparacaoId: true, origemPerdaId: true, exclusaoPerda: { select: { perdaId: true } }, notaFiscalItem: { select: { notaFiscalId: true } } } });
  if (!referencia) notFound();
  await exigirPermissao(referencia.notaFiscalItem ? "notas" : referencia.origemPerdaId || referencia.exclusaoPerda ? "inventario.perdas" : "inventario");
  let titulo = "Movimentação de estoque", identificador = id, descricao = "";
  let itens: { nome: string; quantidade: string; unidade: string; local: string }[] = [];
  const m = await prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id }, include: { insumo: true, local: true, criadoPor: true, estornoDe: true } });
  if (referencia.producaoPreparacaoId) {
    const p = await prisma.producaoPreparacao.findUniqueOrThrow({ where: { id: referencia.producaoPreparacaoId }, include: { preparacao: true, criadoPor: true, local: true, movimentos: { include: { insumo: true, local: true } } } });
    titulo = "Produção de preparação"; identificador = p.id; descricao = `${p.preparacao.nome} · ${p.quantidade} ${p.preparacao.unidade} · ${p.criadoPor.nome} · ${p.motivo}`;
    itens = p.movimentos.map(i => ({ nome: `${i.insumo.nome} · ${tipoMovimentacaoEstoqueLabels[i.tipo]}`, quantidade: i.quantidade.toString(), unidade: i.insumo.unidade, local: i.local.nome }));
  } else if (referencia.notaFiscalItem) {
    const nota = await prisma.notaFiscalRecebida.findUniqueOrThrow({ where: { id: referencia.notaFiscalItem.notaFiscalId }, include: { itens: true } });
    titulo = "Nota fiscal de origem"; identificador = nota.id; descricao = `${nota.fornecedorNome ?? "Fornecedor"} · Chave ${nota.chaveAcesso}`;
    itens = nota.itens.map(i => ({ nome: i.descricaoProduto, quantidade: i.quantidadeComercial.toString(), unidade: i.unidadeComercial, local: "Unidade comercial da nota" }));
  } else if (referencia.origemPerdaId || referencia.exclusaoPerda) {
    const perda = await prisma.perda.findUniqueOrThrow({ where: { id: referencia.origemPerdaId ?? referencia.exclusaoPerda!.perdaId }, include: { insumo: true, local: true, responsavel: true, categoriaPerda: true } });
    titulo = referencia.exclusaoPerda ? "Perda de origem do estorno" : "Perda de origem"; identificador = perda.id;
    descricao = `${perda.categoriaPerda?.nome ?? perda.motivoPersonalizado ?? perda.motivo} · ${perda.responsavel?.nome ?? "Responsável não registrado"} · ${perda.observacao ?? ""}`;
    itens = [{ nome: perda.insumo.nome, quantidade: perda.quantidade.toString(), unidade: perda.unidade, local: perda.local.nome }];
  } else {
    descricao = m.estornoDe ? `Estorno do movimento ${m.estornoDe.id}` : m.observacao ?? "Sem observação.";
    itens = [{ nome: m.insumo.nome, quantidade: m.quantidade.toString(), unidade: m.insumo.unidade, local: m.local.nome }];
  }
  return <div className="space-y-5"><BarraAcoes titulo={titulo} descricao={identificador}><Button variant="outline" nativeButton={false} render={<Link href={`/insumos?entidade=${referencia.insumoId}`} />}>Voltar ao item</Button></BarraAcoes><Card><CardContent className="space-y-4 pt-5"><p className="text-sm whitespace-pre-wrap">{descricao}</p><p className="text-sm text-muted-foreground">Movimento {m.id} · {new Date(m.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {m.criadoPor?.nome ?? "Responsável não registrado"}</p><Table><TableHeader><TableRow><TableHead>Produto / tipo</TableHead><TableHead>Quantidade</TableHead><TableHead>Unidade</TableHead><TableHead>Local / referência</TableHead></TableRow></TableHeader><TableBody>{itens.map((i, n) => <TableRow key={n}><TableCell className="whitespace-normal">{i.nome}</TableCell><TableCell>{i.quantidade}</TableCell><TableCell>{i.unidade}</TableCell><TableCell>{i.local}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div>;
}
