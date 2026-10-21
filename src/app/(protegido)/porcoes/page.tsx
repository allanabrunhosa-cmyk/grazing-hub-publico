import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva, type Acao } from "@/lib/permissoes/catalogo";
import { prisma } from "@/lib/prisma";
import { PorcoesTable } from "./porcoes-table";
import { medidaPorcao } from "@/lib/insumos/porcoes";

export default async function PorcoesPage() {
  const sessao = await exigirPermissao("suprimentos.porcoes");
  const pode = (acao: Acao) => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "suprimentos.porcoes", acao);
  const [porcoes, insumos, categorias] = await Promise.all([
    prisma.porcaoInsumo.findMany({
      where: { excluidoEm: null, insumo: { excluidoEm: null } },
      orderBy: [{ insumo: { nome: "asc" } }, { nome: "asc" }],
      select: { id: true, insumoId: true, nome: true, quantidade: true, unidade: true, versao: true, quantidadeMedida: true, unidadeMedida: true },
    }),
    prisma.insumo.findMany({
      where: { excluidoEm: null, OR: [{ ativo: true }, { porcoes: { some: { excluidoEm: null } } }] },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, unidade: true, ativo: true, categoriaId: true, categoria: { select: { nome: true } } },
    }),
    prisma.categoria.findMany({ orderBy: [{ ordemPorcoes: "asc" }, { nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, ordemPorcoes: true, versaoOrdemPorcoes: true } }),
  ]);
  return <PorcoesTable
    porcoes={porcoes.map(porcao => ({ ...porcao, quantidade: porcao.quantidade.toFixed(), ...medidaPorcao({ nome: porcao.nome, quantidadeMedida: porcao.quantidadeMedida?.toFixed(), unidadeMedida: porcao.unidadeMedida ?? undefined }) }))}
    insumos={insumos.map(({ categoria, ...insumo }) => ({ ...insumo, categoriaNome: categoria?.nome ?? null }))}
    categorias={categorias.map(c => ({ id: c.id, nome: c.nome, ordem: c.ordemPorcoes, versao: c.versaoOrdemPorcoes }))}
    podeCriar={pode("adicionar")} podeEditar={pode("editar")} podeExcluir={pode("excluir")}
  />;
}
