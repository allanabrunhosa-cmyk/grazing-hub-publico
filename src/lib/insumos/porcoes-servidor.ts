import "server-only";
import { Prisma, type Categoria, type PorcaoInsumo } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, type SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, RECURSOS_CONSULTA_PORCOES, type Acao, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { identificadorPorcaoValido, medidaPorcao, normalizarNomePorcao, validarPorcao, type PorcaoInsumoOption, type SalvarPorcaoInput } from "./porcoes";
import { validarOrdemCategoriasPorcoes, type CategoriaPorcoesOption } from "./ordem-categorias-porcoes";

export class ErroPorcao extends Error {}

export async function reordenarCategoriasPorcoes(entrada: unknown, sessao: SessaoAtual): Promise<CategoriaPorcoesOption[]> {
  const itens = validarOrdemCategoriasPorcoes(entrada);
  if ("erro" in itens) throw new ErroPorcao(itens.erro);
  return prisma.$transaction(async tx => {
    const autor = await autorPorcao(tx, sessao, "editar");
    // Impede inserção/remoção de categoria entre a conferência do conjunto e a escrita.
    await tx.$executeRaw`LOCK TABLE "Categoria" IN SHARE ROW EXCLUSIVE MODE`;
    const ordemConsulta = [{ ordemPorcoes: "asc" }, { nome: "asc" }, { id: "asc" }] satisfies Prisma.CategoriaOrderByWithRelationInput[];
    const categorias = await tx.categoria.findMany({ orderBy: ordemConsulta, include: { _count: { select: { insumos: { where: { excluidoEm: null, porcoes: { some: { excluidoEm: null } } } } } } } });
    const participantes = categorias.filter(c => c._count.insumos > 0);
    const porId = new Map(participantes.map(c => [c.id, c]));
    if (itens.length !== participantes.length || itens.some(i => !porId.has(i.id))) throw new ErroPorcao("As categorias com porções foram alteradas. Atualize a página antes de ordenar.");
    const option = (c: Categoria): CategoriaPorcoesOption => ({ id: c.id, nome: c.nome, ordem: c.ordemPorcoes, versao: c.versaoOrdemPorcoes });
    // Repetição da mesma ordem é idempotente e não duplica auditoria.
    if (itens.every((i, indice) => i.id === participantes[indice].id)) return categorias.map(option);
    if (itens.some(i => i.versao !== porId.get(i.id)!.versaoOrdemPorcoes)) throw new ErroPorcao("A ordem foi alterada por outra pessoa. Atualize a página.");
    const depois: CategoriaPorcoesOption[] = [];
    for (const [ordem, item] of itens.entries()) {
      depois.push(option(await tx.categoria.update({ where: { id: item.id }, data: { ordemPorcoes: ordem, versaoOrdemPorcoes: { increment: 1 } } })));
    }
    await tx.historicoOrdemCategoriasPorcoes.create({ data: { autorId: autor.id, autorNome: autor.nome, antes: participantes.map(option), depois } });
    // Conserva metadados das categorias sem porções para um cadastro posterior na mesma tela.
    return (await tx.categoria.findMany({ orderBy: ordemConsulta })).map(option);
  });
}

const RECURSO = "suprimentos.porcoes";
export const RECURSOS_LEITURA = RECURSOS_CONSULTA_PORCOES;

export async function recursoConsultaPorcoes() {
  const sessao = await getSession();
  return RECURSOS_LEITURA.find((recurso) => sessao && (sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "visualizar"))) ?? RECURSO;
}

async function autorPorcao(tx: Prisma.TransactionClient, sessao: SessaoAtual, acao: Acao, leituraComposicao = false) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroPorcao("Sua sessão expirou. Entre novamente.");
  const pode = (recurso: string, operacao: Acao) => usuario.perfilAcesso?.sistema === "ADMINISTRADOR"
    || permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, (usuario.permissoesPersonalizadas ?? {}) as Excecoes, recurso, operacao);
  if (leituraComposicao ? !RECURSOS_LEITURA.some((recurso) => pode(recurso, "visualizar")) : !pode(RECURSO, acao)) throw new ErroPorcao("Seu acesso não permite esta operação de porções.");
  return { id: usuario.id, nome: usuario.nome, podeCadastrar: pode(RECURSO, "adicionar") };
}

export function porcaoParaOption(porcao: PorcaoInsumo): PorcaoInsumoOption {
  return { id: porcao.id, insumoId: porcao.insumoId, nome: porcao.nome, quantidade: porcao.quantidade.toFixed(), unidade: porcao.unidade, versao: porcao.versao, ...medidaPorcao({ nome: porcao.nome, quantidadeMedida: porcao.quantidadeMedida?.toFixed(), unidadeMedida: porcao.unidadeMedida ?? undefined }) };
}

async function auditar(tx: Prisma.TransactionClient, autor: { id: string; nome: string }, acao: string, antes: PorcaoInsumo | null, depois: PorcaoInsumo) {
  const snapshot = (porcao: PorcaoInsumo) => ({ ...porcaoParaOption(porcao), excluidoEm: porcao.excluidoEm?.toISOString() ?? null });
  await tx.historicoPorcaoInsumo.create({ data: {
    porcaoId: depois.id, autorId: autor.id, autorNome: autor.nome, acao,
    ...(antes ? { antes: snapshot(antes) } : {}), depois: snapshot(depois),
  } });
}

export async function consultarPorcoes(insumoId: string, sessao: SessaoAtual) {
  if (!identificadorPorcaoValido(insumoId)) throw new ErroPorcao("Escolha um insumo válido.");
  return prisma.$transaction(async (tx) => {
    const autor = await autorPorcao(tx, sessao, "visualizar", true);
    const insumo = await tx.insumo.findUnique({ where: { id: insumoId }, select: { unidade: true, ativo: true } });
    if (!insumo?.ativo) throw new ErroPorcao("O insumo não está disponível. Atualize a página.");
    const porcoes = await tx.porcaoInsumo.findMany({ where: { insumoId, unidade: insumo.unidade, excluidoEm: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return { porcoes: porcoes.map(porcaoParaOption), podeCadastrar: autor.podeCadastrar };
  });
}

export async function salvarPorcao(entrada: SalvarPorcaoInput, sessao: SessaoAtual): Promise<PorcaoInsumoOption> {
  const validacao = validarPorcao(entrada);
  if ("erro" in validacao) throw new ErroPorcao(validacao.erro);
  const dados = validacao.porcao;
  return prisma.$transaction(async (tx) => {
    const autor = await autorPorcao(tx, sessao, dados.id ? "editar" : "adicionar");
    const anterior = dados.id ? await tx.porcaoInsumo.findUnique({ where: { id: dados.id } }) : null;
    if (dados.id && (!anterior || anterior.excluidoEm)) throw new ErroPorcao("Porção não encontrada. Atualize a página.");
    // Ordem determinística também quando uma edição muda o insumo.
    const ids = [...new Set([dados.insumoId, ...(anterior ? [anterior.insumoId] : [])])].sort();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Insumo" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
    const insumo = await tx.insumo.findUnique({ where: { id: dados.insumoId }, select: { unidade: true, ativo: true } });
    if (!insumo?.ativo) throw new ErroPorcao("Escolha um insumo ativo.");
    if (insumo.unidade !== dados.unidade) throw new ErroPorcao("A unidade do insumo foi alterada. Atualize a página antes de salvar a porção.");
    const existente = await tx.porcaoInsumo.findUnique({ where: { insumoId_unidade_nomeNormalizado: { insumoId: dados.insumoId, unidade: dados.unidade, nomeNormalizado: dados.nomeNormalizado } } });
    if (existente && !existente.excluidoEm && existente.id !== dados.id) {
      const medida = medidaPorcao(porcaoParaOption(existente));
      if (!dados.id && existente.quantidade.equals(dados.quantidade) && medida.quantidadeMedida === dados.quantidadeMedida && normalizarNomePorcao(medida.unidadeMedida) === normalizarNomePorcao(dados.unidadeMedida!)) return porcaoParaOption(existente);
      throw new ErroPorcao("Já existe uma porção com esse nome para o insumo. Escolha outro nome ou edite a porção existente.");
    }
    if (dados.id && existente && existente.id !== dados.id) throw new ErroPorcao("Esse nome já foi usado em outra porção. Escolha outro nome.");
    const payload = { insumoId: dados.insumoId, unidade: dados.unidade, nome: dados.nome, nomeNormalizado: dados.nomeNormalizado, quantidade: new Prisma.Decimal(dados.quantidade), quantidadeMedida: new Prisma.Decimal(dados.quantidadeMedida!), unidadeMedida: dados.unidadeMedida! };
    if (anterior) {
      const alterada = await tx.porcaoInsumo.updateMany({ where: { id: anterior.id, versao: dados.versao, excluidoEm: null }, data: { ...payload, versao: { increment: 1 } } });
      if (alterada.count !== 1) throw new ErroPorcao("Esta porção foi alterada por outra pessoa. Atualize a página.");
      const salva = await tx.porcaoInsumo.findUniqueOrThrow({ where: { id: anterior.id } });
      await auditar(tx, autor, "EDITAR", anterior, salva);
      return porcaoParaOption(salva);
    }
    const salva = existente
      ? await tx.porcaoInsumo.update({ where: { id: existente.id }, data: { ...payload, excluidoEm: null, versao: { increment: 1 } } })
      : await tx.porcaoInsumo.create({ data: payload });
    await auditar(tx, autor, existente ? "RECADASTRAR" : "CRIAR", existente, salva);
    return porcaoParaOption(salva);
  });
}

export async function removerPorcao(entrada: { id: string; versao: number }, sessao: SessaoAtual): Promise<void> {
  if (!entrada || !identificadorPorcaoValido(entrada.id) || !Number.isSafeInteger(entrada.versao) || entrada.versao < 1) throw new ErroPorcao("Porção ou versão inválida. Atualize a página.");
  await prisma.$transaction(async (tx) => {
    const autor = await autorPorcao(tx, sessao, "excluir");
    await tx.$queryRaw`SELECT "id" FROM "PorcaoInsumo" WHERE "id" = ${entrada.id} FOR UPDATE`;
    const anterior = await tx.porcaoInsumo.findUnique({ where: { id: entrada.id } });
    if (!anterior) throw new ErroPorcao("Porção não encontrada. Atualize a página.");
    if (anterior.excluidoEm && anterior.versao === entrada.versao + 1) return;
    if (anterior.excluidoEm || anterior.versao !== entrada.versao) throw new ErroPorcao("Esta porção foi alterada por outra pessoa. Atualize a página.");
    const removida = await tx.porcaoInsumo.update({ where: { id: anterior.id }, data: { excluidoEm: new Date(), versao: { increment: 1 } } });
    await auditar(tx, autor, "EXCLUIR", anterior, removida);
  });
}
