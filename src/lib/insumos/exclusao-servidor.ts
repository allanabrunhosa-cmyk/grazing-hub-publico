import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import type { VinculosExclusaoInsumo } from "./exclusao";
import { registrarAtividade } from "@/lib/atividades/registro";

export class ErroInsumoExcluido extends Error {}

export async function conferirInsumosComposicao(tx: Prisma.TransactionClient, ids: string[]) {
  // Também cobre composições em JSON, que não possuem chave estrangeira.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('insumos-composicoes'))`;
  if (ids.length && await tx.insumo.count({ where: { id: { in: [...new Set(ids)] }, excluidoEm: null } }) !== new Set(ids).size) {
    throw new ErroInsumoExcluido("Um ingrediente foi excluído. Atualize a composição antes de salvar.");
  }
}

export async function consultarPlanoExclusaoInsumo(tx: Prisma.TransactionClient, id: string) {
  const insumo = await tx.insumo.findUnique({ where: { id }, select: {
    id: true, nome: true, updatedAt: true, excluidoEm: true,
    usadoEm: { include: { produto: { select: { id: true, nome: true } } }, orderBy: { id: "asc" } },
    componentesVenda: { include: { produto: { select: { id: true, nome: true, classificacoes: true, comoOpcao: { select: { id: true } } } } }, orderBy: { id: "asc" } },
  } });
  if (!insumo || insumo.excluidoEm) return null;
  const [opcoes, ajustes] = await Promise.all([
    tx.opcaoComplementoVenda.findMany({ where: { composicao: { array_contains: [{ insumoId: id }] } }, include: { grupo: { select: { nome: true } } }, orderBy: { id: "asc" } }),
    tx.produtoGrupoVenda.findMany({ where: { ajustesOpcoes: { array_contains: [{ composicao: [{ insumoId: id }] }] } }, include: { produto: { select: { id: true, nome: true } }, grupo: { select: { nome: true } } }, orderBy: [{ produtoId: "asc" }, { grupoId: "asc" }] }),
  ]);
  const produtos: { id: string; nome: string }[] = ajustes.map(a => a.produto);
  const complementos = opcoes.map(o => ({ id: o.id, nome: `${o.nome} (${o.grupo.nome})` }));
  for (const { produto } of insumo.componentesVenda) {
    const complemento = produto.classificacoes.some(p => p === "COMPLEMENTO" || p === "OPCAO") || produto.comoOpcao.length > 0;
    if (complemento) complementos.push({ id: produto.id, nome: produto.nome });
    if (produto.classificacoes.includes("PRINCIPAL") || !complemento) produtos.push({ id: produto.id, nome: produto.nome });
  }
  const ordenar = (itens: { id: string; nome: string }[]) => [...new Map(itens.map(i => [i.id, i])).values()].sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR") || a.id.localeCompare(b.id));
  const revisao = createHash("sha256").update(JSON.stringify({ id, atualizadoEm: insumo.updatedAt, usadoEm: insumo.usadoEm, componentesVenda: insumo.componentesVenda, opcoes, ajustes })).digest("hex");
  const vinculos: VinculosExclusaoInsumo = { preparacoes: ordenar(insumo.usadoEm.map(c => c.produto)), produtos: ordenar(produtos), complementos: ordenar(complementos), outrosVinculos: false, revisao };
  return { insumo, opcoes, ajustes, vinculos };
}

function semInsumo(valor: Prisma.JsonValue, id: string): Prisma.InputJsonValue {
  return (Array.isArray(valor) ? valor.filter(c => !c || typeof c !== "object" || Array.isArray(c) || c.insumoId !== id) : valor) as Prisma.InputJsonValue;
}

export async function excluirInsumoPreservandoHistorico(tx: Prisma.TransactionClient, id: string, revisao: string | undefined, sessao: SessaoAtual) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new Error("Sua sessão expirou. Entre novamente.");
  if (usuario.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, (usuario.permissoesPersonalizadas ?? {}) as Excecoes, "insumos", "excluir")) throw new Error("Seu acesso não permite excluir insumos.");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
  await conferirInsumosComposicao(tx, []);
  await tx.$queryRaw`SELECT "id" FROM "Insumo" WHERE "id" = ${id} FOR UPDATE`;
  const plano = await consultarPlanoExclusaoInsumo(tx, id);
  if (!plano) return { error: null };
  if (revisao !== plano.vinculos.revisao) return { error: "O cadastro ou suas composições mudaram. Confira a lista atualizada e confirme novamente.", vinculos: plano.vinculos };
  const produtos = [...new Set([...plano.insumo.componentesVenda.map(c => c.produtoId), ...plano.ajustes.map(a => a.produtoId)])];
  for (const o of plano.opcoes) await tx.opcaoComplementoVenda.update({ where: { id: o.id }, data: { composicao: semInsumo(o.composicao!, id) } });
  for (const a of plano.ajustes) {
    const atualizado = (a.ajustesOpcoes as Prisma.JsonArray).map(valor => {
      if (!valor || typeof valor !== "object" || Array.isArray(valor) || !Array.isArray(valor.composicao)) return valor;
      return { ...valor, composicao: semInsumo(valor.composicao, id) };
    });
    await tx.produtoGrupoVenda.update({ where: { produtoId_grupoId: { produtoId: a.produtoId, grupoId: a.grupoId } }, data: { ajustesOpcoes: atualizado as Prisma.InputJsonValue } });
  }
  await tx.composicaoInsumo.deleteMany({ where: { componenteId: id } });
  await tx.componenteProdutoVenda.deleteMany({ where: { insumoId: id } });
  if (produtos.length) await tx.produtoVenda.updateMany({ where: { id: { in: produtos } }, data: { versao: { increment: 1 } } });
  const grupos = [...new Set(plano.opcoes.map(o => o.grupoId))];
  if (grupos.length) await tx.grupoComplementoVenda.updateMany({ where: { id: { in: grupos } }, data: { versao: { increment: 1 } } });
  // Conserva os vínculos retirados e quantidades decimais como fotografia auditável.
  const snapshot = JSON.parse(JSON.stringify({ autorId: usuario.id, autorNome: usuario.nome, vinculos: plano.vinculos, preparacoes: plano.insumo.usadoEm, componentesVenda: plano.insumo.componentesVenda, opcoes: plano.opcoes, ajustes: plano.ajustes }));
  await tx.insumo.update({ where: { id }, data: { ativo: false, excluidoEm: new Date(), excluidoPorId: usuario.id, exclusaoSnapshot: snapshot } });
  // O snapshot durável pertence ao Insumo; a atividade guarda apenas o fato e sua referência.
  await registrarAtividade(tx, { userId: usuario.id, nome: usuario.nome }, { modulo: "insumos", recurso: "insumos", acao: "INSUMO_EXCLUIDO",
    entidade: "Insumo", entidadeId: id, resumo: "Insumo excluído com vínculos e histórico preservados.", deduplicacao: `insumo-excluido:${id}` });
  return { error: null };
}
