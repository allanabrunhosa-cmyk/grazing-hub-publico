import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ItemPedidoVenda, type PedidoVenda, type ReservaPedido, type UnidadeMedida } from "@/generated/prisma/client";
import { DecimalEstoque as D } from "@/lib/estoque/quantidade";
import { registrarConsumoAutomaticoGestorPedido } from "@/lib/estoque/registrarMovimentacao";
import { coberturaComposicaoPedido, type CoberturaPedido } from "./pedidos-composicao";
import { ErroPedidoVenda } from "./pedidos-dominio";
import { travarEstoquePedidos } from "./pedidos-fisico";
import { exigirLiberacaoPedidos } from "./pedidos-liberacao";
import { type ComandoOperacao, politicaMovimentacaoEstoqueGestor } from "./pedidos-operacao-dominio";
import { detectarCicloComposicao } from "./pedidos-prontidao";
import { quantidadeExecucao } from "./pedidos-execucao-dominio";
import type { DestinoFisicoPedido } from "./pedidos-operacao-dominio";

type Tx = Prisma.TransactionClient;
type Apontamento = { tipo: "PREPARAR" | "EXPEDIR"; itemId: string; quantidade: string };
type Fato = { comando?: ComandoOperacao; depois: Prisma.JsonValue };
type Politica = ReturnType<typeof politicaMovimentacaoEstoqueGestor>;
type Decimal = InstanceType<typeof D>;
type Plano = { item: ItemPedidoVenda; tipo: "CONSUMIR" | "EXPEDIR_REVENDA"; reserva: ReservaPedido | null; insumoId: string; localId: string; quantidade: Decimal; quantidadeItem: Decimal; cobertura: CoberturaPedido["itens"][number] | null; unidade: UnidadeMedida; custo: string | null };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const decimal = (v: { toString(): string }) => new D(v.toString());
const erroComposicao = () => new ErroPedidoVenda("Composição/conversão incompleta. Complete o cadastro ou desligue a movimentação de estoque para acompanhar somente os status.");
function material(v: Decimal) {
  const q = v.toDecimalPlaces(30);
  if (!q.isFinite() || !q.gt(0) || q.gte(new D(10).pow(35))) throw erroComposicao();
  return q;
}

/** Chamado somente pelo wrapper confiável do Gestor, na transação/versão do evento pai. */
export async function executarAutomaticoGestorNaTransacao(
  tx: Tx, pedido: PedidoVenda & { itens: ItemPedidoVenda[] }, apontamentos: Apontamento[], fatos: Fato[],
  politica: Politica, autor: { userId: string; nome: string }, chavePai: string,
) {
  if (!politica.movimentarEstoque || pedido.status !== "CONFIRMADO" || pedido.entregueEm) throw new ErroPedidoVenda("Movimentação automática indisponível para pedido encerrado.");
  const itensFisicos = pedido.itens.filter(item => apontamentos.some(a => a.itemId === item.id && ((item.produtoSnapshot as { tipo?: string }).tipo === "REVENDA") === (a.tipo === "EXPEDIR")));
  if (!itensFisicos.length) return;
  await travarEstoquePedidos(tx);
  const reservasFotografadas = await tx.reservaPedido.findMany({ where: { itemId: { in: itensFisicos.map(i => i.id) } }, select: { insumoId: true, snapshot: true } });
  const ids = new Set(reservasFotografadas.map(r => r.insumoId));
  for (const item of itensFisicos) if (Array.isArray(item.composicaoSnapshot)) for (const c of item.composicaoSnapshot as { insumoId: string }[]) if (typeof c.insumoId === "string") ids.add(c.insumoId);
  for (const r of reservasFotografadas) for (const n of (r.snapshot as { cobertura?: CoberturaPedido["itens"][number] }).cobertura?.necessidades ?? []) ids.add(n.insumoId);
  // Edição de unidade/conversão/atividade usa a linha do Insumo; congelamos somente os usados.
  if (ids.size) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Insumo" WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR SHARE`);
  const insumos = await tx.insumo.findMany({ include: { conversoes: true, componentes: { select: { componenteId: true } } } });
  const grafo = new Map(insumos.map(i => [i.id, i.componentes.map(c => c.componenteId)]));
  const planos: Plano[] = [];
  const locaisConferidos = new Set<string>();
  const conferirLocal = async (localId: string | null) => {
    if (!localId) throw new ErroPedidoVenda("Escolha um local ativo no botão Estoque antes de ligar a movimentação automática.");
    if (locaisConferidos.has(localId)) return localId;
    await exigirLiberacaoPedidos(tx, localId, { pedidoId: pedido.id });
    await tx.$queryRaw`SELECT id FROM "LocalEstoque" WHERE id = ${localId} FOR SHARE`;
    const local = await tx.localEstoque.findUnique({ where: { id: localId }, select: { ativo: true } });
    if (!local?.ativo) throw new ErroPedidoVenda("Local de estoque inativo. Escolha um local ativo no botão Estoque.");
    locaisConferidos.add(localId);
    return localId;
  };
  const conferirInsumo = (insumoId: string, unidade: unknown) => {
    const insumo = insumos.find(i => i.id === insumoId);
    if (!insumo || (!insumo.ativo && !insumo.excluidoEm) || !unidade || insumo.unidade !== unidade || detectarCicloComposicao(insumoId, grafo)) throw erroComposicao();
    return insumo;
  };
  // Planejamos todos os itens antes da primeira reserva/baixa; erro de cadastro mantém o lote intacto.
  for (const a of apontamentos) {
    const item = pedido.itens.find(i => i.id === a.itemId);
    if (!item) throw new ErroPedidoVenda("Item vigente não encontrado.");
    const revenda = (item.produtoSnapshot as { tipo?: string }).tipo === "REVENDA";
    if (revenda !== (a.tipo === "EXPEDIR")) continue; // montagem baixa no preparo; revenda, somente na saída.
    const tipo = revenda ? "EXPEDIR_REVENDA" : "CONSUMIR";
    const reservas = await tx.reservaPedido.findMany({ where: { itemId: item.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    for (const r of reservas) {
      if (!r.quantidade.gt(0) || !r.quantidadeItem.gt(0) || r.consumida.lt(r.retornada.plus(r.perdida))) throw new ErroPedidoVenda("Reserva física inconsistente. Confira as ocorrências do pedido.");
    }
    const naoFisica = quantidadeExecucao(fatos, item.id, a.tipo, true);
    const destinos = await tx.historicoPedidoVenda.findMany({ where: { pedidoId: pedido.id, tipo: "OPERACAO_OCORRENCIA" }, select: { id: true, depois: true } });
    const doItem = destinos.filter(f => (f.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico?.itemId === item.id);
    if (doItem.some(f => !fatos.some(r => r.comando?.tipo === "RESOLVER" && r.comando.ocorrenciaId === f.id))) throw new ErroPedidoVenda("Resolva o destino físico pendente do item antes de executar novo material.");
    const destinado = new Map<string, Decimal>();
    for (const f of doItem) for (const m of (f.depois as { destinoFisico: DestinoFisicoPedido }).destinoFisico.materiais ?? []) destinado.set(m.reservaId, (destinado.get(m.reservaId) ?? new D(0)).plus(m.quantidade));
    const alvoFisico = D.max(0, decimal(item.quantidade).minus(naoFisica));
    if (alvoFisico.isZero()) continue;
    const anterior = (reservas[0]?.snapshot as { cobertura?: CoberturaPedido["itens"][number] } | undefined)?.cobertura;
    let cobertura: CoberturaPedido["itens"][number];
    // Necessidade por unidade comercial. Não usar o mínimo entre componentes para
    // criar um lote completo: isso repetiria a saída do componente já consumido.
    const necessidades = new Map<string, Decimal>();
    if (anterior) {
      cobertura = anterior;
      if (!cobertura.necessidades?.length || !new D(cobertura.quantidade).gt(0) || cobertura.necessidades.some(n => !n.quantidade || !n.fator)) throw erroComposicao();
      for (const n of cobertura.necessidades) {
        conferirInsumo(n.insumoId, n.unidade);
        necessidades.set(n.insumoId, (necessidades.get(n.insumoId) ?? new D(0)).plus(new D(n.quantidade!).div(cobertura.quantidade)));
      }
    } else {
      if (item.estadoComposicao !== "CONHECIDA" || !Array.isArray(item.composicaoSnapshot) || !item.composicaoSnapshot.length) throw erroComposicao();
      const componentes = item.composicaoSnapshot as { insumoId: string; quantidade: string; unidade: UnidadeMedida }[];
      const fatores = componentes.map(c => {
        const insumo = insumos.find(i => i.id === c.insumoId);
        if (!insumo || (!insumo.ativo && !insumo.excluidoEm) || detectarCicloComposicao(c.insumoId, grafo)) throw erroComposicao();
        const fator = c.unidade === insumo.unidade ? new D(1) : insumo.conversoes.find(v => v.unidade === c.unidade)?.fator;
        if (!fator || !new D(fator.toString()).gt(0) || !new D(c.quantidade).gt(0)) throw erroComposicao();
        const demanda = new D(c.quantidade).mul(fator.toString());
        necessidades.set(c.insumoId, (necessidades.get(c.insumoId) ?? new D(0)).plus(demanda));
        return fator.toString();
      });
      cobertura = (await coberturaComposicaoPedido(tx, [item])).itens[0];
      // Recalcula a fotografia da demanda com Decimal amplo, sem passar por Number.
      cobertura.necessidades = cobertura.necessidades.map((n, index) => ({ ...n, fator: fatores[index], quantidade: new D(componentes[index].quantidade).mul(fatores[index]).mul(item.quantidade.toString()).toString() }));
    }
    const novos: Plano[] = [];
    let comercialNovo = new D(0);
    for (const [insumoId, porItem] of [...necessidades].sort(([a], [b]) => a.localeCompare(b))) {
      if (!porItem.isFinite() || !porItem.gt(0)) throw erroComposicao();
      const anteriores = reservas.filter(r => r.insumoId === insumoId);
      const consumida = anteriores.reduce((s, r) => s.plus(decimal(r.consumida).minus(D.max(decimal(r.retornada).plus(r.perdida.toString()), destinado.get(r.id) ?? 0))), new D(0));
      let restante = D.min(porItem.mul(a.quantidade), D.max(0, porItem.mul(alvoFisico).minus(consumida))).toDecimalPlaces(30);
      if (restante.isZero()) continue;
      if (anteriores.some(r => decimal(r.retornada).plus(r.perdida.toString()).gt(destinado.get(r.id) ?? 0))) throw new ErroPedidoVenda("Material já destinado por retorno/perda. Trate a ocorrência antes de executar nova baixa automática.");
      for (const r of anteriores) {
        const q = D.min(restante, decimal(r.reservada));
        if (q.lte(0)) continue;
        const snap = r.snapshot as { unidade?: unknown; tipoProduto?: unknown };
        if ((snap.tipoProduto === "REVENDA") !== revenda) throw new ErroPedidoVenda("Tipo fotografado da reserva difere do item.");
        const insumo = conferirInsumo(insumoId, snap.unidade);
        await conferirLocal(r.localId);
        planos.push({ item, tipo, reserva: r, insumoId, localId: r.localId, quantidade: material(q), quantidadeItem: new D(a.quantidade), cobertura: null, unidade: insumo.unidade, custo: insumo.custoMedio.gt(0) ? insumo.custoMedio.toString() : null });
        restante = restante.minus(q);
        if (restante.isZero()) break;
      }
      if (restante.isZero()) continue;
      const localId = await conferirLocal(politica.localMovimentarEstoqueId);
      const insumo = insumos.find(i => i.id === insumoId)!;
      comercialNovo = D.max(comercialNovo, restante.div(porItem));
      novos.push({ item, tipo, reserva: null, insumoId, localId, quantidade: material(restante), quantidadeItem: new D(0), cobertura, unidade: insumo.unidade, custo: insumo.custoMedio.gt(0) ? insumo.custoMedio.toString() : null });
    }
    // A quota comercial do lote tem seis casas no schema; o material mantém sua
    // precisão própria. Arredondar a quota para cima nunca aumenta a baixa física.
    for (const plano of novos) planos.push({ ...plano, quantidadeItem: comercialNovo.toDecimalPlaces(6, D.ROUND_UP) });
  }
  for (const plano of planos) {
    const loteExecucao = hash({ origem: "GESTOR_AUTOMATICO", chavePai, itemId: plano.item.id, tipo: plano.tipo });
    const r = plano.reserva ?? await tx.reservaPedido.create({ data: {
      itemId: plano.item.id, insumoId: plano.insumoId, localId: plano.localId, loteExecucao,
      quantidadeItem: plano.quantidadeItem.toString(), quantidade: plano.quantidade.toString(), reservada: plano.quantidade.toString(),
      snapshot: json({ composicao: plano.item.composicaoSnapshot, cobertura: plano.cobertura, unidade: plano.unidade, tipoProduto: (plano.item.produtoSnapshot as { tipo?: string }).tipo, versaoPedido: plano.item.versaoPedido, origem: "GESTOR_AUTOMATICO", politicaEstoque: politica, permitirSaldoNegativo: true, custoApurado: null, metodoCusto: "PENDENTE_APROVACAO" }),
    } });
    await tx.reservaPedido.update({ where: { id: r.id }, data: { reservada: { decrement: plano.quantidade.toString() }, consumida: { increment: plano.quantidade.toString() } } });
    const movimento = await registrarConsumoAutomaticoGestorPedido({ tx, pedidoId: pedido.id, reservaId: r.id, quantidade: plano.quantidade.toString(), usuarioId: autor.userId, observacao: `Gestor automático; pedido ${pedido.numero}; reserva ${r.id}; saldo negativo autorizado.` });
    const chaveOperacao = hash({ origem: "GESTOR_AUTOMATICO", chavePai, reservaId: r.id, tipo: plano.tipo });
    await tx.historicoPedidoVenda.create({ data: {
      pedidoId: pedido.id, tipo: `FISICO_${plano.tipo}`, chaveOperacao,
      hashOperacao: hash({ chavePai, reservaId: r.id, quantidade: plano.quantidade.toString(), politica }),
      usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: pedido.versao, versaoNova: pedido.versao + 1,
      antes: json({ reservaId: r.id, reservada: r.reservada.toString(), consumida: r.consumida.toString() }),
      depois: json({ origem: "GESTOR_AUTOMATICO", chavePai, politicaEstoque: politica, comando: { tipo: plano.tipo, reservaId: r.id, quantidade: plano.quantidade.toString() }, detalhe: { reservaId: r.id, quantidadeApontada: plano.quantidade.toString(), quantidadeMovimentada: plano.quantidade.toString(), ...movimento, custoCadastroObservado: { valor: plano.custo, unidade: plano.unidade, fonte: "Insumo.custoMedio", observadoEm: new Date().toISOString(), valorizacaoAprovada: false }, custoApurado: null } }),
      motivo: "Baixa automática autorizada pela configuração do Gestor; saldo negativo permitido.",
    } });
  }
}
