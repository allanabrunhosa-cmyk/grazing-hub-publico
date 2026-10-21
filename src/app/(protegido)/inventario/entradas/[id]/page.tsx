import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { prisma } from "@/lib/prisma";
import { consultarEntrada } from "@/lib/estoque/entrada-avulsa-servidor";
import { identificadorEntradaNaRota } from "@/lib/inventario/entrada-avulsa-historico";
import { EntradaAvulsaDetalhe } from "../entrada-avulsa-detalhe";
export default async function EntradaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirPermissao("inventario");
  const id = identificadorEntradaNaRota((await params).id);
  if (!id) notFound();
  const detalhe = await prisma.$transaction(tx => consultarEntrada(tx, id), { isolationLevel: "RepeatableRead" });
  if (!detalhe) notFound();
  const [insumos, locais] = await Promise.all([prisma.insumo.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, unidade: true }, orderBy: { nome: "asc" } }), prisma.localEstoque.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } })]);
  return <EntradaAvulsaDetalhe detalhe={detalhe} insumos={insumos} locais={locais} podeEditar={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario", "editar")} />;
}
