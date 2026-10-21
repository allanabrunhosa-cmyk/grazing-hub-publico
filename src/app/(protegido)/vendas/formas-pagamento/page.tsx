import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import type { FaixaTaxaVenda, FormaPagamentoVendaEntrada, TipoFormaPagamentoVenda } from "@/lib/vendas/formas-pagamento";
import { FormasPagamentoVenda } from "./formas-pagamento-client";

export default async function FormasPagamentoPage() {
  await exigirPermissao("vendas.formas-pagamento");
  const [registros, adicionar, editar] = await Promise.all([
    prisma.formaPagamentoVenda.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    podeAcessar("vendas.formas-pagamento", "adicionar"),
    podeAcessar("vendas.formas-pagamento", "editar"),
  ]);
  const formas: FormaPagamentoVendaEntrada[] = registros.map(registro => ({
    id: registro.id, versao: registro.versao, nome: registro.nome, tipo: registro.tipo as TipoFormaPagamentoVenda,
    taxaPercentual: registro.taxaPercentual.toString(), taxaFixa: registro.taxaFixa.toString(),
    prazoDias: registro.prazoDias, inicioPrazo: registro.inicioPrazo as "VENDA" | "PAGAMENTO",
    contagemPrazo: registro.contagemPrazo as "CORRIDOS" | "UTEIS", vencimentoFlexivel: registro.vencimentoFlexivel,
    permiteParcelamento: registro.permiteParcelamento, maximoParcelas: registro.maximoParcelas,
    faixasTaxa: registro.faixasTaxa as FaixaTaxaVenda[], observacoes: registro.observacoes, ativo: registro.ativo,
  }));
  return <FormasPagamentoVenda formas={formas} adicionar={adicionar} editar={editar} />;
}
