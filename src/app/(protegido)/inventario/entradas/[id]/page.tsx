import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { prisma } from "@/lib/prisma";
import { consultarEntrada } from "@/lib/estoque/entrada-avulsa-servidor";
import { identificadorEntradaNaRota } from "@/lib/inventario/entrada-avulsa-historico";
import { EntradaAvulsaDetalhe } from "../entrada-avulsa-detalhe";
export default async function EntradaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirPermissao("inventario");
  const podeEditarPagamento = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "financeiro.movimentacoes", "editar");
  const id = identificadorEntradaNaRota((await params).id);
  if (!id) notFound();
  const detalhe = await prisma.$transaction(tx => consultarEntrada(tx, id), { isolationLevel: "RepeatableRead" });
  if (!detalhe) notFound();
  const [insumos, locais, cartoes] = await Promise.all([
    prisma.insumo.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, unidade: true }, orderBy: { nome: "asc" } }),
    prisma.localEstoque.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    podeEditarPagamento ? prisma.cartaoCredito.findMany({
      where: { OR: [{ ativo: true, contaBancaria: { ativo: true } }, { id: detalhe.financeiro?.pagamento.cartaoCreditoId ?? "" }] },
      select: { id: true, nome: true, contaBancariaId: true, contaBancaria: { select: { nome: true } }, diaFechamento: true, diaVencimento: true, ativo: true },
      orderBy: { nome: "asc" },
    }) : [],
  ]);
  const cartoesOptions = cartoes.map(cartao => ({ id: cartao.id, nome: cartao.nome, contaBancariaId: cartao.contaBancariaId, contaBancariaNome: cartao.contaBancaria.nome, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento, ativo: cartao.ativo }));
  return <EntradaAvulsaDetalhe detalhe={detalhe} insumos={insumos} locais={locais} cartoes={cartoesOptions} podeEditarPagamento={podeEditarPagamento} podeEditar={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario", "editar")} />;
}
