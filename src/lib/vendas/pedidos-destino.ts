import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ItemPedidoVenda } from "@/generated/prisma/client";
import { ErroPedidoVenda, quantidadeComercial } from "./pedidos-dominio";
import type { ComandoOperacao, DestinoFisicoPedido } from "./pedidos-operacao-dominio";
import { DecimalEstoque as D } from "@/lib/estoque/quantidade";

type Tx = Prisma.TransactionClient;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const zero = () => new D(0);
const dec = (v: { toString(): string }) => new D(v.toString());

/** Retirada anterior ao preparo pode exceder os produtos efetivamente executados. */
export async function abrirMateriaisExcedentes(tx: Tx, item: ItemPedidoVenda, manter: string, origem: "CANCELAMENTO" | "REVISAO", chavePai: string, autor: { userId: string; nome: string }, versao: number) {
  const reservas = await tx.reservaPedido.findMany({ where: { itemId: item.id }, include: { insumo: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const fatos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId: item.pedidoId, tipo: "OPERACAO_OCORRENCIA" }, select: { depois: true } });
  const alocada = new Map<string, InstanceType<typeof D>>(), mantida = new Map<string, InstanceType<typeof D>>();
  for (const f of fatos) for (const m of (f.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico?.materiais ?? []) alocada.set(m.reservaId, (alocada.get(m.reservaId) ?? zero()).plus(m.quantidade));
  for (const r of reservas) {
    const porItem = dec(r.quantidade).div(r.quantidadeItem.toString());
    const disponivel = D.max(0, dec(r.consumida).minus(D.max(alocada.get(r.id) ?? 0, dec(r.retornada).plus(r.perdida.toString()))));
    const conservar = D.min(disponivel, D.max(0, porItem.mul(manter).minus(mantida.get(r.insumoId) ?? 0)));
    mantida.set(r.insumoId, (mantida.get(r.insumoId) ?? zero()).plus(conservar));
    const restante = disponivel.minus(conservar);
    if (restante.lte(0)) continue;
    const anterior = D.max(alocada.get(r.id) ?? 0, dec(r.retornada).plus(r.perdida.toString()));
    const destinoFisico: DestinoFisicoPedido = { origem, itemId: item.id, reservaId: r.id, produto: r.insumo.nome, unidade: r.insumo.unidade, quantidade: restante.toString(), materiais: [{ reservaId: r.id, quantidade: restante.toString(), acumulada: anterior.plus(restante).toString() }] };
    const chave = createHash("sha256").update(`${chavePai}:destino-material:${r.id}`).digest("hex");
    await tx.historicoPedidoVenda.create({ data: { pedidoId: item.pedidoId, tipo: "OPERACAO_OCORRENCIA", chaveOperacao: chave, hashOperacao: chave, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: versao, versaoNova: versao + 1, motivo: `Material retirado excedente, sem preparo apontado — ${r.insumo.nome}.`, depois: json({ comando: { tipo: "OCORRENCIA" }, destinoFisico, chavePai }) } });
  }
}

export async function materiaisDestino(tx: Tx, pedidoId: string, itemId: string, quantidade: InstanceType<typeof D>) {
  const [reservas, fatos] = await Promise.all([
    tx.reservaPedido.findMany({ where: { itemId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    tx.historicoPedidoVenda.findMany({ where: { pedidoId, tipo: "OPERACAO_OCORRENCIA" }, select: { depois: true } }),
  ]);
  const alocada = new Map<string, InstanceType<typeof D>>();
  for (const f of fatos) for (const m of (f.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico?.materiais ?? []) alocada.set(m.reservaId, (alocada.get(m.reservaId) ?? zero()).plus(m.quantidade));
  const lotes = new Map<string, typeof reservas>();
  for (const r of reservas) lotes.set(r.loteExecucao, [...(lotes.get(r.loteExecucao) ?? []), r]);
  let restante = quantidade;
  const materiais: NonNullable<DestinoFisicoPedido["materiais"]> = [];
  // Aloca lotes reais na ordem da execução. Quantidades apontadas com estoque OFF
  // não possuem saída de origem e nunca geram crédito físico retroativo.
  for (const lote of lotes.values()) {
    if (restante.lte(0)) break;
    const disponivel = D.max(0, ...lote.map(r => dec(r.consumida).minus(alocada.get(r.id) ?? 0).div(dec(r.quantidade).div(r.quantidadeItem.toString()))));
    const parcela = D.min(restante, disponivel);
    for (const r of lote) {
      const anterior = alocada.get(r.id) ?? zero();
      const qtd = D.min(D.max(0, dec(r.consumida).minus(anterior)), parcela.mul(dec(r.quantidade).div(r.quantidadeItem.toString())));
      if (qtd.gt(0)) materiais.push({ reservaId: r.id, quantidade: qtd.toString(), acumulada: anterior.plus(qtd).toString() });
    }
    restante = restante.minus(parcela);
  }
  return materiais;
}

/** A pendência descreve produto já preparado/expedido; não reconstitui ingredientes. */
export async function quantidadeExecutadaItem(tx: Tx, pedidoId: string, itemId: string) {
  const fatos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId, tipo: { in: ["OPERACAO_PREPARAR", "OPERACAO_EXPEDIR"] } }, select: { depois: true } });
  const total = (tipo: string) => fatos.reduce((s, f) => { const c = (f.depois as { comando?: ComandoOperacao }).comando; return c?.tipo === tipo && c.itemId === itemId ? s.plus(c.quantidade ?? 0) : s; }, zero());
  return D.max(total("PREPARAR"), total("EXPEDIR"));
}

export async function abrirDestinosCancelamento(tx: Tx, pedidoId: string, chavePai: string, autor: { userId: string; nome: string }, versao: number) {
  const itens = await tx.itemPedidoVenda.findMany({ where: { pedidoId, vigente: true } });
  for (const item of itens) {
    const quantidade = await quantidadeExecutadaItem(tx, pedidoId, item.id);
    if (quantidade.isZero()) {
      await abrirMateriaisExcedentes(tx, item, "0", "CANCELAMENTO", chavePai, autor, versao);
      continue;
    }
    const anteriores = await tx.historicoPedidoVenda.findMany({ where: { pedidoId, tipo: "OPERACAO_OCORRENCIA" }, select: { depois: true } });
    const destinada = anteriores.reduce((s, f) => { const d = (f.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico; return d?.itemId === item.id && !d.reservaId ? s.plus(d.quantidade) : s; }, zero());
    const restante = quantidade.minus(destinada);
    if (restante.lte(0)) continue;
    const destinoFisico: DestinoFisicoPedido = { origem: "CANCELAMENTO", itemId: item.id, produto: (item.produtoSnapshot as { nome: string }).nome, unidade: item.unidadeSnapshot, quantidade: restante.toString(), materiais: await materiaisDestino(tx, pedidoId, item.id, restante) };
    const chave = createHash("sha256").update(`${chavePai}:destino:${item.id}`).digest("hex");
    await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: "OPERACAO_OCORRENCIA", chaveOperacao: chave, hashOperacao: chave, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: versao, versaoNova: versao + 1,
      motivo: `Cancelamento: definir destino de ${restante.toString()} ${item.unidadeSnapshot} de ${destinoFisico.produto}.`, depois: json({ comando: { tipo: "OCORRENCIA" }, destinoFisico, chavePai }) } });
    await abrirMateriaisExcedentes(tx, item, "0", "CANCELAMENTO", chavePai, autor, versao);
  }
}

export async function prepararDevolucaoFisica(tx: Tx, pedidoId: string, comando: ComandoOperacao): Promise<DestinoFisicoPedido> {
  const item = await tx.itemPedidoVenda.findFirst({ where: { id: comando.itemId, pedidoId, vigente: true } });
  if (!item || !comando.itemId) throw new ErroPedidoVenda("Selecione o item devolvido.");
  const quantidade = new D(quantidadeComercial(comando.quantidade, item.unidadeSnapshot));
  const fatos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId, tipo: "OPERACAO_OCORRENCIA" }, select: { depois: true } });
  const destinada = fatos.reduce((s, f) => { const d = (f.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico; return d?.itemId === item.id && !d.reservaId ? s.plus(d.quantidade) : s; }, zero());
  if (quantidade.plus(destinada).gt(await quantidadeExecutadaItem(tx, pedidoId, item.id))) throw new ErroPedidoVenda("Quantidade superior ao executado ainda sem destinação. Confira as pendências e o histórico.");
  return { origem: "DEVOLUCAO", itemId: item.id, produto: (item.produtoSnapshot as { nome: string }).nome, unidade: item.unidadeSnapshot, quantidade: quantidade.toString(), materiais: await materiaisDestino(tx, pedidoId, item.id, quantidade) };
}

export async function validarResolucaoDestino(tx: Tx, destino: DestinoFisicoPedido, comando: ComandoOperacao) {
  const ler = (v: unknown) => {
    if (v === "0") return zero();
    if (destino.reservaId) {
      if (typeof v !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(v)) throw new ErroPedidoVenda("Quantidade de material inválida; use até seis casas decimais.");
      return new D(v);
    }
    return new D(quantidadeComercial(v, destino.unidade));
  };
  const recuperavel = ler(comando.recuperavel), perda = ler(comando.perda);
  if (!recuperavel.plus(perda).eq(destino.quantidade)) throw new ErroPedidoVenda("Recuperável e perda devem fechar exatamente com a quantidade pendente.");
  const item = await tx.itemPedidoVenda.findUniqueOrThrow({ where: { id: destino.itemId } });
  if (destino.reservaId || (item.produtoSnapshot as { tipo?: string }).tipo === "REVENDA") {
    // O retorno/perda de uma revenda com saída real deve estar comprovado no
    // mecanismo físico existente. Resolver a ocorrência nunca inventa entrada.
    const reservas = await tx.reservaPedido.findMany({ where: { itemId: item.id } });
    const fatos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId: item.pedidoId, tipo: { in: ["OPERACAO_OCORRENCIA", "OPERACAO_RESOLVER"] } }, select: { id: true, depois: true } });
    for (const m of destino.materiais ?? []) {
      const r = reservas.find(r => r.id === m.reservaId);
      let retornoNecessario = new D(m.quantidade).mul(recuperavel).div(destino.quantidade);
      let perdaNecessaria = new D(m.quantidade).mul(perda).div(destino.quantidade);
      for (const f of fatos) {
        const resolucao = f.depois as { comando?: ComandoOperacao; resolucaoDestino?: { recuperavel: string; perda: string } };
        if (!resolucao.resolucaoDestino) continue;
        const origem = (fatos.find(o => o.id === resolucao.comando?.ocorrenciaId)?.depois as { destinoFisico?: DestinoFisicoPedido } | undefined)?.destinoFisico;
        if (!origem || (!origem.reservaId && (item.produtoSnapshot as { tipo?: string }).tipo !== "REVENDA")) continue;
        const material = origem.materiais?.find(a => a.reservaId === m.reservaId);
        if (!material) continue;
        retornoNecessario = retornoNecessario.plus(new D(material.quantidade).mul(resolucao.resolucaoDestino.recuperavel).div(origem.quantidade));
        perdaNecessaria = perdaNecessaria.plus(new D(material.quantidade).mul(resolucao.resolucaoDestino.perda).div(origem.quantidade));
      }
      if (!r || dec(r.retornada).lt(retornoNecessario) || dec(r.perdida).lt(perdaNecessaria)) throw new ErroPedidoVenda("Há material retirado ainda sem o destino informado no estoque. Registre o retorno ou a perda em Materiais antes de concluir esta pendência.");
    }
  }
  return { recuperavel: recuperavel.toString(), perda: perda.toString(), destino: comando.motivo!.trim(), movimentacaoAutomatica: false };
}
