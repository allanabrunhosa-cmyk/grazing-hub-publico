
import { BarraAcoes } from "@/components/padroes-operacionais";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { categoriasComCaminho, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { prisma } from "@/lib/prisma";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { projetarRelatorioFaturas } from "@/lib/financeiro/faturas/relatorios";
import { AvisoFaturas } from "../cartoes/aviso";
import { carregarFonteFluxo } from "@/lib/financeiro/fontes-relatorios";

export default async function FluxoDeCaixaPage() {
  await exigirPermissao("financeiro.fluxo");
  const [contas, lancamentos, categorias, fornecedores, formasPagamento, contasBancarias] = await Promise.all([
    prisma.contaBancaria.findMany({ select: { id: true, saldoInicial: true, dataSaldoInicial: true } }),
    carregarFonteFluxo(),
    prisma.categoriaFinanceira.findMany({ where: { excluidoEm: null }, orderBy: { nome: "asc" }, select: { ...SELECAO_CATEGORIA_COM_CAMINHO, ativo: true, paiId: true } }),
    prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.formaPagamento.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.contaBancaria.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const saldoInicialTotal = contas.reduce((soma, c) => soma + Number(c.saldoInicial), 0);

  const linhas = lancamentos;

  const projecao = await projetarRelatorioFaturas(linhas);
  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Fluxo de Caixa" descricao="Categorias nas linhas, dias ou meses nas colunas" />
      <AvisoFaturas />
      <FluxoCaixaView
        saldosIniciais={contas.map((c) => ({ id: c.id, saldoInicial: Number(c.saldoInicial), dataSaldoInicial: c.dataSaldoInicial?.toISOString().slice(0, 10) ?? null }))}
        saldoInicialTotal={saldoInicialTotal}
        lancamentos={projecao.linhas}
        categorias={categoriasComCaminho(categorias.filter(c => c.ativo))}
        planoContas={categoriasComCaminho(categorias)}
        fornecedores={fornecedores}
        formasPagamento={formasPagamento}
        contasBancarias={contasBancarias}
      />
    </div>
  );
}
