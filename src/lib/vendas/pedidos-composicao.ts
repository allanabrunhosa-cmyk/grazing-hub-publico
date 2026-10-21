import "server-only";
import { Prisma, type ItemPedidoVenda, type UnidadeMedida } from "@/generated/prisma/client";
import { fatorDaUnidade } from "@/lib/insumos/conversoes";
import { calcularCustosPreparacoes } from "@/lib/insumos/custo-preparacao";

// Consulta analítica. Não promete disponibilidade nem movimenta o estoque.
export async function coberturaComposicaoPedido(tx: Prisma.TransactionClient, itens: ItemPedidoVenda[]) {
  const insumos = await tx.insumo.findMany({ select: { id: true, nome: true, ativo: true, excluidoEm: true, tipo: true, unidade: true, custoMedio: true, rendimentoQuantidade: true, rendimentoUnidade: true, conversoes: true, componentes: { select: { componenteId: true, quantidade: true } } } });
  const custos = calcularCustosPreparacoes(insumos.map(i => ({ ...i, custoMedio: Number(i.custoMedio), rendimentoQuantidade: i.rendimentoQuantidade == null ? null : Number(i.rendimentoQuantidade), conversoes: i.conversoes.map(c => ({ unidade: c.unidade, fator: Number(c.fator) })), componentes: i.componentes.map(c => ({ ...c, quantidade: Number(c.quantidade) })) })));
  const ids = new Set<string>();
  const linhas = itens.map(item => {
    const pendencias: string[] = [];
    if (item.estadoComposicao !== "CONHECIDA") pendencias.push("Composição comercial incompleta; completar cadastro e revisar antes de executar.");
    const componentes = Array.isArray(item.composicaoSnapshot) ? item.composicaoSnapshot as { insumoId: string; nome: string; unidade: UnidadeMedida; quantidade: string; origem: string }[] : [];
    if (!componentes.length) pendencias.push("Sem composição; custo e necessidade física desconhecidos.");
    let estimado = new Prisma.Decimal(0);
    const necessidades = componentes.map(c => {
      ids.add(c.insumoId);
      const insumo = insumos.find(i => i.id === c.insumoId);
      const fator = insumo ? fatorDaUnidade(c.unidade, insumo.unidade, insumo.conversoes.map(v => ({ unidade: v.unidade, fator: Number(v.fator) }))) : null;
      const quantidade = fator != null && fator > 0 ? new Prisma.Decimal(c.quantidade).mul(item.quantidade).mul(fator) : null;
      if (!insumo || (!insumo.ativo && !insumo.excluidoEm) || !quantidade) pendencias.push(`${c.nome}: insumo inativo/ausente ou conversão não cadastrada.`);
      const custo = insumo?.tipo === "PRODUTO_INTERMEDIARIO" ? custos.get(insumo.id) : null;
      const unitario = insumo?.tipo === "INSUMO" && insumo.custoMedio.greaterThan(0) ? insumo.custoMedio : custo && "unitario" in custo && Number.isFinite(custo.unitario) && custo.unitario > 0 ? new Prisma.Decimal(custo.unitario) : null;
      if (quantidade && unitario) estimado = estimado.plus(quantidade.mul(unitario));
      else pendencias.push(`${c.nome}: custo estimado pendente.`);
      return { insumoId: c.insumoId, nome: c.nome, quantidade: quantidade?.toString() ?? null, unidade: insumo?.unidade ?? c.unidade, fator: fator?.toString() ?? null, tipo: insumo?.tipo ?? null, origem: c.origem, custoUnitarioEstimado: unitario?.toString() ?? null };
    });
    return { itemId: item.id, produto: (item.produtoSnapshot as { nome?: string }).nome ?? item.produtoId, quantidade: item.quantidade.toString(), necessidades, pendencias: [...new Set(pendencias)], custoEstimado: pendencias.length ? null : estimado.toFixed(2), custoApurado: null, disponibilidade: null, bloqueioFisico: "Disponibilidade depende do local e das reservas vigentes; consulte e registre na seção de materiais." };
  });
  const saldos = ids.size ? await tx.saldoEstoque.findMany({ where: { insumoId: { in: [...ids] } }, include: { local: { select: { nome: true } } } }) : [];
  return { calculadoEm: new Date().toISOString(), base: "Composição comercial fotografada; conversões e estimativa de custo do cadastro na data desta consulta. Não é custo realizado nem CMV na DRE.", itens: linhas, cobertura: { total: linhas.length, comEstimativa: linhas.filter(i => i.custoEstimado !== null).length }, saldosFisicos: saldos.map(s => ({ insumoId: s.insumoId, localId: s.localId, local: s.local.nome, quantidade: s.quantidadeAtual.toString() })) };
}
export type CoberturaPedido = Awaited<ReturnType<typeof coberturaComposicaoPedido>>;
