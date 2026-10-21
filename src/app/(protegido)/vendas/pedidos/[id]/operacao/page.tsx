import { pedidoEmAcompanhamento, ROTULO_ACOMPANHAMENTO_IFOOD } from "@/lib/ifood/acompanhamento-dominio";
import { MensagemPopupPedido } from "../../mensagem-popup";
import { consultarHorariosPedidos } from "@/lib/vendas/pedidos-horarios";
import { redirect } from "next/navigation";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { retornoGestorSeguro } from "../../pedidos-navegacao";
import Link from "next/link";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { obterPedido } from "@/lib/vendas/pedidos";
import { OperacaoPedido } from "./operacao-client";

import { prisma } from "@/lib/prisma";
import { DocumentoExternoPedido } from "./documento-client";
import { FisicoPedido } from "./fisico-client";
import { ehPedidoHistorico } from "@/lib/vendas/historico-dominio";

export default async function OperacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ retorno?: string }> }) {
  await exigirPermissao("vendas.pedidos");
  if (await identidadeDaInterface() === "pedidos") redirect(retornoGestorSeguro((await searchParams)?.retorno));
  const { id } = await params;
  const origem = await prisma.pedidoIfood.findUnique({ where: { pedidoId: id }, select: { acompanhamento: true, loja: { select: { modoOperacao: true } } } });
  if (pedidoEmAcompanhamento(origem)) return <MensagemPopupPedido titulo={ROTULO_ACOMPANHAMENTO_IFOOD} mensagem="Produção e impressão operacional permanecem no Takeat. Consulte os eventos nos detalhes iFood." retorno={`/vendas/pedidos/${id}`} />;
  const pedido = await obterPedido(id);
  if (ehPedidoHistorico(pedido)) return <MensagemPopupPedido titulo="Pedido histórico" mensagem="O histórico comercial não participa da produção, das reservas ou das entregas atuais." retorno={`/vendas/pedidos/${id}`} />;
  const [locais, itens, reservas] = await Promise.all([
    prisma.localEstoque.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.itemPedidoVenda.findMany({ where: { pedidoId: id, vigente: true } }),
    prisma.reservaPedido.findMany({ where: { item: { pedidoId: id } }, include: { insumo: true, local: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const documentos = await prisma.historicoPedidoVenda.findMany({ where: { pedidoId: id, tipo: "DOCUMENTO_FISCAL_EXTERNO" }, orderBy: { createdAt: "asc" } });
  const fatosFisicos = await prisma.historicoPedidoVenda.findMany({ where: { pedidoId: id, tipo: { startsWith: "FISICO_" } }, orderBy: { createdAt: "asc" } });
  const rotulosFisicos: Record<string, string> = { FISICO_RESERVAR: "Reserva", FISICO_CONSUMIR: "Utilização na preparação", FISICO_EXPEDIR_REVENDA: "Saída de revenda", FISICO_LIBERAR: "Liberação", FISICO_RETORNAR: "Retorno recuperável", FISICO_PERDA: "Destino: perda" };
  return <main className="space-y-6"><Link href={`/vendas/pedidos/${id}`} className="text-primary hover:underline">← Pedido e financeiro</Link><OperacaoPedido horarios={(await consultarHorariosPedidos()).horarios} key={String(pedido.versao)} pedido={pedido} editar={await podeAcessar("vendas.pedidos.revisar", "editar")} /><FisicoPedido key={"fisico-" + String(pedido.versao)} id={id} versao={Number(pedido.versao)} editar={await podeAcessar("inventario", "editar") && await podeAcessar("vendas.pedidos.revisar", "editar")} locais={locais} itens={itens.map(i => ({ id: i.id, nome: (i.produtoSnapshot as { nome: string }).nome }))} reservas={reservas.map(r => ({ id: r.id, itemId: r.itemId, nome: r.insumo.nome, local: r.local.nome, unidade: r.insumo.unidade, reservada: r.reservada.toString(), consumida: r.consumida.toString(), liberada: r.liberada.toString(), retornada: r.retornada.toString(), perdida: r.perdida.toString(), lote: r.loteExecucao }))} /><section className="space-y-2"><h2 className="font-semibold">Histórico físico</h2>{fatosFisicos.map(f => <p key={f.id}>{rotulosFisicos[f.tipo] ?? "Registro físico"} · {f.usuarioNome} · {f.createdAt.toLocaleString("pt-BR", { timeZone: String(pedido.fusoHorario ?? "America/Sao_Paulo") })} · {f.motivo ?? "Liberação explícita para execução"}</p>)}</section><DocumentoExternoPedido fusoHorario={String(pedido.fusoHorario ?? "America/Sao_Paulo")} id={id} editar={await podeAcessar("vendas.fiscal", "editar") && await podeAcessar("vendas.pedidos.revisar", "editar")} documentos={documentos.map(d => ({ ...(d.depois as { emissor: string; referencia: string; evidencia: string }), autor: d.usuarioNome, data: d.createdAt.toISOString() }))} /></main>;
}
