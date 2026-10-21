import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { conferirAcesso } from "./pedidos";
import { coberturaComposicaoPedido, type CoberturaPedido } from "./pedidos-composicao";
import { exigirLiberacaoPedidos } from "./pedidos-liberacao";
import { ErroPedidoVenda, quantidadeComercial } from "./pedidos-dominio";

import { detectarCicloComposicao } from "./pedidos-prontidao";
import type { DestinoFisicoPedido } from "./pedidos-operacao-dominio";

type Tx = Prisma.TransactionClient;
export type ComandoFisico = { tipo: "RESERVAR"; itemId: string; localId: string; quantidade: string } | {
  tipo: "CONSUMIR" | "EXPEDIR_REVENDA" | "LIBERAR" | "RETORNAR" | "PERDA";
  reservaId: string; quantidade: string; motivo: string;
};
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const zero = () => new Prisma.Decimal(0);
function quantidade(v: string) {
  if (typeof v !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(v) || new Prisma.Decimal(v).lte(0)) throw new ErroPedidoVenda("Informe quantidade positiva com até seis casas decimais.");
  return new Prisma.Decimal(v);
}
export async function travarEstoquePedidos(tx: Tx) {
  // Mesma trava do gravador compartilhado; impede corridas com saídas de outros módulos.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
}
export async function liberarReservasCancelamento(tx: Tx, pedidoId: string) {
  await travarEstoquePedidos(tx);
  const reservas = await tx.reservaPedido.findMany({ where: { item: { pedidoId }, reservada: { gt: 0 } } });
  for (const r of reservas) await tx.reservaPedido.update({ where: { id: r.id }, data: { reservada: 0, liberada: { increment: r.reservada } } });
  return reservas.map(r => ({ reservaId: r.id, quantidade: r.reservada.toString() }));
}
export async function executarFisicoPedido(pedidoId: string, versao: number, comando: ComandoFisico, chave: string, sessao: SessaoAtual) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(chave) || !Number.isSafeInteger(versao) || versao < 1) throw new ErroPedidoVenda("Operação ou versão inválida.");
  if (!comando || !["RESERVAR", "CONSUMIR", "EXPEDIR_REVENDA", "LIBERAR", "RETORNAR", "PERDA"].includes(comando.tipo)) throw new ErroPedidoVenda("Ação física inválida.");
  const qtd = quantidade(comando.quantidade);
  const hash = createHash("sha256").update(JSON.stringify({ pedidoId, versao, comando })).digest("hex");
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["operar", "estoque"], pedidoId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pedido-operacao:${chave}`}))`;
    const repetido = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: chave } });
    if (repetido) {
      if (repetido.hashOperacao !== hash) throw new ErroPedidoVenda("Chave já usada com outro conteúdo.");
      return { id: pedidoId, versao: repetido.versaoNova };
    }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${pedidoId} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } });
    if (pedido.versao !== versao || pedido.status === "RASCUNHO") throw new ErroPedidoVenda("Pedido alterado ou não confirmado.");
    await travarEstoquePedidos(tx);
    let detalhe: unknown;
    if (comando.tipo === "RESERVAR") {
      if (pedido.status !== "CONFIRMADO" || pedido.entregueEm || pedido.statusOperacional === "EM_ENTREGA") throw new ErroPedidoVenda("Pedido encerrado ou em entrega.");
      await exigirLiberacaoPedidos(tx, comando.localId, { pedidoId });
      const local = await tx.localEstoque.findUnique({ where: { id: comando.localId } });
      if (!local?.ativo) throw new ErroPedidoVenda("Selecione local ativo autorizado.");
      const item = await tx.itemPedidoVenda.findFirst({ where: { id: comando.itemId, pedidoId, vigente: true } });
      if (!item) throw new ErroPedidoVenda("Item vigente não encontrado.");
      quantidadeComercial(comando.quantidade, item.unidadeSnapshot);
      const anteriores = await tx.reservaPedido.findMany({ where: { itemId: item.id } });
      const lotes = new Map<string, typeof anteriores>();
      for (const r of anteriores) lotes.set(r.loteExecucao, [...(lotes.get(r.loteExecucao) ?? []), r]);
      // Um lote parcialmente liberado ainda ocupa sua quantidade comercial até liberar todos os componentes.
      const ocupada = [...lotes.values()].filter(rs => rs.some(r => r.reservada.gt(0) || r.consumida.gt(0))).reduce((s, rs) => s.plus(rs[0].quantidadeItem), zero());
      if (ocupada.plus(qtd).gt(item.quantidade)) throw new ErroPedidoVenda("Quantidade já reservada/executada excede o item.");
      const cobertura = (anteriores[0]?.snapshot as { cobertura?: CoberturaPedido["itens"][number] } | undefined)?.cobertura ?? (await coberturaComposicaoPedido(tx, [item])).itens[0];
      if (item.estadoComposicao !== "CONHECIDA" || !cobertura.necessidades.length || cobertura.necessidades.some(n => !n.quantidade || !n.fator)) throw new ErroPedidoVenda("Composição/conversão incompleta; venda preservada, execução física pendente.");
      const grafo = new Map((await tx.insumo.findMany({ select: { id: true, componentes: { select: { componenteId: true } } } })).map(i => [i.id, i.componentes.map(c => c.componenteId)]));
      if (cobertura.necessidades.some(n => detectarCicloComposicao(n.insumoId, grafo))) throw new ErroPedidoVenda("Há ciclo entre preparações. Revise a composição.");
      const necessidades = new Map<string, Prisma.Decimal>();
      for (const n of cobertura.necessidades) necessidades.set(n.insumoId, (necessidades.get(n.insumoId) ?? zero()).plus(new Prisma.Decimal(n.quantidade!).div(item.quantidade).mul(qtd)));
      const criadas = [];
      for (const [insumoId, demanda] of [...necessidades].sort(([a], [b]) => a.localeCompare(b))) {
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: insumoId } });
        if (!insumo.ativo && !insumo.excluidoEm) throw new ErroPedidoVenda("Componente inativo.");
        if (cobertura.necessidades.some(n => n.insumoId === insumoId && n.unidade !== insumo.unidade)) throw new ErroPedidoVenda("Unidade do insumo mudou após a fotografia. Trate a pendência de conversão antes de executar.");
        const saldo = await tx.saldoEstoque.findUnique({ where: { insumoId_localId: { insumoId, localId: local.id } } });
        const reservas = await tx.reservaPedido.aggregate({ where: { insumoId, localId: local.id }, _sum: { reservada: true } });
        if ((saldo?.quantidadeAtual ?? zero()).minus(reservas._sum.reservada ?? 0).lt(demanda)) throw new ErroPedidoVenda(`Estoque disponível insuficiente: ${insumo.nome}.`);
        criadas.push(await tx.reservaPedido.create({ data: { itemId: item.id, insumoId, localId: local.id, loteExecucao: chave, quantidadeItem: qtd, quantidade: demanda, reservada: demanda, snapshot: json({ composicao: item.composicaoSnapshot, cobertura, unidade: insumo.unidade, tipoProduto: (item.produtoSnapshot as { tipo?: string }).tipo, versaoPedido: item.versaoPedido, origem: "CALCULADA_PELA_FICHA", custoApurado: null, metodoCusto: "PENDENTE_APROVACAO" }) } }));
      }
      detalhe = criadas;
    } else {
      if (typeof comando.motivo !== "string" || !comando.motivo.trim() || comando.motivo.length > 1000) throw new ErroPedidoVenda("Informe motivo e condição/destino do material.");
      const r = await tx.reservaPedido.findFirst({ where: { id: comando.reservaId, item: { pedidoId } }, include: { item: true } });
      if (!r) throw new ErroPedidoVenda("Reserva não pertence ao pedido.");
      await exigirLiberacaoPedidos(tx, r.localId);
      let movimentoId: string | null = null;
      let custoCadastroObservado: unknown = null;
      const saida = comando.tipo === "CONSUMIR" || comando.tipo === "EXPEDIR_REVENDA";
      if (saida || comando.tipo === "LIBERAR") {
        if (qtd.gt(r.reservada)) throw new ErroPedidoVenda("Quantidade excede a reserva restante.");
        if (saida) {
          if (pedido.status !== "CONFIRMADO" || pedido.entregueEm || !r.item.vigente) throw new ErroPedidoVenda("Execução não permitida para item encerrado.");
          const revenda = (r.snapshot as { tipoProduto?: string }).tipoProduto === "REVENDA";
          if (revenda !== (comando.tipo === "EXPEDIR_REVENDA") || (revenda && pedido.statusOperacional !== "PRONTO") || (!revenda && pedido.statusOperacional !== "EM_PREPARO")) throw new ErroPedidoVenda("Revenda sai na expedição; montagem consome na preparação.");
        }
        await tx.reservaPedido.update({ where: { id: r.id }, data: { reservada: { decrement: qtd }, ...(saida ? { consumida: { increment: qtd } } : { liberada: { increment: qtd } }) } });
        if (saida) {
          const saldo = await tx.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: r.insumoId, localId: r.localId } } });
          if (saldo.quantidadeAtual.lt(qtd)) throw new ErroPedidoVenda("Saldo físico insuficiente.");
          const cadastro = await tx.insumo.findUniqueOrThrow({ where: { id: r.insumoId }, select: { custoMedio: true, unidade: true } });
          custoCadastroObservado = { valor: cadastro.custoMedio.gt(0) ? cadastro.custoMedio.toString() : null, unidade: cadastro.unidade, fonte: "Insumo.custoMedio", observadoEm: new Date().toISOString(), valorizacaoAprovada: false };
          movimentoId = (await registrarMovimentacao({ tx, insumoId: r.insumoId, localId: r.localId, tipo: "SAIDA_CONSUMO", quantidade: qtd.toNumber(), criadoPorId: autor.userId, observacao: `Pedido ${pedido.numero}; reserva ${r.id}; ${comando.motivo}` })).movimentacaoId;
        }
      } else {
        if (qtd.gt(r.consumida.minus(r.retornada).minus(r.perdida))) throw new ErroPedidoVenda("Material já destinado ou quantidade superior à saída.");
        if (comando.tipo === "RETORNAR") {
          // Apenas o mesmo componente efetivamente recuperado. Não reconstrói ingredientes de alimento pronto.
          const preparo = await tx.historicoPedidoVenda.count({ where: { pedidoId, tipo: "OPERACAO_PREPARAR", depois: { path: ["comando", "itemId"], equals: r.itemId } } });
          if (preparo && (r.snapshot as { tipoProduto?: string }).tipoProduto !== "REVENDA") {
            const ocorrencias = await tx.historicoPedidoVenda.findMany({ where: { pedidoId, tipo: "OPERACAO_OCORRENCIA" }, select: { depois: true } });
            const materiaIntegra = ocorrencias.reduce((s, f) => { const d = (f.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico; return d?.reservaId === r.id ? s.plus(d.quantidade) : s; }, zero());
            if (qtd.plus(r.retornada).gt(materiaIntegra)) throw new ErroPedidoVenda("Já houve preparo: retorno de ingredientes não permitido. Só o material excedente sem preparo identificado em ocorrência pode retornar.");
          }
          movimentoId = (await registrarMovimentacao({ tx, insumoId: r.insumoId, localId: r.localId, tipo: "AJUSTE_ENTRADA", quantidade: qtd.toNumber(), criadoPorId: autor.userId, observacao: `Retorno físico Pedido ${pedido.numero}; reserva ${r.id}; ${comando.motivo}` })).movimentacaoId;
          await tx.reservaPedido.update({ where: { id: r.id }, data: { retornada: { increment: qtd } } });
        } else await tx.reservaPedido.update({ where: { id: r.id }, data: { perdida: { increment: qtd } } });
      }
      detalhe = { reservaId: r.id, movimentoId, quantidadeApontada: qtd.toString(), quantidadeMovimentada: movimentoId ? qtd.toString() : "0", custoCadastroObservado, custoApurado: null };
    }
    await tx.pedidoVenda.update({ where: { id: pedidoId }, data: { versao: { increment: 1 } } });
    await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: `FISICO_${comando.tipo}`, chaveOperacao: chave, hashOperacao: hash, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: versao, versaoNova: versao + 1, antes: json({ versao }), depois: json({ comando, detalhe }), motivo: comando.tipo === "RESERVAR" ? null : comando.motivo } });
    return { id: pedidoId, versao: versao + 1 };
  }, { timeout: 30000 });
}
