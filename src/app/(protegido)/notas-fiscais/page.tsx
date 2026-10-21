
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { categoriasComCaminho, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { prisma } from "@/lib/prisma";
import { NotasFiscaisTable } from "@/app/(protegido)/notas-fiscais/notas-fiscais-table";
import { SincronizarButton } from "@/app/(protegido)/notas-fiscais/sincronizar-button";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { ImportarChaveDialog } from "./importar-chave-dialog";
import { ImportarXmlDialog } from "./importar-xml-dialog";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { BarraAcoes } from "@/components/padroes-operacionais";

export default async function NotasFiscaisPage() {
  const sessao = await exigirPermissao("notas");
  const pode = (recurso: string) => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "adicionar");
  const ultimaBusca = await prisma.sefazDistribuicaoEstado.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      cnpj: true,
      ultimaExecucaoEm: true,
      resultadoExecucao: true,
      proximaBuscaEm: true,
      ultimoCStat: true,
      emConsulta: true,
    },
  });
  const lacunas = ultimaBusca ? await prisma.sefazLacuna.findMany({ where: { cnpj: ultimaBusca.cnpj, concluidaEm: null }, select: { proximo: true, fim: true } }) : [];
  const documentosPendentes = lacunas.reduce((total, lacuna) => total + BigInt(lacuna.fim) - BigInt(lacuna.proximo) + BigInt(1), BigInt(0));
  const [notasRaw, locais, insumos, categoriasInsumo, centrosCustoInsumo, fornecedoresInsumo, todosInsumosCadastro, categoriasFinanceiras] =
    await Promise.all([
      prisma.notaFiscalRecebida.findMany({
        orderBy: { dataEmissao: "desc" },
        include: {
          manifestacoes: { orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.localEstoque.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.insumo.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, especificacao: true, unidade: true, custoMedio: true },
      }),
      prisma.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.centroCusto.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.fornecedor.findMany({ where: { ativo: true, tipoCadastro: "FORNECEDOR" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.insumo.findMany({ where: { excluidoEm: null }, orderBy: { nome: "asc" }, select: { id: true, nome: true, especificacao: true, tipo: true, unidade: true } }),
      prisma.categoriaFinanceira.findMany({
        where: { ativo: true, excluidoEm: null, grupo: { notIn: GRUPOS_RECEITA } },
        orderBy: { nome: "asc" },
        select: SELECAO_CATEGORIA_COM_CAMINHO,
      }),
    ]);

  const notas = notasRaw.map(({ xml, ...nota }) => ({
    ...nota,
    valorTotal: nota.valorTotal ? Number(nota.valorTotal) : null,
    dataEmissao: nota.dataEmissao ? nota.dataEmissao.toISOString() : null,
    createdAt: nota.createdAt.toISOString(),
    temXmlCompleto: xml != null,
    manifestacoes: nota.manifestacoes.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  }));

  const insumosOptions = insumos.map((i) => ({ ...i, custoMedio: Number(i.custoMedio) }));

  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Manifesto de Notas" descricao="Notas recebidas da SEFAZ e controle de manifestação">
        <ImportarChaveDialog /><ImportarXmlDialog /><SincronizarButton />
      </BarraAcoes>

      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
        <p>Busca diária às 03h15 (Brasília). Buscas solicitadas e recuperação de documentos continuam no servidor, respeitando os intervalos da SEFAZ.</p>
        {ultimaBusca?.emConsulta && <p className="mt-1 font-medium text-foreground">Busca em andamento. Atualize a página para acompanhar.</p>}
        {ultimaBusca?.proximaBuscaEm && <p className="mt-1">Próxima tentativa a partir de {ultimaBusca.proximaBuscaEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}, na verificação da fila a cada cinco minutos.</p>}
        {ultimaBusca?.ultimaExecucaoEm && (
          <p className="mt-1">
            Última execução: {ultimaBusca.ultimaExecucaoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.{" "}
            {ultimaBusca.ultimoCStat === "656"
              ? "A SEFAZ pediu o intervalo compartilhado de uma hora. O novo cursor foi registrado e a sequência pendente será recuperada automaticamente."
              : ultimaBusca.resultadoExecucao}
          </p>
        )}
        <p className="mt-1">{notasRaw.filter(nota => !nota.xml).length} nota(s) aguardando XML completo. {documentosPendentes.toString()} documento(s) com sequência pendente de recuperação.</p>
      </div>

      <NotasFiscaisTable
        notas={notas}
        locais={locais}
        insumos={insumosOptions}
        categoriasInsumo={categoriasInsumo}
        centrosCustoInsumo={centrosCustoInsumo}
        fornecedoresInsumo={fornecedoresInsumo}
        todosInsumosCadastro={todosInsumosCadastro}
        categoriasFinanceiras={categoriasComCaminho(categoriasFinanceiras)}
        podeCadastrarFornecedor={pode("fornecedores")}
        podeCadastrarInsumo={pode("insumos")}
      />
    </div>
  );
}
