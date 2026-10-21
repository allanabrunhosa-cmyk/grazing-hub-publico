
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { consultarPerdas } from "@/lib/estoque/consultar-perdas";
import { Button } from "@/components/ui/button";
import { PerdaDialog } from "@/app/(protegido)/inventario/perdas/perda-dialog";
import { PerdasTable } from "@/app/(protegido)/inventario/perdas/perdas-table";
import type { InsumoOption, LocalOption } from "@/app/(protegido)/inventario/types";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { CategoriasPerdaDialog } from "./categorias-dialog";

export default async function PerdasPage() {
  const sessao = await exigirPermissao("inventario.perdas");
  const podeCadastrarInsumo = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "insumos", "adicionar");
  const consulta = await consultarPerdas();
  if ("erro" in consulta) return <p role="alert">{consulta.erro}</p>;
  const [insumos, locais, categorias] = await Promise.all([
    prisma.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, especificacao: true, unidade: true, custoMedio: true },
    }),
    prisma.localEstoque.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.categoriaPerda.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, ativo: true, codigoLegado: true, _count: { select: { perdas: true } } } }),
  ]);

  const insumosOptions: InsumoOption[] = insumos.map((i) => ({ ...i, custoMedio: Number(i.custoMedio) }));
  const locaisOptions: LocalOption[] = locais;
  const categoriasOptions = categorias.map(({ _count, ...categoria }) => ({ ...categoria, usada: _count.perdas > 0 }));
  const podeGerenciarCategorias = sessao.admin || ["adicionar", "editar", "excluir"].some(acao => permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario.perdas.categorias", acao as "adicionar" | "editar" | "excluir"));

  return (
    <PerdasTable linhas={consulta.linhas} historico={consulta.historico} responsavelNome={consulta.usuario.nome} acaoRegistrar={<div className="flex flex-wrap items-center gap-2">
      {podeGerenciarCategorias && <CategoriasPerdaDialog categorias={categoriasOptions} />}
        <PerdaDialog
          insumos={insumosOptions}
          locais={locaisOptions}
          responsavelNome={consulta.usuario.nome}
          podeCadastrarInsumo={podeCadastrarInsumo}
          categorias={categoriasOptions.filter(categoria => categoria.ativo)}
          trigger={
            <Button size="sm" className="h-10! gap-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700">
              <TriangleAlert className="hidden size-4 sm:block" />
              Registrar perda
            </Button>
          }
        />
    </div>} />
  );
}
