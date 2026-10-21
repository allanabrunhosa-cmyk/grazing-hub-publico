import { consultarPedidoIfood } from "@/lib/ifood/acoes";
import { PedidoIfood } from "../ifood/pedido-ifood";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { CancelamentoPedido } from "../cancelamento-pedido";
import { obterFinanceiroPedido, obterPedido } from "@/lib/vendas/pedidos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { DetalhePedido, type PedidoDetalhado } from "../detalhe-pedido";
import { EditorPedido } from "../editor-pedido";
import { dadosEditorPedido } from "../dados-editor";
import { ModalPedido } from "../modal-pedido";
import { MensagemPopupPedido } from "../mensagem-popup";
import { consultarFiscalSaida } from "@/lib/fiscal-saida/servico";
import { headers } from "next/headers";
import { contextoDoHost } from "@/lib/hosts";
import { origemHubFiscalPedido } from "../fiscal-navegacao";
import { ehPedidoHistorico } from "@/lib/vendas/historico-dominio";
import { DetalheHistoricoPedido } from "../detalhe-historico-pedido";

export async function ConteudoPedido({ params, retorno, abrirCancelamentoInicial = false }: { params: Promise<{ id: string }>; retorno?: string; abrirCancelamentoInicial?: boolean }) {
  if (!await podeAcessar("vendas.pedidos")) return <MensagemPopupPedido titulo="Acesso ao pedido" mensagem="Seu perfil não possui permissão para consultar pedidos." retorno={retorno} />;
  const sessao = await exigirPermissao("vendas.pedidos");
  const { id } = await params;
  const ifood = await consultarPedidoIfood(id, sessao);
  if (ifood) {
    const cancelado = ifood.estado === "CANCELLED";
    const p = cancelado ? await obterPedido(id) : null;
    const [dados, cancelar, receber, condicao] = cancelado ? await Promise.all([dadosEditorPedido(true), podeAcessar("vendas.pedidos.cancelar", "editar"), podeAcessar("financeiro.baixas", "editar"), podeAcessar("financeiro.movimentacoes", "editar")]) : [null, false, false, false];
    const financeiro = cancelado ? await obterFinanceiroPedido(id) : null;
    return <ModalPedido detalhe titulo={`Pedido #${ifood.numero} · iFood`} descricao="Confira o pedido e a próxima ação disponível." retorno={retorno}><PedidoIfood dados={ifood} responsavel={sessao.nome}>{p && dados && financeiro && financeiro.tratamentos.length > 0 && <CancelamentoPedido pedido={{ ...p, modoFinanceiro: "HUB", financeiro } as unknown as PedidoDetalhado} dados={dados} responsavel={sessao.nome} capacidades={{ rascunho: false, confirmar: false, revisar: false, desconto: false, preco: false, cancelar, receber, condicao }} />}</PedidoIfood></ModalPedido>;
  }
  let pedido: Awaited<ReturnType<typeof obterPedido>>;
  try { pedido = await obterPedido(id); } catch (erro) { if (erro instanceof ErroPedidoVenda) return <MensagemPopupPedido titulo="Pedido não encontrado" mensagem="Este pedido não está disponível. Feche a janela e atualize o Gestor." retorno={retorno} />; throw erro; }
  if (ehPedidoHistorico(pedido)) return <DetalheHistoricoPedido id={id} retorno={retorno} />;
  const [dados, rascunho, confirmar, revisar, desconto, preco, cancelar, receber, condicao, editarCliente, estornar] = await Promise.all([
    dadosEditorPedido(pedido.modoFinanceiro !== "EXTERNO"), podeAcessar("vendas.pedidos", "adicionar"), podeAcessar("vendas.pedidos.confirmar", "editar"),
    podeAcessar("vendas.pedidos.revisar", "editar"), podeAcessar("vendas.pedidos.desconto", "editar"),
    podeAcessar("vendas.pedidos.preco", "editar"), podeAcessar("vendas.pedidos.cancelar", "editar"),
    podeAcessar("financeiro.baixas", "editar"), podeAcessar("financeiro.movimentacoes", "editar"), podeAcessar("vendas.clientes", "editar"), podeAcessar("financeiro.estornos", "editar"),
  ]);
  const capacidades = { rascunho, confirmar, revisar, desconto, preco, cancelar, receber, estornar, condicao: condicao && revisar, editarCliente };
  if (["RASCUNHO", "DECLINADO"].includes(String(pedido.status))) return <ModalPedido titulo={`Pedido #${pedido.numero}`} descricao="Confira e salve o orçamento para confirmar o pedido." retorno={retorno} protegerAlteracoes><EditorPedido emDialogo key={String(pedido.id)} dados={dados} pedido={pedido} capacidades={capacidades} /></ModalPedido>;
  const preparar = revisar || await podeAcessar("vendas.pedidos.producao", "editar");
  const fiscal = await podeAcessar("vendas.fiscal") ? { editar: revisar && await podeAcessar("vendas.fiscal", "editar"), documentos: await consultarFiscalSaida(id, sessao), origemHub: origemHubFiscalPedido(contextoDoHost(await headers())) } : undefined;
  const p = pedido as unknown as PedidoDetalhado;
  return <ModalPedido detalhe titulo={`Pedido #${pedido.numero}`} descricao="Acompanhe a entrega, o pagamento e os itens do pedido." retorno={retorno} protegerAlteracoes>
    <DetalhePedido key={`${id}:${abrirCancelamentoInicial ? "cancelar" : "detalhe"}`} pedido={p} dados={dados} capacidades={capacidades} responsavel={sessao.nome} preparar={preparar} fiscal={fiscal} abrirCancelamentoInicial={abrirCancelamentoInicial} />
  </ModalPedido>;
}
