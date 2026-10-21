
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { PlanoContasView } from "./plano-contas-view";
import type { CategoriaFinanceiraRow } from "@/app/(protegido)/financeiro/types";

export default async function PlanoDeContasPage() {
  await exigirPermissao("financeiro.plano");
  const [categorias, centrosCusto] = await Promise.all([
    prisma.categoriaFinanceira.findMany({
      orderBy: { nome: "asc" },
      include: {
        centroCusto: { select: { nome: true } },
        _count: { select: { lancamentos: true, itensNotaFiscal: true, itensFaturaCartao: true, regrasCartao: true, subcategorias: { where: { excluidoEm: null } } } },
      },
    }),
    prisma.centroCusto.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const linhas: CategoriaFinanceiraRow[] = categorias.map((c) => ({
    id: c.id,
    paiId: c.paiId,
    nome: c.nome,
    grupo: c.grupo,
    centroCustoId: c.centroCustoId,
    centroCustoNome: c.centroCusto?.nome ?? null,
    ativo: c.ativo,
    excluidoEm: c.excluidoEm?.toISOString() ?? null,
    quantidadeLancamentos: c._count.lancamentos,
    quantidadeItensNota: c._count.itensNotaFiscal,
    quantidadeItensFatura: c._count.itensFaturaCartao,
    quantidadeRegrasCartao: c._count.regrasCartao,
    quantidadeSubcategorias: c._count.subcategorias,
  }));

  return <PlanoContasView categorias={linhas} centrosCusto={centrosCusto} />;
}
