import { prisma } from "@/lib/prisma";
import { ORIGEM_HISTORICA, LOJA_HISTORICA, itensHistoricosEfetivos, totaisHistoricosEfetivos, type RegistroHistorico } from "@/lib/vendas/historico-dominio";
import { entregaHistoricaProjetadaValida } from "@/lib/vendas/entregas-historicas-dominio";
import { MensagemPopupPedido } from "./mensagem-popup";
import { PainelHistoricoPedido } from "./historico-pedido-conteudo";

/** A fonte histórica tem datas e papéis próprios. Nenhuma ação operacional é oferecida. */
export async function DetalheHistoricoPedido({ id, retorno }: { id: string; retorno?: string }) {
  const origem = await prisma.identidadeExternaVenda.findFirst({ where: { origem: ORIGEM_HISTORICA, loja: LOJA_HISTORICA, entidade: "PEDIDO_HISTORICO", destinoId: id }, select: { dadosOrigem: true } });
  const dados = origem?.dadosOrigem as { registro?: RegistroHistorico; hub?: { entregaHistorica?: unknown } } | undefined;
  const r = dados?.registro;
  if (!r) return <MensagemPopupPedido titulo="Histórico indisponível" mensagem="A fonte deste pedido precisa de conferência." retorno={retorno} />;
  const itens = itensHistoricosEfetivos(r);
  const original = dados?.hub?.entregaHistorica;
  const e = original && typeof original === "object" && !Array.isArray(original) ? original as Record<string, unknown> : null;
  const endereco = e?.enderecoOriginal;
  const enderecoValido = endereco === null || typeof endereco === "string" && endereco.length <= 6000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(endereco);
  const comprovada = e && enderecoValido ? entregaHistoricaProjetadaValida({ ...e, temShipping: !!endereco }, r.numero_original) : null;
  const entregaOriginal = comprovada && (comprovada.modalidade === "RETIRADA" || typeof endereco === "string" && endereco.trim()) ? { modalidade: comprovada.modalidade, enderecoOriginal: typeof endereco === "string" ? endereco : null } : undefined;
  return <PainelHistoricoPedido registro={{ ...r, itens, totais: totaisHistoricosEfetivos(r) }} itensComplementares={itens.length - r.itens.length} retorno={retorno} entregaOriginal={entregaOriginal} />;
}
