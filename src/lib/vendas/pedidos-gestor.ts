import "server-only";
import { prisma } from "@/lib/prisma";
import { diaNoFuso, somarDias } from "./pedidos-agenda-dominio";
import type { PedidoEntrada } from "./pedidos-dominio";
export async function consultarGestorPedidos() {
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
  const hoje = diaNoFuso(new Date(), loja?.fusoHorario ?? "America/Sao_Paulo");
  const pedidos = await prisma.pedidoVenda.findMany({ where: { status: { in: ["RASCUNHO", "CONFIRMADO", "RECEBIDO_EXTERNO"] }, OR: [{ entregueEm: null }, { entregueEm: { gte: new Date(somarDias(hoje, -7) + "T00:00:00Z") } }] }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } }, orderBy: [{ previsaoData: "asc" }, { numero: "asc" }] });
  const drafts = pedidos.filter(p => p.status === "RASCUNHO").map(p => p.rascunho as unknown as PedidoEntrada);
  const [clientes, produtos, opcoes, contagens] = await Promise.all([
    prisma.clienteVenda.findMany({ where: { id: { in: drafts.flatMap(d => d.clienteId ? [d.clienteId] : []) } }, select: { id: true, nome: true } }),
    prisma.produtoVenda.findMany({ where: { id: { in: drafts.flatMap(d => d.itens.map(i => i.produtoId)) } }, select: { id: true, nome: true, unidade: true } }),
    prisma.opcaoComplementoVenda.findMany({ where: { id: { in: drafts.flatMap(d => d.itens.flatMap(i => [...Object.keys(i.escolhas), ...(i.complementoAvulso ? [i.complementoAvulso.opcaoId] : [])])) } }, select: { id: true, nome: true } }),
    prisma.pedidoVenda.groupBy({ by: ["clienteId"], where: { status: "CONFIRMADO", clienteId: { in: [...pedidos.flatMap(p => p.clienteId ? [p.clienteId] : []), ...drafts.flatMap(d => d.clienteId ? [d.clienteId] : [])] } }, _count: true }),
  ]);
  return { hoje, dias: Array.from({ length: 4 }, (_, i) => somarDias(hoje, i)), pedidos: pedidos.map(p => {
    const d = p.status === "RASCUNHO" ? p.rascunho as unknown as PedidoEntrada : null;
    const clienteId = d?.clienteId ?? p.clienteId;
    const comprador = d ? clientes.find(c => c.id === clienteId)?.nome ?? "Comprador não informado" : (p.compradorSnapshot as { nome?: string } | null)?.nome ?? "Comprador não informado";
    const endereco = (d?.endereco ?? p.enderecoSnapshot) as PedidoEntrada["endereco"];
    const destinatario = (d?.destinatario ?? p.destinatarioSnapshot) as PedidoEntrada["destinatario"];
    return { id: p.id, numero: p.numero, versao: p.versao, atendimento: d?.atendimento ?? p.atendimento, referenciaPedido: p.referenciaPedido, status: p.status, etapa: p.statusOperacional, comprador,
      anteriores: Math.max(0, (contagens.find(c => c.clienteId === clienteId)?._count ?? 0) - (p.status === "CONFIRMADO" ? 1 : 0)),
      data: d?.previsaoData ?? p.previsaoData?.toISOString().slice(0, 10) ?? ((d?.prazo ?? p.prazo) === "IMEDIATO" ? diaNoFuso(p.confirmadoEm ?? p.createdAt, p.fusoHorario) : null),
      janela: d?.previsaoJanela ?? p.previsaoJanela, destinatario: destinatario?.nome && destinatario.nome.trim().toLocaleLowerCase() !== comprador.trim().toLocaleLowerCase() ? destinatario.nome : null,
      endereco: endereco ? [endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro, endereco.cidade, endereco.uf, endereco.cep].filter(Boolean).join(", ") : "Endereço não informado",
      observacoes: d?.observacoes ?? p.observacoes ?? "",
      itens: d ? d.itens.map(i => ({ nome: i.complementoAvulso ? opcoes.find(o => o.id === i.complementoAvulso?.opcaoId)?.nome ?? "Complemento indisponível" : produtos.find(x => x.id === i.produtoId)?.nome ?? "Produto indisponível", quantidade: i.quantidade, unidade: i.complementoAvulso ? "UN" : produtos.find(x => x.id === i.produtoId)?.unidade ?? "UN", observacoes: i.observacoes ?? "", escolhas: Object.entries(i.escolhas).filter(([, qtd]) => qtd > 0).map(([id, qtd]) => `${qtd} × ${opcoes.find(o => o.id === id)?.nome ?? "Opção indisponível"}`) })) : p.itens.map(i => ({ nome: (i.produtoSnapshot as { nome: string }).nome, quantidade: i.quantidade.toString(), unidade: i.unidadeSnapshot, observacoes: i.observacoes ?? "", escolhas: (i.escolhasSnapshot as { opcaoNome: string; quantidade: number }[]).map(e => `${e.quantidade} × ${e.opcaoNome}`) })) };
  }) };
}
export type DadosGestor = Awaited<ReturnType<typeof consultarGestorPedidos>>;
