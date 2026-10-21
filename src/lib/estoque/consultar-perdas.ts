import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import type { PerdaRow, PerdaExcluidaRow } from "@/app/(protegido)/inventario/types";

const camposPerda = {
  id: true, data: true, motivo: true, motivoPersonalizado: true, quantidade: true,
  categoriaPerdaId: true, categoriaPerda: { select: { nome: true, codigoLegado: true } },
  unidade: true, valorEstimado: true, observacao: true, responsavelNome: true,
  insumo: { select: { nome: true, especificacao: true } }, local: { select: { nome: true } },
} satisfies Prisma.PerdaSelect;

function paraLinha(perda: Prisma.PerdaGetPayload<{ select: typeof camposPerda }>): PerdaRow {
  return {
    id: perda.id, data: perda.data.toISOString(), motivo: perda.motivo, motivoPersonalizado: perda.motivoPersonalizado,
    categoriaPerdaId: perda.categoriaPerdaId, categoriaNome: perda.categoriaPerda?.nome ?? null,
    quantidade: Number(perda.quantidade), unidade: perda.unidade, valorEstimado: Number(perda.valorEstimado),
    observacao: perda.observacao, responsavelNome: perda.responsavelNome,
    insumoNome: perda.insumo.nome, insumoEspecificacao: perda.insumo.especificacao, localNome: perda.local.nome,
  };
}

export async function obterUsuarioInventario() {
  const sessao = await getSession();
  if (!sessao) return null;
  return prisma.usuario.findFirst({ where: { id: sessao.userId, ativo: true }, select: { id: true, nome: true, admin: true } });
}

export async function consultarPerdas(): Promise<{ erro: string } | {
  usuario: { id: string; nome: string; admin: boolean }; linhas: PerdaRow[]; historico?: PerdaExcluidaRow[];
}> {
  const usuario = await obterUsuarioInventario();
  if (!usuario) return { erro: "Entre com um usuário ativo para consultar as perdas." };
  const perdas = await prisma.perda.findMany({ where: { excluidaEm: null }, orderBy: [{ data: "desc" }, { id: "desc" }], select: camposPerda });
  const linhas = perdas.map(paraLinha);
  if (!usuario.admin) return { usuario, linhas };

  // A consulta e seus dados nunca são enviados ao cliente de usuários comuns.
  const exclusoes = await prisma.perdaExclusao.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { motivo: true, responsavelNome: true, createdAt: true, quantidade: true, unidade: true, perda: { select: camposPerda } },
  });
  return { usuario, linhas, historico: exclusoes.map((exclusao) => ({
    ...paraLinha(exclusao.perda), excluidaEm: exclusao.createdAt.toISOString(),
    motivoExclusao: exclusao.motivo, responsavelExclusaoNome: exclusao.responsavelNome,
    quantidadeEstornada: Number(exclusao.quantidade), unidadeEstornada: exclusao.unidade,
  })) };
}
