import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { contextoExecucao } from "@/lib/contexto-execucao";
import { diferencasPermitidas } from "./privacidade";
import { MODULOS, RESULTADOS } from "./types";

export type AtorAtividade = { userId: string; nome: string } | { tipo: "SISTEMA" | "INTEGRACAO"; referencia: string; iniciadorId?: string };
type Evento = {
  modulo: typeof MODULOS[number]; recurso: string; acao: string; entidade: string; entidadeId?: string;
  usuarioAfetadoId?: string; resumo: string; resultado?: typeof RESULTADOS[number];
  categoria?: "OPERACIONAL" | "ACESSO" | "CRITICA"; correlacaoId?: string; deduplicacao?: string;
  antes?: unknown; depois?: unknown; origem?: "INTERFACE" | "API" | "MCP" | "AUTOMACAO" | "NAO_IDENTIFICADA";
  fonteTabela?: "MovimentacaoEstoque" | "Insumo"; fonteId?: string;
};
function texto(valor: string | undefined, limite: number) {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string" || !valor || valor.length > limite || /[\u0000-\u001f]/.test(valor)) throw new Error("Metadado de atividade inválido.");
  return valor;
}
/** Somente código servidor: ator é sessão/identidade validada, jamais input do navegador. */
export async function registrarAtividade(tx: Prisma.TransactionClient, ator: AtorAtividade, evento: Evento) {
  const contexto = contextoExecucao();
  if (!!evento.fonteTabela !== !!evento.fonteId || (evento.fonteTabela && (evento.antes || evento.depois))) throw new Error("Referência de atividade inválida.");
  if ("userId" in ator && contexto && ator.userId !== contexto.usuarioId) throw new Error("Autor incompatível com a identidade validada.");
  const dados = {
    autorId: "userId" in ator ? texto(ator.userId, 160) : null,
    autorNome: "userId" in ator ? texto(ator.nome.replace(/[\u0000-\u001f]/g, " ").slice(0, 120), 120) : null,
    atorTipo: "userId" in ator ? "USUARIO" : ator.tipo,
    atorReferencia: "referencia" in ator ? texto(ator.referencia, 120) : null,
    iniciadorId: "iniciadorId" in ator ? texto(ator.iniciadorId, 160) : null,
    origem: contexto ? "MCP" : evento.origem ?? ("userId" in ator ? "INTERFACE" : "AUTOMACAO"),
    modulo: evento.modulo, recurso: texto(evento.recurso, 100)!, acao: texto(evento.acao, 100)!,
    entidade: texto(evento.entidade, 80)!, entidadeId: texto(evento.entidadeId, 160),
    usuarioAfetadoId: texto(evento.usuarioAfetadoId, 160), resumo: texto(evento.resumo, 240)!,
    resultado: evento.resultado ?? "SUCESSO", categoria: evento.categoria ?? "OPERACIONAL",
    correlacaoId: texto(evento.correlacaoId, 160), deduplicacao: texto(evento.deduplicacao, 200),
    fonteTabela: evento.fonteTabela, fonteId: texto(evento.fonteId, 160),
    ...(evento.antes ? { antes: diferencasPermitidas(evento.antes, true) as Prisma.InputJsonValue } : {}),
    ...(evento.depois ? { depois: diferencasPermitidas(evento.depois, true) as Prisma.InputJsonValue } : {}),
  };
  if (!MODULOS.includes(dados.modulo) || !RESULTADOS.includes(dados.resultado)) throw new Error("Evento de atividade inválido.");
  // Conflito só em chave explícita; sem chave, cada fato recebe seu próprio id.
  if (dados.deduplicacao) await tx.atividadeUsuario.createMany({ data: [dados], skipDuplicates: true });
  else await tx.atividadeUsuario.create({ data: dados });
}
/** Contexto LOCAL à transação; o pool nunca conserva identidade entre requisições. */
export async function definirContextoAtividade(tx: Prisma.TransactionClient, origem: "INTERFACE" | "API" | "MCP" | "AUTOMACAO", correlacaoId?: string) {
  const contexto = JSON.stringify({ origem, correlacaoId: texto(correlacaoId, 160) });
  await tx.$queryRaw`SELECT set_config('grazing.atividade', ${contexto}, true)`;
}
