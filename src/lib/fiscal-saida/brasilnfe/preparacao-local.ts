import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { prepararPayloadLocalBrasilNfe, ErroPayloadLocalBrasilNfe } from "./payload-local";
import type { ModeloDocumentoBrasilNfe } from "./mapeamento";

/** Fronteira de leitura com permissões centrais reais. Sem HTTP, escrita, fila ou financeiro. */
export async function prepararDocumentoBrasilNfeLocal(documentoId: string, modelo: ModeloDocumentoBrasilNfe, parametros: unknown, sessao: SessaoAtual) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(documentoId) || ![55, 65].includes(modelo)) throw new ErroPayloadLocalBrasilNfe();
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar"]);
    const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
    if (usuario.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, usuario.permissoesPersonalizadas as Excecoes, "vendas.fiscal", "editar")) {
      throw new ErroPedidoVenda("Seu acesso não permite preparar documentos fiscais de saída.");
    }
    const documento = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documentoId }, select: { id: true, hashPayload: true, versaoPedido: true, payload: true } });
    const cadastro = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { nome: true, cnpj: true, enderecoEstruturado: true } });
    return prepararPayloadLocalBrasilNfe(documento, modelo, cadastro ?? { nome: null, cnpj: null, enderecoEstruturado: null }, parametros);
  });
}
