import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { ErroCadastroVenda } from "./dominio";
import { historico } from "./persistencia";

export type CanalEntrada = { id?: string; versao?: number; nome: string; categoriaReceitaId: string; categoriaDevolucaoId?: string | null; chave: string };

export async function salvarCanalVenda(entrada: CanalEntrada, sessao: SessaoAtual) {
  const nome = typeof entrada?.nome === "string" ? entrada.nome.trim().toLocaleUpperCase("pt-BR") : "";
  if (!nome || nome.length > 60 || /[\u0000-\u001f\u007f]/.test(nome)) throw new ErroCadastroVenda("Informe o canal com até 60 caracteres, sem caracteres de controle.");
  if (typeof entrada.categoriaReceitaId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(entrada.categoriaReceitaId)) throw new ErroCadastroVenda("Selecione a categoria de receita do canal.");
  if (typeof entrada.chave !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(entrada.chave)) throw new ErroCadastroVenda("Chave da operação inválida.");
  if (entrada.id && (typeof entrada.id !== "string" || entrada.id.length > 100 || !Number.isSafeInteger(entrada.versao) || entrada.versao! < 1)) throw new ErroCadastroVenda("Versão do canal inválida.");
  const dados = { id: entrada.id ?? null, versao: entrada.versao ?? null, nome, categoriaReceitaId: entrada.categoriaReceitaId, ...(entrada.categoriaDevolucaoId !== undefined ? {categoriaDevolucaoId:entrada.categoriaDevolucaoId} : {}) };
  const hash = createHash("sha256").update(JSON.stringify(dados)).digest("hex");
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
    if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroCadastroVenda("Sua sessão foi encerrada.");
    if (usuario.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva(usuario.perfilAcesso?.permissoes as Permissoes ?? {}, usuario.permissoesPersonalizadas as Excecoes, "vendas.produtos", "editar")) throw new ErroCadastroVenda("Seu acesso não permite configurar canais.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    const repetida = await tx.historicoCadastroVenda.findFirst({ where: { entidade: "CANAL_VENDA", depois: { path: ["chave"], equals: entrada.chave } } });
    if (repetida) {
      if ((repetida.depois as { hash: string }).hash !== hash || repetida.usuarioId !== usuario.id) throw new ErroCadastroVenda("Esta chave já foi usada com outros dados.");
      return { id: repetida.registroId };
    }
    // Pedidos novos usam esta categoria na receita; títulos já criados conservam a sua.
    const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: entrada.categoriaReceitaId } });
    if (!categoria?.ativo || categoria.excluidoEm || categoria.grupo !== "RECEITA_BRUTA") throw new ErroCadastroVenda("Escolha uma categoria ativa de receita bruta.");
    const antes = entrada.id ? await tx.canalVenda.findUnique({ where: { id: entrada.id } }) : null;
    if (entrada.id && (!antes || antes.versao !== entrada.versao)) throw new ErroCadastroVenda("O canal mudou. Reabra para conferir antes de salvar.");
    if (await tx.canalVenda.count({ where: { nome, ...(antes ? { id: { not: antes.id } } : {}) } })) throw new ErroCadastroVenda("Este canal já está cadastrado.");
    const devolucaoId = entrada.categoriaDevolucaoId === undefined ? antes?.categoriaDevolucaoId ?? null : entrada.categoriaDevolucaoId || null;
    if (devolucaoId) {
      if (typeof devolucaoId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(devolucaoId)) throw new ErroCadastroVenda("Categoria de devolução inválida.");
      const devolucao = await tx.categoriaFinanceira.findUnique({ where: { id: devolucaoId } });
      if (!devolucao?.ativo || devolucao.excluidoEm || devolucao.grupo !== "DEDUCOES_RECEITA") throw new ErroCadastroVenda("Escolha uma categoria ativa de deduções da receita para devoluções.");
    }
    const maior = antes ? null : await tx.canalVenda.aggregate({ _max: { ordem: true } });
    const depois = antes
      ? await tx.canalVenda.update({ where: { id: antes.id }, data: { nome, categoriaDevolucaoId: devolucaoId, categoriaReceitaId: categoria.id, versao: { increment: 1 } } })
      : await tx.canalVenda.create({ data: { nome, categoriaDevolucaoId: devolucaoId, categoriaReceitaId: categoria.id, ordem: (maior?._max.ordem ?? -1) + 1 } });
    await historico(tx, { userId: usuario.id, nome: usuario.nome }, "CANAL_VENDA", depois.id, antes, { ...depois, chave: entrada.chave, hash });
    return { id: depois.id };
  });
}
