"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ORDEM_GRUPOS_DRE } from "@/lib/labels";
import { naturezaFinanceiraDoGrupo } from "@/lib/financeiro/natureza-financeira";
import { cabeNoLimiteDeTresNiveis, idsDoRamoCategoria } from "@/lib/financeiro/hierarquia-categorias";
import type { GrupoDre } from "@/generated/prisma/client";

export type ResultadoCategoriaFinanceira = { erro: string } | { ok: true };
export type ResultadoExclusaoCategoriaFinanceira = { erro: string } | { ok: true; transferidos: number };

const NENHUM = "__nenhum__";

async function usuarioAtivo() {
  const sessao = await getSession();
  if (!sessao) return false;
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.userId }, select: { ativo: true } });
  return usuario?.ativo === true;
}

function revalidarPlano() {
  for (const caminho of ["/financeiro/plano-de-contas", "/financeiro", "/financeiro/movimentacoes", "/financeiro/fluxo-de-caixa", "/financeiro/cartoes", "/notas-fiscais"]) revalidatePath(caminho);
}

function optionalId(value: FormDataEntryValue | null) {
  const texto = String(value ?? "").trim();
  return texto === "" || texto === NENHUM ? null : texto;
}

export async function criarCategoriaFinanceiraAction(_prevState: unknown, formData: FormData): Promise<ResultadoCategoriaFinanceira> {
  await exigirPermissao("financeiro.plano", "adicionar");
  if (!(await usuarioAtivo())) return { erro: "Entre novamente para editar o plano de contas." };
  const nome = String(formData.get("nome") ?? "").trim();
  const grupo = String(formData.get("grupo") ?? "") as GrupoDre;
  const centroCustoId = optionalId(formData.get("centroCustoId"));
  const paiId = optionalId(formData.get("paiId"));
  if (!ORDEM_GRUPOS_DRE.includes(grupo)) return { erro: "Informe um grupo válido." };

  if (!nome) return { erro: "Informe o nome da categoria." };

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      if (paiId) {
        const pai = await tx.categoriaFinanceira.findUnique({ where: { id: paiId }, include: { pai: { select: { paiId: true } } } });
        if (!pai || pai.grupo !== grupo || !pai.ativo || pai.excluidoEm) return { erro: "Escolha uma categoria superior ativa do mesmo grupo." };
        if (pai.pai?.paiId) return { erro: "O plano permite até três níveis: categoria, subcategoria e subdivisão." };
      }
      await tx.categoriaFinanceira.create({ data: { nome, grupo, centroCustoId, paiId } });
      return { ok: true } as const;
    });
    if ("erro" in resultado) return resultado;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { erro: "Já existe uma categoria com esse nome neste nível do grupo." };
    }
    return { erro: "Não foi possível criar a categoria." };
  }

  revalidarPlano();
  return { ok: true };
}

export async function atualizarCategoriaFinanceiraAction(
  categoriaId: string,
  dados: { nome: string; centroCustoId: string | null; grupo: GrupoDre; paiId: string | null }
): Promise<ResultadoCategoriaFinanceira> {
  await exigirPermissao("financeiro.plano", "editar");
  if (!(await usuarioAtivo())) return { erro: "Entre novamente para editar o plano de contas." };
  if (!dados.nome.trim()) return { erro: "Informe o nome da categoria." };
  if (!ORDEM_GRUPOS_DRE.includes(dados.grupo)) return { erro: "Informe um grupo válido." };
  const novoPaiId = dados.paiId?.trim() || null;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const categorias = await tx.categoriaFinanceira.findMany({
        where: { excluidoEm: null },
        select: { id: true, paiId: true, grupo: true, ativo: true, excluidoEm: true },
      });
      const categoria = categorias.find((item) => item.id === categoriaId);
      if (!categoria) return { erro: "Categoria não encontrada ou já excluída." } as const;
      if (naturezaFinanceiraDoGrupo(categoria.grupo) !== naturezaFinanceiraDoGrupo(dados.grupo)) {
        return { erro: "Mova a categoria somente entre grupos da mesma natureza: entrada ou saída." } as const;
      }

      if (novoPaiId) {
        const novoPai = categorias.find((item) => item.id === novoPaiId);
        if (!novoPai || !novoPai.ativo || novoPai.excluidoEm || novoPai.grupo !== dados.grupo) {
          return { erro: "Escolha uma categoria superior ativa no grupo de destino." } as const;
        }
      }
      if (!cabeNoLimiteDeTresNiveis(categoriaId, novoPaiId, categorias)) {
        return { erro: "Esse destino criaria um ciclo ou ultrapassaria os três níveis do plano." } as const;
      }

      const idsRamo = [...idsDoRamoCategoria(categoriaId, categorias)];
      const idsDescendentes = idsRamo.filter((id) => id !== categoriaId);
      if (dados.grupo !== categoria.grupo && idsDescendentes.length > 0) {
        await tx.categoriaFinanceira.updateMany({
          where: { id: { in: idsDescendentes }, excluidoEm: null },
          data: { grupo: dados.grupo },
        });
      }
      const alteracao = await tx.categoriaFinanceira.updateMany({
        where: { id: categoriaId, excluidoEm: null },
        data: { nome: dados.nome.trim(), centroCustoId: dados.centroCustoId, grupo: dados.grupo, paiId: novoPaiId },
      });
      if (alteracao.count !== 1) return { erro: "A categoria mudou. Atualize a tela e tente novamente." } as const;
      return { ok: true } as const;
    });
    if ("erro" in resultado) return resultado;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { erro: "Já existe uma categoria com esse nome neste nível do grupo." };
    }
    return { erro: "Não foi possível salvar a categoria." };
  }

  revalidarPlano();
  return { ok: true };
}

export async function alternarAtivoCategoriaFinanceiraAction(categoriaId: string, ativo: boolean): Promise<ResultadoCategoriaFinanceira> {
  await exigirPermissao("financeiro.plano", "editar");
  if (!(await usuarioAtivo())) return { erro: "Entre novamente para editar o plano de contas." };
  if (typeof ativo !== "boolean") return { erro: "Informe uma situação válida." };
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const categoria = await tx.categoriaFinanceira.findUnique({
        where: { id: categoriaId },
        select: {
          id: true,
          excluidoEm: true,
          pai: { select: { ativo: true, excluidoEm: true, pai: { select: { ativo: true, excluidoEm: true } } } },
        },
      });
      if (!categoria || categoria.excluidoEm) return { erro: "Categoria não encontrada ou já excluída." } as const;

      if (ativo && (categoria.pai && (!categoria.pai.ativo || categoria.pai.excluidoEm)
        || categoria.pai?.pai && (!categoria.pai.pai.ativo || categoria.pai.pai.excluidoEm))) {
        return { erro: "Ative primeiro as categorias superiores." } as const;
      }

      const ids = ativo
        ? [categoria.id]
        : (await tx.categoriaFinanceira.findMany({
            where: {
              excluidoEm: null,
              OR: [{ id: categoria.id }, { paiId: categoria.id }, { pai: { paiId: categoria.id } }],
            },
            select: { id: true },
          })).map((item) => item.id);
      await tx.categoriaFinanceira.updateMany({ where: { id: { in: ids }, excluidoEm: null }, data: { ativo } });
      return { ok: true } as const;
    });
    if ("erro" in resultado) return resultado;
  } catch { return { erro: "Não foi possível atualizar a categoria." }; }
  revalidarPlano();
  return { ok: true };
}

export async function excluirCategoriaFinanceiraAction(
  categoriaId: string,
  categoriaDestinoId?: string | null,
): Promise<ResultadoExclusaoCategoriaFinanceira> {
  await exigirPermissao("financeiro.plano", "excluir");
  if (!(await usuarioAtivo())) return { erro: "Entre novamente para excluir uma categoria." };

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const categoria = await tx.categoriaFinanceira.findUnique({
        where: { id: categoriaId },
        select: { id: true, grupo: true, excluidoEm: true },
      });
      if (!categoria || categoria.excluidoEm) return { erro: "Categoria não encontrada ou já excluída." } as const;

      const quantidadeSubcategorias = await tx.categoriaFinanceira.count({
        where: { paiId: categoria.id, excluidoEm: null },
      });
      if (quantidadeSubcategorias > 0) {
        return { erro: "Exclua primeiro as subcategorias desta categoria." } as const;
      }

      const [quantidadeLancamentos, quantidadeItensNota, quantidadeItensFatura, quantidadeRegrasCartao] = await Promise.all([
        tx.lancamentoFinanceiro.count({ where: { categoriaId: categoria.id } }),
        tx.notaFiscalItem.count({ where: { categoriaFinanceiraId: categoria.id } }),
        tx.itemFaturaCartao.count({ where: { categoriaId: categoria.id } }),
        tx.regraCartao.count({ where: { categoriaId: categoria.id } }),
      ]);
      const transferidos = quantidadeLancamentos + quantidadeItensNota + quantidadeItensFatura + quantidadeRegrasCartao;

      if (transferidos > 0) {
        if (await tx.lancamentoFinanceiro.count({ where: { categoriaId: categoria.id, pedidoVendaId: { not: null } } })) {
          return { erro: "Há títulos de Pedidos nesta categoria; revise a integração antes de transferi-los." } as const;
        }
        const destinoId = String(categoriaDestinoId ?? "").trim();
        if (!destinoId || destinoId === categoria.id) {
          return { erro: "Escolha uma categoria ativa para receber as movimentações vinculadas." } as const;
        }
        const destino = await tx.categoriaFinanceira.findUnique({
          where: { id: destinoId },
          select: { id: true, grupo: true, ativo: true, excluidoEm: true },
        });
        if (!destino || !destino.ativo || destino.excluidoEm || destino.grupo !== categoria.grupo) {
          return { erro: "A categoria de destino deve estar ativa e pertencer ao mesmo grupo da DRE." } as const;
        }
        await tx.lancamentoFinanceiro.updateMany({
          where: { categoriaId: categoria.id },
          data: { categoriaId: destino.id },
        });
        await tx.notaFiscalItem.updateMany({
          where: { categoriaFinanceiraId: categoria.id },
          data: { categoriaFinanceiraId: destino.id },
        });
        await tx.itemFaturaCartao.updateMany({
          where: { categoriaId: categoria.id },
          data: { categoriaId: destino.id },
        });
        await tx.regraCartao.updateMany({
          where: { categoriaId: categoria.id },
          data: { categoriaId: destino.id },
        });
      }

      const exclusao = await tx.categoriaFinanceira.updateMany({
        where: { id: categoria.id, excluidoEm: null },
        data: { ativo: false, excluidoEm: new Date() },
      });
      if (exclusao.count !== 1) return { erro: "A categoria mudou. Atualize a tela e tente novamente." } as const;
      return { ok: true, transferidos } as const;
    });
    if ("erro" in resultado) return resultado;
    revalidarPlano();
    return resultado;
  } catch {
    return { erro: "Não foi possível excluir a categoria." };
  }
}
