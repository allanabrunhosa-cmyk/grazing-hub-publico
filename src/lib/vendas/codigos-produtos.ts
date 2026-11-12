import "server-only";
import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { autorEntregas } from "./entregas";
import { ErroCadastroVenda } from "./dominio";
import { historico, transacao, type Autor } from "./persistencia";
import { codigoProdutoValido, lerEstadoCodigosProdutos, prepararFamiliasCodigos, registrarCodigosExistentes, proximoCodigoProduto, type EstadoCodigosProdutos } from "./codigo-produto";
type Tx = Prisma.TransactionClient;
const json = (v: EstadoCodigosProdutos) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
async function estadoNaTransacao(tx: Tx) {
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { codigosProdutos: true } });
  const categorias = await tx.categoriaVenda.findMany({ select: { id: true, escopo: true, nome: true, ordem: true } });
  const produtos = await tx.produtoVenda.findMany({ orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, codigo: true, versao: true, classificacao: true, categorias: { select: { categoriaId: true } } } });
  const antes = loja?.codigosProdutos ?? null;
  const estado = prepararFamiliasCodigos(lerEstadoCodigosProdutos(antes), categorias);
  registrarCodigosExistentes(estado, produtos.map(p => p.codigo));
  return { antes, estado, produtos };
}
async function salvarEstado(tx: Tx, autor: Autor, antes: unknown, estado: EstadoCodigosProdutos) {
  await tx.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", codigosProdutos: json(estado) }, update: { codigosProdutos: json(estado) } });
  await historico(tx, autor, "CODIGOS_PRODUTOS", "singleton", antes, estado);
}
/** O chamador mantém a trava vendas-cadastros até salvar o produto. */
export async function alocarCodigoProdutoNaTransacao(tx: Tx, entrada: { codigoAntes: string | null; codigoInformado: string | null; classificacao: string; categorias: string[] }, autor: Autor): Promise<string> {
  if (entrada.codigoInformado && entrada.codigoInformado !== entrada.codigoAntes) throw new ErroCadastroVenda("O código do produto é gerado pelo sistema. Reabra o cadastro antes de salvar.");
  if (codigoProdutoValido(entrada.codigoAntes)) return entrada.codigoAntes;
  const { antes, estado } = await estadoNaTransacao(tx);
  const codigo = proximoCodigoProduto(estado, entrada.classificacao, entrada.categorias);
  await salvarEstado(tx, autor, antes, estado);
  return codigo;
}
/** Ação administrativa explícita. Não altera pedidos, tributos ou documentos fiscais. */
export async function organizarCodigosProdutos(sessao: SessaoAtual): Promise<{ atualizados: number }> {
  return transacao(async tx => {
    const autor = await autorEntregas(tx, sessao, "vendas.produtos", "editar");
    const { antes, estado, produtos } = await estadoNaTransacao(tx);
    let atualizados = 0;
    for (const p of produtos) {
      if (codigoProdutoValido(p.codigo)) continue;
      const codigo = proximoCodigoProduto(estado, p.classificacao, p.categorias.map(c => c.categoriaId));
      await tx.produtoVenda.update({ where: { id: p.id }, data: { codigo, versao: { increment: 1 } } });
      await historico(tx, autor, "CODIGO_PRODUTO", p.id, { codigo: p.codigo, versao: p.versao }, { codigo, versao: p.versao + 1, origem: "ORGANIZACAO_ADMINISTRATIVA" });
      atualizados++;
    }
    if (atualizados || !isDeepStrictEqual(antes, estado)) await salvarEstado(tx, autor, antes, estado);
    return { atualizados };
  }, 20000, true);
}
