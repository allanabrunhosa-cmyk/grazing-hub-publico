"use server";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { getSession } from "@/lib/session";
import { validarTextoObrigatorio, validarChaveIdempotencia } from "@/lib/etiquetas/validacao";
const CAMINHO = "/producao/etiquetas";
const LOJA = "singleton";
function mensagem(erro: unknown) {
  return { erro: erro instanceof Error && !erro.name.startsWith("Prisma") ? erro.message : "Não foi possível salvar. Atualize e tente novamente." };
}
async function administrador() {
  const sessao = await getSession();
  if (!sessao?.admin) throw new Error("A configuração exige administrador ativo.");
  return sessao;
}
export async function excluirPontoImpressaoAction(pontoId: string) {
  await exigirPermissao("producao", "excluir");
  try {
    const ator = await administrador();
    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${pontoId}))::text AS trava`);
      const ponto = await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA } });
      if (!ponto) throw new Error("Ponto não encontrado.");
      if (ponto.excluidoEm) return;
      if (ponto.padrao) throw new Error("Defina outro ponto padrão antes de excluir este ponto.");
      if (await tx.envioPontoImpressao.count({ where: { pontoId, estado: { in: ["PENDENTE", "RESERVADO", "INCERTO"] } } })) throw new Error("Confira os envios pendentes ou incertos antes de excluir o ponto.");
      const agora = new Date();
      await tx.pontoImpressao.update({ where: { id: pontoId }, data: { excluidoEm: agora, ativo: false, padrao: false } });
      await tx.dispositivoImpressao.updateMany({ where: { pontoId, revogadoEm: null }, data: { revogadoEm: agora } });
      await tx.codigoVinculoImpressao.updateMany({ where: { pontoId, usadoEm: null }, data: { usadoEm: agora } });
      await tx.eventoAuditoriaEtiqueta.create({ data: { lojaId: LOJA, entidade: "PontoImpressao", entidadeId: pontoId, acao: "PONTO_EXCLUIDO", usuarioId: ator.userId, detalhes: { historicoPreservado: true } } });
    });
    revalidatePath(CAMINHO);
    return { ok: true as const };
  } catch (erro) { return mensagem(erro); }
}
export async function baixarEtiquetaAction(entrada: { trabalhoId: string; quantidade: number; chaveIdempotencia: string }) {
  await exigirPermissao("producao.validades", "editar");
  try {
    const ator = await getSession();
    if (!ator) throw new Error("Sessão expirada.");
    const chave = validarChaveIdempotencia(entrada.chaveIdempotencia);
    if (!Number.isInteger(entrada.quantidade) || entrada.quantidade < 1) throw new Error("Informe uma quantidade inteira positiva.");
    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`envio:${entrada.trabalhoId}`}))::text AS trava`);
      const anterior = await tx.eventoAuditoriaEtiqueta.findFirst({ where: { lojaId: LOJA, entidadeId: entrada.trabalhoId, acao: "ETIQUETA_BAIXADA", detalhes: { path: ["chaveIdempotencia"], equals: chave } } });
      if (anterior) {
        const detalhes = anterior.detalhes as { quantidade: number };
        if (anterior.usuarioId !== ator.userId || detalhes.quantidade !== entrada.quantidade) throw new Error("Solicitação já utilizada com outros dados.");
        return;
      }
      const trabalho = await tx.trabalhoEtiqueta.findFirst({ where: { id: entrada.trabalhoId, lojaId: LOJA } });
      if (!trabalho) throw new Error("Etiqueta não encontrada.");
      if (await tx.envioPontoImpressao.count({ where: { trabalhoId: trabalho.id, estado: { in: ["PENDENTE", "RESERVADO"] } } })) throw new Error("Aguarde a conclusão do envio à impressora antes de dar baixa.");
      if (entrada.quantidade > trabalho.copias - trabalho.copiasBaixadas) throw new Error("A quantidade supera as etiquetas ainda em acompanhamento. Atualize a tela.");
      await tx.trabalhoEtiqueta.update({ where: { id: trabalho.id }, data: { copiasBaixadas: { increment: entrada.quantidade } } });
      await tx.eventoAuditoriaEtiqueta.create({ data: { lojaId: LOJA, entidade: "TrabalhoEtiqueta", entidadeId: trabalho.id, acao: "ETIQUETA_BAIXADA", usuarioId: ator.userId, detalhes: { chaveIdempotencia: chave, quantidade: entrada.quantidade, copiasBaixadas: trabalho.copiasBaixadas + entrada.quantidade } } });
    });
    revalidatePath(CAMINHO);
    return { ok: true as const };
  } catch (erro) { return mensagem(erro); }
}
export async function configurarUsuarioResponsavelAction(usuarioId: string, habilitado: boolean) {
  await exigirPermissao("producao", "editar");
  try {
    const ator = await administrador();
    if (typeof habilitado !== "boolean") throw new Error("Opção inválida.");
    await prisma.$transaction(async tx => {
      const usuario = await tx.usuario.findFirst({ where: { id: usuarioId, ativo: true, excluidoEm: null } });
      if (!usuario) throw new Error("Usuário não disponível.");
      if (usuario.responsavelEtiquetaHabilitado === habilitado) return;
      await tx.usuario.update({ where: { id: usuarioId }, data: { responsavelEtiquetaHabilitado: habilitado } });
      await tx.eventoAuditoriaEtiqueta.create({ data: { lojaId: LOJA, entidade: "Usuario", entidadeId: usuarioId, acao: "RESPONSAVEL_CONFIGURADO", usuarioId: ator.userId, detalhes: { habilitado } } });
    });
    revalidatePath(CAMINHO);
    return { ok: true as const };
  } catch (erro) { return mensagem(erro); }
}
export async function salvarResponsavelEtiquetaAction(entrada: { id?: string; nome: string; ativo: boolean }) {
  await exigirPermissao("producao", "editar");
  try {
    const ator = await administrador();
    const nome = validarTextoObrigatorio(entrada.nome, "O nome", 120);
    if (/[\u0000-\u001f\u007f]/.test(nome) || typeof entrada.ativo !== "boolean") throw new Error("Nome ou opção inválida.");
    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`responsavel:${nome.toLocaleLowerCase("pt-BR")}`}))::text AS trava`);
      const duplicado = await tx.responsavelEtiqueta.findFirst({ where: { lojaId: LOJA, nome: { equals: nome, mode: "insensitive" }, ...(entrada.id ? { id: { not: entrada.id } } : {}) } });
      if (duplicado) throw new Error("Este responsável já está cadastrado. Edite o cadastro existente.");
      if (entrada.id && !await tx.responsavelEtiqueta.findFirst({ where: { id: entrada.id, lojaId: LOJA } })) throw new Error("Responsável não encontrado.");
      const salvo = entrada.id
        ? await tx.responsavelEtiqueta.update({ where: { id: entrada.id }, data: { nome, ativo: entrada.ativo } })
        : await tx.responsavelEtiqueta.create({ data: { lojaId: LOJA, nome, ativo: entrada.ativo } });
      await tx.eventoAuditoriaEtiqueta.create({ data: { lojaId: LOJA, entidade: "ResponsavelEtiqueta", entidadeId: salvo.id, acao: "RESPONSAVEL_CONFIGURADO", usuarioId: ator.userId, detalhes: { ativo: entrada.ativo, cadastro: true } } });
    });
    revalidatePath(CAMINHO);
    return { ok: true as const };
  } catch (erro) { return mensagem(erro); }
}

export async function restaurarPontoImpressaoAction(pontoId: string) {
  await exigirPermissao("producao", "editar");
  try {
    const ator = await administrador();
    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${pontoId}))::text AS trava`);
      const ponto = await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA } });
      if (!ponto) throw new Error("Ponto não encontrado.");
      if (!ponto.excluidoEm) return;
      // Recupera só o cadastro. A credencial revogada exige um vínculo novo.
      await tx.pontoImpressao.update({ where: { id: pontoId }, data: { excluidoEm: null, ativo: false, padrao: false } });
      await tx.eventoAuditoriaEtiqueta.create({ data: { lojaId: LOJA, entidade: "PontoImpressao", entidadeId: pontoId, acao: "PONTO_RESTAURADO", usuarioId: ator.userId, detalhes: { ativo: false, novoVinculoNecessario: true } } });
    });
    revalidatePath(CAMINHO); return { ok: true as const };
  } catch (erro) { return mensagem(erro); }
}
