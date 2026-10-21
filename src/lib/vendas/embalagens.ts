import "server-only";
import { prisma } from "@/lib/prisma";
import { autorEntregas } from "./entregas";
import { historico } from "./persistencia";
import { ErroPedidoVenda } from "./pedidos-dominio";
import type { SessaoAtual } from "@/lib/session";

export type TipoEmbalagem = { id: string; nome: string; ativo: boolean; versao: number };
export async function salvarTipoEmbalagem(valor: unknown, sessao: SessaoAtual): Promise<TipoEmbalagem> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new ErroPedidoVenda("Tipo de embalagem inválido.");
  const d = valor as Record<string, unknown>;
  if (typeof d.id !== "string" || d.id.length > 100 || typeof d.nome !== "string" || !d.nome.trim() || d.nome.length > 80 || typeof d.ativo !== "boolean" || !Number.isSafeInteger(d.versao) || Number(d.versao) < 0) throw new ErroPedidoVenda("Informe nome da embalagem com até 80 caracteres e versão válida.");
  const id = d.id, nome = d.nome.trim().normalize("NFC"), ativo = d.ativo, versao = Number(d.versao);
  return prisma.$transaction(async tx => {
    const autor = await autorEntregas(tx, sessao, "vendas.catalogo", id ? "editar" : "adicionar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('embalagens-venda'))`;
    const antes = id ? await tx.tipoEmbalagemVenda.findUnique({ where: { id } }) : null;
    if (id && (!antes || antes.versao !== versao)) throw new ErroPedidoVenda("Embalagem alterada em outra tela. Reabra antes de salvar.");
    const duplicado = await tx.tipoEmbalagemVenda.findFirst({ where: { nome: { equals: nome, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
    if (duplicado) throw new ErroPedidoVenda("Já existe um tipo de embalagem com esse nome.");
    if (!ativo) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('entregas-config'))`;
      const config = (await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { entregas: true } }))?.entregas as { regrasVeiculo?: { ativo: boolean; tipoEmbalagemId: string }[] } | null;
      if (config?.regrasVeiculo?.some(r => r.ativo && r.tipoEmbalagemId === id)) throw new ErroPedidoVenda("Inative a regra de veículo desta embalagem antes de inativar o tipo.");
    }
    const salvo = id ? await tx.tipoEmbalagemVenda.update({ where: { id }, data: { nome, ativo, versao: { increment: 1 } } }) : await tx.tipoEmbalagemVenda.create({ data: { nome, ativo } });
    await historico(tx, autor, "TIPO_EMBALAGEM", salvo.id, antes, salvo);
    return { id: salvo.id, nome: salvo.nome, ativo: salvo.ativo, versao: salvo.versao };
  });
}
