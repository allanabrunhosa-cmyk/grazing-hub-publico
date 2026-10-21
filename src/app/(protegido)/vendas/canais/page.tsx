import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { CanaisVenda } from "./canais-client";
import { categoriasComCaminho, caminhoCategoria, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";

export default async function CanaisPage() {
  await exigirPermissao("vendas.produtos");
  const [canais, categorias, editar, deducoes] = await Promise.all([
    prisma.canalVenda.findMany({ select: { id: true, nome: true, versao: true, categoriaDevolucaoId: true, categoriaReceitaId: true, categoriaReceita: { select: SELECAO_CATEGORIA_COM_CAMINHO } }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: "RECEITA_BRUTA" }, select: SELECAO_CATEGORIA_COM_CAMINHO, orderBy: { nome: "asc" } }),
    podeAcessar("vendas.produtos", "editar"),
    prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: "DEDUCOES_RECEITA" }, select: SELECAO_CATEGORIA_COM_CAMINHO, orderBy: { nome: "asc" } }),
  ]);
  return <CanaisVenda canais={canais.map(c => ({ ...c, categoriaReceita: c.categoriaReceita ? { nome: caminhoCategoria(c.categoriaReceita) } : null }))} deducoes={categoriasComCaminho(deducoes)} categorias={categoriasComCaminho(categorias)} editar={editar} />;
}
