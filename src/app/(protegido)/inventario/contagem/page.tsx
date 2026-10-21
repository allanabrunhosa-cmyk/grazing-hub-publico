
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { NovaContagemDialog } from "@/app/(protegido)/inventario/contagem/nova-contagem-dialog";
import { ContagemTable } from "@/app/(protegido)/inventario/contagem/contagem-table";
import type { CategoriaOption, ContagemListRow, InsumoParaContagemOption, LocalOption } from "@/app/(protegido)/inventario/types";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";

export default async function ContagemPage() {
  const sessao = await exigirPermissao("inventario.contagem");
  const podeCadastrarInsumo = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "insumos", "adicionar");
  const [contagens, locais, insumos, categorias] = await Promise.all([
    prisma.inventarioContagem.findMany({
      orderBy: { dataContagem: "desc" },
      include: {
        local: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        itens: { select: { ajustado: true, contado: true } },
      },
    }),
    prisma.localEstoque.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.insumo.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, especificacao: true, categoriaId: true } }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const linhas: ContagemListRow[] = contagens.map((c) => ({
    id: c.id,
    localNome: c.local.nome,
    dataContagem: c.dataContagem.toISOString(),
    status: c.status,
    responsavelNome: c.responsavel?.nome ?? null,
    totalItens: c.itens.length,
    itensContados: c.itens.filter((item) => item.contado).length,
    itensAjustados: c.itens.filter((i) => i.ajustado).length,
  }));

  const locaisOptions: LocalOption[] = locais;
  const insumosOptions: InsumoParaContagemOption[] = insumos.map((insumo) => ({ ...insumo, descricao: insumo.especificacao }));
  const categoriasOptions: CategoriaOption[] = categorias;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NovaContagemDialog locais={locaisOptions} insumos={insumosOptions} categorias={categoriasOptions} podeCadastrarInsumo={podeCadastrarInsumo} />
      </div>
      <ContagemTable linhas={linhas} administrador={sessao.admin} />
    </div>
  );
}
