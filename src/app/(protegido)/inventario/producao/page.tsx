import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { ProducaoPreparacoes } from "./producao-client";
export default async function ProducaoPreparacaoPage() {
  const sessao = await exigirPermissao("inventario");
  const [preparacoes, locais, registros, editar] = await Promise.all([
    prisma.insumo.findMany({ where: { ativo: true, tipo: "PRODUTO_INTERMEDIARIO" }, include: { componentes: { include: { componente: { select: { nome: true, unidade: true } } } } }, orderBy: { nome: "asc" } }),
    prisma.localEstoque.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.producaoPreparacao.findMany({ take: 50, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { preparacao: { select: { nome: true } }, local: { select: { nome: true } }, criadoPor: { select: { nome: true } } } }),
    podeAcessar("inventario", "editar"),
  ]);
  return <ProducaoPreparacoes editar={editar} admin={sessao.admin} locais={locais} preparacoes={preparacoes.map(p => ({ id: p.id, nome: p.nome, unidade: p.unidade, revisao: p.updatedAt.toISOString(), ingredientes: p.componentes.map(c => ({ id: c.componenteId, nome: c.componente.nome, unidade: c.componente.unidade })) }))} registros={registros.map(r => {
    const snapshot = r.snapshot as { preparacao: { unidade: string }; ingredientes: { nome: string; unidade: string; quantidadeConsumida: string }[] };
    return { id: r.id, nome: r.preparacao.nome, local: r.local.nome, autor: r.criadoPor.nome, data: r.data.toISOString(), quantidade: r.quantidade.toString(), unidade: snapshot.preparacao.unidade, motivo: r.motivo, corrigido: !!r.corrigidoEm, ingredientes: snapshot.ingredientes };
  })} />;
}
