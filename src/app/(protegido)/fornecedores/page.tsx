
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Plus, FileUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { ImportFornecedoresDialog } from "@/app/(protegido)/fornecedores/import-fornecedores-dialog";
import { ExportFornecedoresButton } from "@/app/(protegido)/fornecedores/export-fornecedores-button";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";

export default async function FornecedoresPage({ searchParams }: { searchParams?: Promise<{ entidade?: string | string[] }> }) {
  await exigirPermissao("fornecedores");
  const entidadeId = entidadeInicial((await searchParams)?.entidade);
  const adicionar = await podeAcessar("fornecedores", "adicionar");
  const [cadastros, canaisPedidoOptions, formasPagamentoOptions] = await Promise.all([
    prisma.fornecedor.findMany({
      orderBy: { nome: "asc" },
      include: {
        canaisPedido: { select: { id: true, nome: true } },
        formasPagamento: { select: { id: true, nome: true } },
        insumosPrincipais: {
          where: { ativo: true },
          select: { id: true, nome: true, especificacao: true },
        },
        insumosHomologados: {
          where: { insumo: { ativo: true } },
          select: { insumo: { select: { id: true, nome: true, especificacao: true } } },
        },
      },
    }),
    prisma.canalPedido.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.formaPagamento.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const fornecedores = cadastros.map(({ insumosPrincipais, insumosHomologados, ...fornecedor }) => {
    const insumosVinculados = [...new Map([
      ...insumosPrincipais,
      ...insumosHomologados.map((vinculo) => vinculo.insumo),
    ].map((insumo) => [insumo.id, insumo])).values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { ...fornecedor, insumosVinculados, quantidadeInsumos: insumosVinculados.length };
  });
  const fornecedoresRegulares = fornecedores.filter((fornecedor) => fornecedor.tipoCadastro === "FORNECEDOR");
  const entidadeInicialId = fornecedores.some(f => f.id === entidadeId) ? entidadeId : undefined;

  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Fornecedores e Beneficiários" descricao="Cadastros para compras, insumos e lançamentos financeiros">
          {adicionar && <ImportFornecedoresDialog
            trigger={
              <Button variant="outline">
                <FileUp className="size-4" />
                Importar CSV
              </Button>
            }
          />}
          <ExportFornecedoresButton fornecedores={fornecedoresRegulares} />
          {adicionar && <FornecedorDialog
            canaisPedidoOptions={canaisPedidoOptions}
            formasPagamentoOptions={formasPagamentoOptions}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo
              </Button>
            }
          />}
      </BarraAcoes>

      <FornecedoresTable
        key={entidadeInicialId ?? "lista"}
        entidadeInicialId={entidadeInicialId}
        fornecedores={fornecedores}
        canaisPedidoOptions={canaisPedidoOptions}
        formasPagamentoOptions={formasPagamentoOptions}
      />
    </div>
  );
}
