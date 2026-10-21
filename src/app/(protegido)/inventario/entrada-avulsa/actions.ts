"use server";

import { exigirPermissao } from "@/lib/permissoes/servidor";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";
import { paraCaixaAlta } from "@/lib/caixa-alta";
import { prepararPagamento, type PagamentoNota } from "@/lib/notas-fiscais/pagamentos";
import { vencimentoCartao, dataCalendarioValida } from "@/lib/financeiro/cartoes";
import { prepararRegistroEntrada, gravarRegistroEntrada } from "@/lib/estoque/entrada-avulsa-servidor";
import { validarItensEntrada, ErroCorrecaoEntrada } from "@/lib/inventario/entrada-avulsa-historico";
import { DecimalEstoque } from "@/lib/estoque/quantidade";
import {
  calcularCompraSemNota,
  type CustoAdicionalEntrada,
  type ItemCompraSemNota,
} from "@/lib/inventario/entrada-avulsa";

export type EntradaAvulsaInput = {
  chave: string;
  tipo: "COMPRA_SIMPLES" | "OUTRO_MOTIVO";
  itens: ItemCompraSemNota[];
  fornecedorId: string | null;
  frete: number;
  desconto: number;
  custosAdicionais: CustoAdicionalEntrada[];
  data: string;
  dataVencimento: string | null;
  pago: boolean;
  dataPagamento: string | null;
  contaBancariaId: string | null;
  formaPagamento?: PagamentoNota["formaPagamento"];
  cartaoCreditoId?: string | null;
  dataCompra?: string | null;
  parcelaCartao?: number;
  observacao: string | null;
};

export type ResultadoEntradaAvulsa =
  | { erro: string }
  | { ok: true; movimentacaoId: string; entradaAvulsaCompraId: string | null; registroId: string };

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
class ErroEntradaAvulsa extends Error {}

function dataLocal(valor: string) {
  return new Date(`${valor}T12:00:00-03:00`);
}
function validarItensBasicos(itens: ItemCompraSemNota[]) {
  if (!Array.isArray(itens) || itens.length === 0) return "Adicione ao menos um item.";
  if (itens.some(item => {
    const fator = item.fatorConversao ?? 1;
    return !item.insumoId || !item.localId || !Number.isFinite(item.quantidade) || item.quantidade <= 0
      || !Number.isFinite(fator) || fator <= 0 || !Number.isFinite(item.quantidade * fator) || item.quantidade * fator <= 0;
  })) {
    return "Preencha insumo, local e quantidade em todos os itens.";
  }
  const chaves = itens.map(item => `${item.insumoId}:${item.localId}`);
  if (new Set(chaves).size !== chaves.length) return "O mesmo insumo e local não podem aparecer duas vezes.";
  return null;
}

function revalidarEntrada() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/movimentacoes");
  revalidatePath("/inventario/entradas");
  revalidatePath("/financeiro/contas");
  revalidatePath("/financeiro/movimentacoes");
  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro");
}

export async function registrarEntradaAvulsaAction(input: EntradaAvulsaInput): Promise<ResultadoEntradaAvulsa> {
  await exigirPermissao("inventario.entrada", "adicionar");
  if (!input || !["COMPRA_SIMPLES", "OUTRO_MOTIVO"].includes(input.tipo)) return { erro: "Tipo de entrada inválido." };
  const erroItens = validarItensBasicos(input.itens);
  if (erroItens) return { erro: erroItens };
  try { validarItensEntrada(input.itens); } catch (erro) { return { erro: erro instanceof Error ? erro.message : "Itens inválidos." }; }
  if (!REGEX_DATA.test(input.data) || !dataCalendarioValida(input.data)) return { erro: "Data de entrada inválida." };
  if (input.dataVencimento && !REGEX_DATA.test(input.dataVencimento)) return { erro: "Data de vencimento inválida." };
  if (input.pago && (!input.dataPagamento || !REGEX_DATA.test(input.dataPagamento))) return { erro: "Informe a data do pagamento." };
  if (input.pago && !input.contaBancariaId) return { erro: "Selecione a conta usada no pagamento." };
  const formaPagamento = input.formaPagamento ?? "BOLETO";
  if (!["BOLETO", "PIX", "CARTAO"].includes(formaPagamento)) return { erro: "Informe uma forma de pagamento válida." };
  if (formaPagamento === "CARTAO" && input.pago) return { erro: "Compras no cartão de crédito permanecem pendentes até a baixa da fatura." };
  if (formaPagamento === "CARTAO" && (!input.cartaoCreditoId || !input.dataCompra || !REGEX_DATA.test(input.dataCompra) || !Number.isInteger(input.parcelaCartao ?? 1) || (input.parcelaCartao ?? 1) < 1 || (input.parcelaCartao ?? 1) > 120)) {
    return { erro: "Selecione o cartão, a data da compra e uma parcela válida." };
  }
  if ((input.observacao?.trim().length ?? 0) > 2000) return { erro: "A observação deve ter no máximo 2.000 caracteres." };

  const ehCompra = input.tipo === "COMPRA_SIMPLES";
  if (!ehCompra && !input.observacao?.trim()) return { erro: "Descreva o motivo desta entrada." };
  if (ehCompra && !input.fornecedorId) return { erro: "Selecione o fornecedor da compra." };

  const calculo = ehCompra
    ? calcularCompraSemNota({
        itens: input.itens,
        frete: input.frete,
        desconto: input.desconto,
        custosAdicionais: input.custosAdicionais,
      })
    : null;
  if (calculo && "erro" in calculo) return calculo;

  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };

  try {
    const resultado = await prisma.$transaction(async tx => {
      const preparacao = await prepararRegistroEntrada(tx, input, sessao);
      if (preparacao.existente) return { registroId: preparacao.existente.id, movimentacaoId: preparacao.primeiroMovimentoId!, entradaAvulsaCompraId: preparacao.existente.compraId };
      const idsInsumos = [...new Set(input.itens.map(item => item.insumoId))];
      const idsLocais = [...new Set(input.itens.map(item => item.localId))];
      const [insumos, locais] = await Promise.all([
        tx.insumo.findMany({ where: { id: { in: idsInsumos }, ativo: true }, select: { id: true } }),
        tx.localEstoque.findMany({ where: { id: { in: idsLocais }, ativo: true }, select: { id: true } }),
      ]);
      if (insumos.length !== idsInsumos.length) throw new ErroEntradaAvulsa("Um dos insumos está inativo ou não existe.");
      if (locais.length !== idsLocais.length) throw new ErroEntradaAvulsa("Um dos locais de estoque está inativo ou não existe.");

      if (!ehCompra) {
        const movimentosSimples = [];
        for (const item of input.itens) {
        const valorTotal = Number.isFinite(item.valorProdutos) && item.valorProdutos >= 0 ? item.valorProdutos : 0;
        const quantidadeEstoque = new DecimalEstoque(item.quantidade).times(item.fatorConversao ?? 1).toNumber();
        const movimento = await registrarMovimentacao({
          insumoId: item.insumoId,
          localId: item.localId,
          tipo: "AJUSTE_ENTRADA",
          quantidade: quantidadeEstoque,
          custoUnitario: valorTotal / quantidadeEstoque,
          valorTotal,
          observacao: input.observacao!.trim(),
          criadoPorId: sessao.userId,
          data: dataLocal(input.data),
          tx,
        });
        movimentosSimples.push(movimento.movimentacaoId);
        }
        const registro = await gravarRegistroEntrada(tx, input, preparacao.autor, preparacao.hash, null, movimentosSimples);
        return { movimentacaoId: movimentosSimples[0], entradaAvulsaCompraId: null, registroId: registro.id };
      }

      const [fornecedor, categoriaCmv] = await Promise.all([
        tx.fornecedor.findFirst({ where: { id: input.fornecedorId!, ativo: true }, select: { id: true, nome: true } }),
        tx.categoriaFinanceira.findFirst({ where: { grupo: "CMV", ativo: true }, orderBy: { createdAt: "asc" } }),
      ]);
      if (!fornecedor) throw new ErroEntradaAvulsa("Selecione um fornecedor ativo.");
      if (!categoriaCmv) throw new ErroEntradaAvulsa("Cadastre uma categoria ativa de CMV no Plano de Contas.");
      const composicao = calculo!.composicao;
      const dataEntrada = dataLocal(input.data);
      let dataVencimentoTexto = input.dataVencimento || input.data;
      if (formaPagamento === "CARTAO") {
        const cartao = await tx.cartaoCredito.findUnique({ where: { id: input.cartaoCreditoId! }, select: { diaFechamento: true, diaVencimento: true, ativo: true, contaBancaria: { select: { ativo: true } } } });
        if (!cartao?.ativo || !cartao.contaBancaria.ativo) throw new ErroEntradaAvulsa("Selecione um cartão ativo vinculado a uma conta ativa.");
        dataVencimentoTexto = vencimentoCartao(input.dataCompra!, cartao.diaFechamento, cartao.diaVencimento, input.parcelaCartao ?? 1);
      }
      const preparado = await prepararPagamento(tx, {
        formaPagamento,
        cartaoCreditoId: input.cartaoCreditoId,
        dataCompra: input.dataCompra,
        parcelaCartao: input.parcelaCartao,
        dataVencimento: dataVencimentoTexto,
      });
      const dataVencimento = preparado.dataVencimento;
      const dataPagamento = input.pago ? dataLocal(input.dataPagamento!) : null;
      const contaBancaria = input.pago
        ? await tx.contaBancaria.findFirst({ where: { id: input.contaBancariaId!, ativo: true }, select: { id: true } })
        : null;
      if (input.pago && !contaBancaria) throw new ErroEntradaAvulsa("Selecione uma conta bancária ativa.");
      const nomeForma = { BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão de crédito" }[preparado.formaPagamento];
      const forma = await tx.formaPagamento.upsert({ where: { nome: nomeForma }, create: { nome: nomeForma }, update: {} });
      const custosAdicionais = input.custosAdicionais.map(custo => ({
        descricao: custo.descricao.trim(),
        valor: Math.round(custo.valor * 100) / 100,
      }));
      const compra = await tx.entradaAvulsaCompra.create({
        data: {
          fornecedorId: fornecedor.id,
          dataEntrada,
          valorProdutos: composicao.valorProdutos,
          frete: composicao.frete,
          desconto: composicao.desconto,
          valorOutrosCustos: composicao.outrosCustos,
          outrosCustos: custosAdicionais,
          valorTotal: composicao.valorTotal,
          dataVencimento,
          pago: input.pago,
          dataPagamento,
          observacao: input.observacao?.trim() || null,
          criadoPorId: sessao.userId,
        },
      });

      const movimentos = [];
      for (const item of composicao.itens) {
        movimentos.push(await registrarMovimentacao({
          insumoId: item.insumoId,
          localId: item.localId,
          tipo: "ENTRADA_COMPRA",
          quantidade: item.quantidadeEstoque,
          custoUnitario: item.custoUnitario,
          considerarCustoZero: true,
          valorTotal: item.valorFinal,
          observacao: `COMPRA SEM NOTA — ${fornecedor.nome}`,
          criadoPorId: sessao.userId,
          data: dataEntrada,
          dataVencimento,
          pago: input.pago,
          dataPagamento,
          entradaAvulsaCompraId: compra.id,
          tx,
        }));
      }

      const lancamento = await tx.lancamentoFinanceiro.create({
        data: {
          tipo: "DESPESA",
          descricao: paraCaixaAlta(`Compra sem nota — ${fornecedor.nome}`),
          valor: composicao.valorTotal,
          categoriaId: categoriaCmv.id,
          dataCompetencia: dataEntrada,
          dataVencimento,
          fornecedorId: fornecedor.id,
          observacoes: input.observacao?.trim() || null,
          criadoPorId: sessao.userId,
          origemMovimentacaoEstoqueId: movimentos[0].movimentacaoId,
          origemEntradaAvulsaCompraId: compra.id,
          contaBancariaId: preparado.contaBancariaId,
          formaPagamentoId: forma.id,
          cartaoCreditoId: preparado.cartaoCreditoId,
        },
      });

      if (input.pago) {
        await baixarLancamento({
          lancamentoId: lancamento.id,
          contaBancariaId: contaBancaria!.id,
          dataPagamento: dataPagamento!,
          tx,
        });
      }
      const registro = await gravarRegistroEntrada(tx, input, preparacao.autor, preparacao.hash, compra.id, movimentos.map(m => m.movimentacaoId));
      return { movimentacaoId: movimentos[0].movimentacaoId, entradaAvulsaCompraId: compra.id, registroId: registro.id };
    }, { timeout: 30000, maxWait: 10000 });

    revalidarEntrada();
    return { ok: true, ...resultado };
  } catch (erro) {
    return { erro: erro instanceof ErroEntradaAvulsa || erro instanceof ErroCorrecaoEntrada ? erro.message : "Não foi possível registrar a entrada." };
  }
}
