import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "./pedidos";
import { ErroPedidoVenda } from "./pedidos-dominio";

export async function vincularDocumentoExternoPedido(pedidoId: string, emissor: string, referencia: string, evidencia: string, sessao: SessaoAtual) {
  if ([emissor, referencia, evidencia].some(v => typeof v !== "string" || !v.trim() || v.length > 200)) throw new ErroPedidoVenda("Informe emissor, identificação e referência da evidência, até 200 caracteres cada.");
  emissor = emissor.trim(); referencia = referencia.trim(); evidencia = evidencia.trim();
  const chave = `fiscal-externo-${createHash("sha256").update(JSON.stringify([emissor, referencia])).digest("hex")}`;
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["revisar", "fiscal"], pedidoId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pedido-operacao:${chave}`}))`;
    const anterior = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: chave } });
    if (anterior) {
      if (anterior.pedidoId !== pedidoId) throw new ErroPedidoVenda("Documento já vinculado a outro pedido. Trate a divergência antes de continuar.");
      return { id: pedidoId };
    }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${pedidoId} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } });
    if (pedido.status === "RASCUNHO") throw new ErroPedidoVenda("Confirme o pedido antes de vincular documento externo.");
    await tx.pedidoVenda.update({ where: { id: pedidoId }, data: { versao: { increment: 1 } } });
    await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: "DOCUMENTO_FISCAL_EXTERNO", chaveOperacao: chave, hashOperacao: chave, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: pedido.versao, versaoNova: pedido.versao + 1, depois: { emissor, referencia, evidencia, emissaoPeloHub: false } } });
    return { id: pedidoId };
  });
}
