import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarIntegracoes } from "@/lib/ifood/configuracao";
import { prisma } from "@/lib/prisma";
import { ModalPedido } from "../modal-pedido";
import { ConfiguracaoIfood } from "./configuracao-ifood";

export async function ConteudoConfiguracaoIfood() {
  const sessao = await exigirPermissao("configuracoes.loja", "editar");
  const dados = await consultarIntegracoes(sessao);
  const canais = await prisma.canalVenda.findMany({ select: { id: true, nome: true } });
  const formas = await prisma.formaPagamentoVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return <ModalPedido titulo="Integração iFood" descricao="Autorização, recepção e estado da loja." retorno="/vendas/pedidos"><ConfiguracaoIfood dados={dados} canais={canais} formas={formas} /></ModalPedido>;
}
