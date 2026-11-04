"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, type SessaoAtual } from "@/lib/session";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { chaveCompra } from "@/lib/financeiro/cancelamento-compra";
import { manifestarNotaFiscal } from "@/lib/sefaz/manifestar";
import { validarTratamentoLocalNota, type EntradaTratamentoLocalNota } from "@/lib/notas-fiscais/tratamento-local";

const selecaoNota = {
  id: true, chaveAcesso: true, tipo: true, xml: true, ultimaManifestacao: true,
  tratamentoLocal: true, dataDevolucao: true, motivoTratamentoLocal: true,
  tratamentoLocalEm: true, tratamentoLocalVersao: true,
} satisfies Prisma.NotaFiscalRecebidaSelect;
type NotaTratamento = Prisma.NotaFiscalRecebidaGetPayload<{ select: typeof selecaoNota }>;
type EntradaValidada = Exclude<ReturnType<typeof validarTratamentoLocalNota>, { erro: string }>;
type ResultadoTratamento = { ok: true; versao: number } | { erro: string };
class ErroTratamentoNota extends Error {}
const json = (valor: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valor));
const dia = (data: Date | null) => data?.toISOString().slice(0, 10) ?? null;

async function conferirAutor(tx: Prisma.TransactionClient, sessao: SessaoAtual) {
  // A trava mantém a autorização estável até o fim da coordenação fiscal.
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))");
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || !usuario.senhaDefinida || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) {
    throw new ErroTratamentoNota("Sua sessão expirou. Entre novamente.");
  }
  const pode = (recurso: string, acao: "visualizar" | "editar") => usuario.perfilAcesso?.sistema === "ADMINISTRADOR"
    || permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, (usuario.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao);
  if (!pode("notas", "visualizar") || !pode("notas.manifestar", "editar")) {
    throw new ErroTratamentoNota("Sem permissão para tratar esta nota.");
  }
  return usuario.id;
}

async function conferirEfeitos(tx: Prisma.TransactionClient, nota: NotaTratamento) {
  if (await tx.cancelamentoCompra.findUnique({ where: { chaveOrigem: chaveCompra({ tipo: "NOTA", id: nota.id }) } })) {
    throw new ErroTratamentoNota("Esta compra foi cancelada. O tratamento da nota não pode recriar ou ocultar seus efeitos.");
  }
  const efeitos = await tx.notaFiscalItem.count({ where: { notaFiscalId: nota.id,
    OR: [{ status: "CONCILIADO" }, { movimentacaoEstoqueId: { not: null } }, { lancamentos: { some: {} } }],
  } });
  if (efeitos) throw new ErroTratamentoNota("Esta nota já gerou conciliação, estoque ou financeiro. Confira os efeitos da compra antes de alterar seu tratamento.");
}

async function conferirRepeticao(tx: Prisma.TransactionClient, nota: NotaTratamento, entrada: EntradaValidada, autorId: string) {
  const versaoCompativel = nota.tratamentoLocalVersao === entrada.versao || nota.tratamentoLocalVersao === entrada.versao + 1;
  if (!versaoCompativel) return false;
  if (entrada.acao === "REABRIR") {
    if (nota.tratamentoLocal !== null || nota.tratamentoLocalVersao !== entrada.versao + 1) return false;
    const ultimo = await tx.historicoAcesso.findFirst({ where: { entidade: "NOTA_FISCAL_RECEBIDA", entidadeId: nota.id, acao: "REABRIR_NOTA" }, orderBy: { createdAt: "desc" } });
    const dados = ultimo?.depois;
    return ultimo?.autorId === autorId && !!dados && typeof dados === "object" && !Array.isArray(dados)
      && dados.versaoBase === entrada.versao && dados.versao === nota.tratamentoLocalVersao && dados.motivo === entrada.motivo;
  }
  const tratamento = entrada.acao === "DEVOLUCAO" ? "DEVOLUCAO_REGISTRADA" : "IGNORADA";
  return nota.tratamentoLocal === tratamento && nota.motivoTratamentoLocal === entrada.motivo
    && dia(nota.dataDevolucao) === dia(entrada.dataDevolucao);
}

async function gravarTratamento(tx: Prisma.TransactionClient, entrada: EntradaValidada, autorId: string): Promise<ResultadoTratamento> {
  await tx.$queryRaw`SELECT id FROM "NotaFiscalRecebida" WHERE id = ${entrada.notaFiscalId} FOR UPDATE`;
  const nota = await tx.notaFiscalRecebida.findUnique({ where: { id: entrada.notaFiscalId }, select: selecaoNota });
  if (!nota) throw new ErroTratamentoNota("Nota fiscal não encontrada.");
  await conferirEfeitos(tx, nota);
  if (await conferirRepeticao(tx, nota, entrada, autorId)) return { ok: true, versao: nota.tratamentoLocalVersao };
  if (nota.tratamentoLocalVersao !== entrada.versao) throw new ErroTratamentoNota("Esta nota foi alterada. Reabra o painel antes de continuar.");
  if (entrada.acao === "REABRIR" && !nota.tratamentoLocal) throw new ErroTratamentoNota("Esta nota já está aberta para conferência.");
  if (entrada.acao !== "REABRIR" && nota.tratamentoLocal) throw new ErroTratamentoNota("Reabra o tratamento atual antes de escolher outro.");
  if (entrada.acao === "DEVOLUCAO" && nota.ultimaManifestacao !== "CONFIRMACAO_DA_OPERACAO") {
    throw new ErroTratamentoNota("A confirmação fiscal ainda não foi comprovada. Confira o histórico antes de continuar.");
  }
  const versao = nota.tratamentoLocalVersao + 1;
  const tratamentoLocal = entrada.acao === "REABRIR" ? null : entrada.acao === "DEVOLUCAO" ? "DEVOLUCAO_REGISTRADA" : "IGNORADA";
  const campos = {
    tratamentoLocal, dataDevolucao: entrada.acao === "DEVOLUCAO" ? entrada.dataDevolucao : null,
    motivoTratamentoLocal: tratamentoLocal ? entrada.motivo : null, tratamentoLocalEm: tratamentoLocal ? new Date() : null,
    tratamentoLocalVersao: versao,
  } as const;
  const atualizacao = await tx.notaFiscalRecebida.updateMany({ where: { id: nota.id, tratamentoLocalVersao: entrada.versao }, data: campos });
  if (atualizacao.count !== 1) throw new ErroTratamentoNota("Esta nota foi alterada. Reabra o painel antes de continuar.");
  await tx.historicoAcesso.create({ data: {
    autorId, entidade: "NOTA_FISCAL_RECEBIDA", entidadeId: nota.id,
    acao: entrada.acao === "REABRIR" ? "REABRIR_NOTA" : entrada.acao === "IGNORAR" ? "IGNORAR_NOTA" : "DEVOLUCAO_REGISTRADA",
    antes: json({ tratamentoLocal: nota.tratamentoLocal, dataDevolucao: dia(nota.dataDevolucao), motivo: nota.motivoTratamentoLocal, em: nota.tratamentoLocalEm, versao: nota.tratamentoLocalVersao }),
    depois: json({ ...campos, dataDevolucao: dia(campos.dataDevolucao), motivo: entrada.motivo, versaoBase: entrada.versao, versao }),
  } });
  return { ok: true, versao };
}

export async function tratarOutraOperacaoNotaAction(entrada: EntradaTratamentoLocalNota): Promise<ResultadoTratamento> {
  await exigirPermissao("notas.manifestar", "editar");
  await exigirPermissao("notas", "visualizar");
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  const dados = validarTratamentoLocalNota(entrada);
  if ("erro" in dados) return dados;
  let confirmacaoRegistrada = false;
  try {
    // Mantém somente coordenação/autorização durante o envio. O registro SEFAZ
    // usa sua própria transação e não depende do sucesso da gravação local.
    const resultado = await prisma.$transaction(async tx => {
      const [trava] = await tx.$queryRaw<{ obtida: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${dados.notaFiscalId})) AS obtida
      `;
      if (!trava?.obtida) return { erro: "Esta nota já está sendo atualizada. Aguarde e confira o status." };
      const autorId = await conferirAutor(tx, sessao);
      const nota = await tx.notaFiscalRecebida.findUnique({ where: { id: dados.notaFiscalId }, select: selecaoNota });
      if (!nota) return { erro: "Nota fiscal não encontrada." };
      await conferirEfeitos(tx, nota);
      if (await conferirRepeticao(tx, nota, dados, autorId)) return { ok: true as const, versao: nota.tratamentoLocalVersao };
      if (nota.tratamentoLocalVersao !== dados.versao) return { erro: "Esta nota foi alterada. Reabra o painel antes de continuar." };
      if (dados.acao === "REABRIR" && !nota.tratamentoLocal) return { erro: "Esta nota já está aberta para conferência." };
      if (dados.acao !== "REABRIR" && nota.tratamentoLocal) return { erro: "Reabra o tratamento atual antes de escolher outro." };
      if (dados.acao === "DEVOLUCAO") {
        if (nota.ultimaManifestacao === "DESCONHECIMENTO_DA_OPERACAO" || nota.ultimaManifestacao === "OPERACAO_NAO_REALIZADA") return { erro: "Esta nota foi recusada. Confira o histórico fiscal antes de registrar uma devolução." };
        if (nota.tipo !== "PROC_NFE" || !nota.xml) return { erro: "Importe o XML completo antes de registrar a devolução." };
        confirmacaoRegistrada = nota.ultimaManifestacao === "CONFIRMACAO_DA_OPERACAO";
        if (!confirmacaoRegistrada) {
          const fiscal = await manifestarNotaFiscal(nota.chaveAcesso, "CONFIRMACAO_DA_OPERACAO");
          if (!fiscal.sucesso) return { erro: fiscal.mensagem };
          confirmacaoRegistrada = true;
        }
      }
      // O lock de linha dura somente a gravação local, após a resposta externa.
      return prisma.$transaction(local => gravarTratamento(local, dados, autorId));
    }, { timeout: 90_000, maxWait: 5_000 });
    revalidatePath("/notas-fiscais");
    return resultado;
  } catch (erro) {
    revalidatePath("/notas-fiscais");
    const detalhe = erro instanceof ErroTratamentoNota ? erro.message : "Não foi possível concluir o tratamento da nota.";
    return { erro: confirmacaoRegistrada
      ? `A confirmação fiscal já foi registrada, mas o tratamento local ficou pendente. ${detalhe} Reabra e repita o registro da devolução para concluir sem reenviar à SEFAZ.`
      : detalhe };
  }
}
