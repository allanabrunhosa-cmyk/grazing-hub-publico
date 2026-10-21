
import { exigirPermissao } from "@/lib/permissoes/servidor";
import Link from "next/link";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Plus, ListFilter, FileUp } from "lucide-react";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { categoriasComCaminho, caminhoCategoria, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { InsumoDialog } from "@/app/(protegido)/insumos/insumo-dialog";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { CategoriasDialog } from "@/app/(protegido)/insumos/categorias-dialog";
import { ImportInsumosDialog } from "@/app/(protegido)/insumos/import-insumos-dialog";
import { ExportInsumosButton } from "@/app/(protegido)/insumos/export-insumos-button";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { calcularCustosPreparacoes } from "@/lib/insumos/custo-preparacao";
import { lerPorcaoComposicao } from "@/lib/insumos/porcoes";
import { fornecedoresDoInsumo } from "@/lib/insumos/fornecedores";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";

export default async function InsumosPage({ searchParams }: { searchParams?: Promise<{ entidade?: string | string[] }> }) {
  const sessao = await exigirPermissao("insumos");
  const entidadeId = entidadeInicial((await searchParams)?.entidade);
  const podeCadastrarFornecedor = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "fornecedores", "adicionar");
  const podeCadastrarInsumo = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "insumos", "adicionar");
  const [insumosRaw, categorias, centrosCusto, fornecedores, categoriasFinanceirasRaw] = await Promise.all([
    prisma.insumo.findMany({
      where: { excluidoEm: null },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        especificacao: true,
        tipo: true,
        unidade: true,
        conversoes: { select: { unidade: true, fator: true }, orderBy: { unidade: "asc" } },
        marca: true,
        marcasHomologadas: true,
        codigoEan: true,
        fotoMimeType: true,
        perecivel: true,
        validadePadraoDias: true,
        estoqueMinimo: true,
        estoqueMaximo: true,
        custoMedio: true,
        fornecedorPrincipalId: true,
        tipoEstoque: true,
        observacoes: true,
        rendimentoQuantidade: true,
        rendimentoUnidade: true,
        modoPreparo: true,
        tempoPreparoMinutos: true,
        etiquetaHabilitada: true,
        validadeSecoDias: true,
        validadeRefrigeradoDias: true,
        validadeCongeladoDias: true,
        validadeAposAbertoDias: true,
        conservacaoEtiquetaPadrao: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
        categoriaFinanceiraId: true,
        categoriaFinanceira: { select: { ...SELECAO_CATEGORIA_COM_CAMINHO, ativo: true, excluidoEm: true } },
        categoria: { select: { id: true, nome: true } },
        centroCusto: { select: { id: true, nome: true } },
        fornecedorPrincipal: { select: { id: true, nome: true } },
        fornecedoresHomologados: { select: { fornecedor: { select: { id: true, nome: true } } } },
        componentes: {
          select: {
            quantidade: true,
            observacaoPorcao: true,
            porcao: true,
            componente: { select: { id: true, nome: true, especificacao: true, categoria: { select: { nome: true } }, tipo: true, unidade: true } },
          },
        },
      },
    }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.centroCusto.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.fornecedor.findMany({
      where: { ativo: true, tipoCadastro: "FORNECEDOR" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: { notIn: GRUPOS_RECEITA } }, orderBy: { nome: "asc" }, select: SELECAO_CATEGORIA_COM_CAMINHO }),
  ]);

  const insumosBase = insumosRaw.map((i) => ({
    ...i,
    categoriaFinanceira: i.categoriaFinanceira ? { ...i.categoriaFinanceira, nome: caminhoCategoria(i.categoriaFinanceira) } : null,
    conversoes: i.conversoes.map((conversao) => ({ ...conversao, fator: Number(conversao.fator) })),
    estoqueMinimo: Number(i.estoqueMinimo),
    estoqueMaximo: i.estoqueMaximo ? Number(i.estoqueMaximo) : null,
    custoMedio: Number(i.custoMedio),
    rendimentoQuantidade: i.rendimentoQuantidade ? Number(i.rendimentoQuantidade) : null,
    modoPreparo: Array.isArray(i.modoPreparo) ? i.modoPreparo.filter((passo): passo is string => typeof passo === "string") : [],
    temFoto: i.fotoMimeType != null,
    fornecedoresHomologados: fornecedoresDoInsumo({ ...i, fornecedoresHomologados: i.fornecedoresHomologados.map(fh => fh.fornecedor) }),
    componentes: i.componentes.map((c) => ({
      componenteId: c.componente.id,
      nome: c.componente.nome,
      especificacao: c.componente.especificacao,
      categoriaNome: c.componente.categoria?.nome ?? null,
      tipo: c.componente.tipo,
      unidade: c.componente.unidade,
      quantidade: Number(c.quantidade),
      observacaoPorcao: c.observacaoPorcao,
      porcao: lerPorcaoComposicao(c.porcao, c.quantidade.toFixed(), c.componente.unidade),
    })),
  }));

  const custosPreparacoes = calcularCustosPreparacoes(insumosBase.map((i) => ({
    id: i.id,
    tipo: i.tipo,
    unidade: i.unidade,
    custoMedio: i.custoMedio,
    rendimentoQuantidade: i.rendimentoQuantidade,
    rendimentoUnidade: i.rendimentoUnidade,
    conversoes: i.conversoes,
    componentes: i.componentes,
  })));
  const insumos = insumosBase.map((i) => {
    const custo = custosPreparacoes.get(i.id);
    return {
      ...i,
      custoUnitarioPreparacao: custo && "unitario" in custo ? custo.unitario : null,
      motivoCustoPreparacao: custo && "motivo" in custo ? custo.motivo : null,
    };
  });
  const entidadeInicialId = insumos.some(i => i.id === entidadeId) ? entidadeId : undefined;

  const podeConsultarCustos = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "financeiro.custos", "visualizar");
  if (!podeConsultarCustos) for (const i of insumos) { delete (i as { custoMedio?: number }).custoMedio; i.custoUnitarioPreparacao = null; i.motivoCustoPreparacao = "Custo indisponível para seu acesso."; }
  const todosInsumos = insumos.map((i) => ({ id: i.id, nome: i.nome, especificacao: i.especificacao, tipo: i.tipo, unidade: i.unidade, custoMedio: i.custoMedio, custoUnitario: i.tipo === "INSUMO" ? i.custoMedio : i.custoUnitarioPreparacao }));

  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Insumos" descricao="Gerencie insumos, produtos e receitas da rede inteira.">
          {(sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario", "visualizar")) && <Button variant="outline" render={<Link href="/inventario/producao" />}>Produção de preparações</Button>}
          <CategoriasDialog
            categorias={categorias}
            trigger={
              <Button variant="outline">
                <ListFilter className="size-4" />
                Categorias
              </Button>
            }
          />
          <ImportInsumosDialog
            trigger={
              <Button variant="outline">
                <FileUp className="size-4" />
                Importar CSV
              </Button>
            }
          />
          <ExportInsumosButton insumos={insumos} />
          <InsumoDialog
            categorias={categorias}
            categoriasFinanceiras={categoriasComCaminho(categoriasFinanceirasRaw)}
            centrosCusto={centrosCusto}
            fornecedores={fornecedores}
            todosInsumos={todosInsumos}
            podeCadastrarFornecedor={podeCadastrarFornecedor}
            podeCadastrarInsumo={podeCadastrarInsumo}
            podeConfigurarEtiqueta={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "producao.validades", "editar")}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo
              </Button>
            }
          />
      </BarraAcoes>

      <InsumosTable
        key={entidadeInicialId ?? "lista"}
        entidadeInicialId={entidadeInicialId}
        insumos={insumos}
        categorias={categorias}
        categoriasFinanceiras={categoriasComCaminho(categoriasFinanceirasRaw)}
        centrosCusto={centrosCusto}
        fornecedores={fornecedores}
        todosInsumos={todosInsumos}
        podeCadastrarFornecedor={podeCadastrarFornecedor}
        podeCadastrarInsumo={podeCadastrarInsumo}
        podeConfigurarEtiqueta={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "producao.validades", "editar")}
      />
    </div>
  );
}
