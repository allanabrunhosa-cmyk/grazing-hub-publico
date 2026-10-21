import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ItemPedidoVenda } from "@/generated/prisma/client";
import { DecimalEstoque as D } from "@/lib/estoque/quantidade";
import { ErroPedidoVenda, type PedidoEntrada } from "./pedidos-dominio";
import { quantidadeExecucao, type AjusteExecucao } from "./pedidos-execucao-dominio";
import { abrirMateriaisExcedentes, materiaisDestino } from "./pedidos-destino";
import { travarEstoquePedidos } from "./pedidos-fisico";
import type { calcularPedido } from "./pedidos";

type Tx = Prisma.TransactionClient;
type Novos = Awaited<ReturnType<typeof calcularPedido>>["itens"];
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function canonico(v: unknown): string {
  if (v === null || v === Prisma.DbNull) return "null";
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${canonico(x)}`).join(",")}}`;
  return JSON.stringify(v);
}
function identidade(i: Pick<ItemPedidoVenda, "produtoId" | "unidadeSnapshot"> & { produtoSnapshot: unknown; escolhasSnapshot: unknown; composicaoSnapshot: unknown }) {
  const produto = i.produtoSnapshot as { tipo?: string; complementoAvulso?: { produtoOrigemId: string; grupoId: string; opcaoId: string; multiplicador: string } };
  const escolhas = (i.escolhasSnapshot as { opcaoId: string; quantidade: number }[]).map(e => [e.opcaoId, e.quantidade]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const avulso = produto.complementoAvulso;
  return canonico([i.produtoId, i.unidadeSnapshot, produto.tipo, avulso ? [avulso.produtoOrigemId, avulso.grupoId, avulso.opcaoId, avulso.multiplicador] : null, escolhas, Array.isArray(i.composicaoSnapshot) ? i.composicaoSnapshot : null]);
}

/** Mesma transação/versão da revisão comercial. Mantém IDs para a execução compatível. */
export async function revisarItensExecutados(tx: Tx, pedidoId: string, anteriores: ItemPedidoVenda[], novos: Novos, entrada: PedidoEntrada, chavePai: string, autor: { userId: string; nome: string }, versao: number) {
  await travarEstoquePedidos(tx);
  const usados = new Set<string>();
  const identificada = entrada.itens.some(i => i.itemOrigemId);
  const vinculados = novos.map((novo, n) => {
    const origem = entrada.itens[n].itemOrigemId;
    const anterior = origem ? anteriores.find(i => i.id === origem) : identificada ? undefined : anteriores[n];
    if (origem && !anterior || anterior && usados.has(anterior.id)) throw new ErroPedidoVenda("Item de origem inválido ou repetido. Reabra o pedido.");
    if (anterior) usados.add(anterior.id);
    return { novo, anterior: anterior && identidade(anterior) === identidade(novo) ? anterior : undefined };
  });
  const fatos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId, tipo: { startsWith: "OPERACAO_" } }, select: { depois: true } });
  let faltaPreparo = false, faltaExpedicao = false;
  for (const item of anteriores) {
    const par = vinculados.find(v => v.anterior?.id === item.id);
    const quantidade = new D(par?.novo.quantidade ?? 0);
    const preparado = quantidadeExecucao(fatos, item.id, "PREPARAR"), expedido = quantidadeExecucao(fatos, item.id, "EXPEDIR");
    const reduzirPreparo = D.max(0, preparado.minus(quantidade)), reduzirExpedicao = D.max(0, expedido.minus(quantidade));
    const semEstoque = (tipo: string, total: InstanceType<typeof D>, reduzir: InstanceType<typeof D>) => D.max(0, reduzir.minus(total.minus(quantidadeExecucao(fatos, item.id, tipo, true)))).toString();
    const ajusteExecucao: AjusteExecucao = { itemId: item.id, preparar: reduzirPreparo.toString(), expedir: reduzirExpedicao.toString(), prepararSemEstoque: semEstoque("PREPARAR", preparado, reduzirPreparo), expedirSemEstoque: semEstoque("EXPEDIR", expedido, reduzirExpedicao) };
    const excedente = D.max(reduzirPreparo, reduzirExpedicao);
    if (excedente.gt(0)) {
      const chave = createHash("sha256").update(`${chavePai}:revisao-execucao:${item.id}`).digest("hex");
      await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: "OPERACAO_REVISAO", chaveOperacao: chave, hashOperacao: chave, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: versao, versaoNova: versao + 1, motivo: "Revisão comercial: execução excedente separada para destinação.", depois: json({ ajusteExecucao, chavePai }) } });
      const chaveDestino = createHash("sha256").update(`${chave}:destino`).digest("hex");
      await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: "OPERACAO_OCORRENCIA", chaveOperacao: chaveDestino, hashOperacao: chaveDestino, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: versao, versaoNova: versao + 1, motivo: "Definir destino da quantidade executada que saiu da encomenda.", depois: json({ comando: { tipo: "OCORRENCIA" }, chavePai, destinoFisico: { origem: "REVISAO", itemId: item.id, produto: (item.produtoSnapshot as { nome: string }).nome, unidade: item.unidadeSnapshot, quantidade: excedente.toString(), materiais: await materiaisDestino(tx, pedidoId, item.id, excedente) } }) } });
    }
    if (!par || quantidade.lt(item.quantidade.toString())) {
      await abrirMateriaisExcedentes(tx, item, quantidade.toString(), "REVISAO", chavePai, autor, versao);
      // Só libera reserva ainda não consumida. Saídas e custos de origem permanecem.
      const reservas = await tx.reservaPedido.findMany({ where: { itemId: item.id, reservada: { gt: 0 } } });
      for (const r of reservas) await tx.reservaPedido.update({ where: { id: r.id }, data: { reservada: 0, liberada: { increment: r.reservada } } });
    }
    if (par) {
      const numericos = new Set(["quantidade", "precoOriginal", "precoAplicado", "acrescimos", "desconto", "totalLinha"]);
      const alterado = Object.entries(par.novo).some(([k, v]) => k !== "versaoPedido" && (numericos.has(k) ? !new D(String(v)).eq(String(item[k as keyof ItemPedidoVenda])) : canonico(v) !== canonico(item[k as keyof ItemPedidoVenda])));
      if (alterado) await tx.itemPedidoVenda.update({ where: { id: item.id }, data: { ...par.novo, versaoPedido: versao + 1 } });
      faltaPreparo ||= quantidade.gt(preparado);
      faltaExpedicao ||= quantidade.gt(expedido);
    } else await tx.itemPedidoVenda.update({ where: { id: item.id }, data: { vigente: false } });
  }
  for (const { novo, anterior } of vinculados) if (!anterior) {
    await tx.itemPedidoVenda.create({ data: { ...novo, pedidoId, versaoPedido: versao + 1 } });
    faltaPreparo = true; faltaExpedicao = true;
  }
  return { faltaPreparo, faltaExpedicao };
}
