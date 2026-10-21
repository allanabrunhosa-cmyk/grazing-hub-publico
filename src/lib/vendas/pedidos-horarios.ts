import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "./pedidos";
import { historico } from "./persistencia";
import { ErroPedidoVenda } from "./pedidos-dominio";
import { validarHorarios } from "./pedidos-horarios-dominio";
export async function consultarHorariosPedidos() {
  const c = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { horariosPedidos: true, versaoHorariosPedidos: true } });
  return { horarios: c?.horariosPedidos ? validarHorarios(c.horariosPedidos) : null, versao: c?.versaoHorariosPedidos ?? 0 };
}
export async function salvarHorariosPedidos(valor: unknown, versao: number, sessao: SessaoAtual, chave?: string) {
  const horarios = validarHorarios(valor);
  if (!Number.isSafeInteger(versao) || versao < 0) throw new ErroPedidoVenda("Versão inválida.");
  if (chave !== undefined && (typeof chave !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(chave))) throw new ErroPedidoVenda("Chave de operação inválida.");
  const hash = createHash("sha256").update(JSON.stringify({ horarios, versao })).digest("hex");
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["horarios"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pedidos-horarios'))`;
    const idEvento = chave ? `horarios-pedidos:${chave}` : null;
    const repetido = idEvento ? await tx.historicoCadastroVenda.findUnique({ where: { id: idEvento } }) : null;
    if (repetido) {
      const depois = repetido.depois as { hash: string; versao: number };
      if (repetido.usuarioId !== autor.userId || depois.hash !== hash) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados.");
      return { versao: depois.versao };
    }
    const antes = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" } });
    if ((antes?.versaoHorariosPedidos ?? 0) !== versao) throw new ErroPedidoVenda("Os horários foram alterados em outra tela. Reabra antes de salvar.");
    await tx.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { horariosPedidos: horarios, versaoHorariosPedidos: 1 }, update: { horariosPedidos: horarios, versaoHorariosPedidos: { increment: 1 } } });
    if (idEvento) await tx.historicoCadastroVenda.create({ data: { id: idEvento, entidade: "HORARIOS_PEDIDOS", registroId: "singleton", usuarioId: autor.userId, usuarioNome: autor.nome, antes: antes?.horariosPedidos ?? Prisma.DbNull, depois: JSON.parse(JSON.stringify({ horarios, versao: versao + 1, hash })) as Prisma.InputJsonValue } });
    else await historico(tx, autor, "HORARIOS_PEDIDOS", "singleton", antes?.horariosPedidos, horarios);
    return { versao: versao + 1 };
  });
}
