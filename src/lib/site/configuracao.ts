import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { ErroSite, objeto, texto } from "./adaptador";
import { baseSite, chamarSite, metasEntregaSite, segredoWebhookSite, siteAtivo, siteConfigurado } from "./cliente";

/** Configurar integrações é exclusivo de administradores; a sessão é relida na transação. */
export async function exigirAdministrador(tx: Prisma.TransactionClient, sessao: Pick<SessaoAtual, "userId" | "versao">) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroSite("Sessão encerrada.");
  if (u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new ErroSite("Somente administradores configuram integrações.");
  return { userId: u.id, nome: u.nome };
}

export async function estadoSite() {
  const base = baseSite(), i = await prisma.integracaoSite.findUnique({ where: { contaId: "singleton" } });
  const [pendentes, falhos, pedidos, comPendencia, canais] = await Promise.all([
    i ? prisma.eventoSite.count({ where: { integracaoId: i.id, estado: "PENDENTE" } }) : 0,
    i ? prisma.eventoSite.count({ where: { integracaoId: i.id, estado: "FALHOU" } }) : 0,
    i ? prisma.pedidoSite.count({ where: { integracaoId: i.id } }) : 0,
    i ? prisma.pedidoSite.count({ where: { integracaoId: i.id, pendencia: { not: null } } }) : 0,
    prisma.canalVenda.findMany({ select: { id: true, nome: true }, orderBy: { ordem: "asc" } }),
  ]);
  return {
    loja: base?.loja ?? null, configurado: siteConfigurado(), ligado: process.env.SITE_ATIVO === "1", operando: siteAtivo() && !!i?.ativa, webhook: !!segredoWebhookSite(),
    integracao: i ? { ativa: i.ativa, canalId: i.canalId, lojaVinculada: i.loja, ultimaColeta: i.ultimaColeta?.toISOString() ?? null, ultimoRecebimento: i.ultimoRecebimento?.toISOString() ?? null, ultimoErro: i.ultimoErro } : null,
    pendentes, falhos, pedidos, comPendencia, canais,
  };
}
export type EstadoSite = Awaited<ReturnType<typeof estadoSite>>;

/** A primeira ativação marca o ponto de partida: pedidos antigos do site não são importados. */
export async function salvarIntegracaoSite(entrada: { canalId: unknown; ativa: unknown }, sessao: SessaoAtual) {
  const base = baseSite();
  if (!base || !siteConfigurado()) throw new ErroSite("Configure no servidor o endereço e a chave de leitura do site antes de ativar.");
  if (typeof entrada.canalId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(entrada.canalId) || typeof entrada.ativa !== "boolean") throw new ErroSite("Escolha o canal de venda dos pedidos do site.");
  const canalId = entrada.canalId, ativa = entrada.ativa;
  return prisma.$transaction(async tx => {
    const autor = await exigirAdministrador(tx, sessao);
    const canal = await tx.canalVenda.findUnique({ where: { id: canalId } });
    if (!canal) throw new ErroSite("Escolha um canal de venda já cadastrado.");
    const atual = await tx.integracaoSite.findUnique({ where: { contaId: "singleton" } });
    if (atual && atual.loja !== base.loja && await tx.pedidoSite.count({ where: { integracaoId: atual.id } }) > 0) throw new ErroSite("O endereço do site mudou e já existem pedidos recebidos do endereço anterior. Trate a troca antes de continuar.");
    const i = atual
      ? await tx.integracaoSite.update({ where: { id: atual.id }, data: { canalId, ativa, loja: base.loja, proximaColeta: new Date(), ultimoErro: null } })
      : await tx.integracaoSite.create({ data: { loja: base.loja, canalId, ativa, cursor: new Date(), criadoPorId: autor.userId } });
    return { ativa: i.ativa };
  });
}

/** Confere a chave e devolve somente NOMES de campos do pedido mais recente, para calibrar a leitura. */
export async function testarSite(sessao: SessaoAtual) {
  await prisma.$transaction(tx => exigirAdministrador(tx, sessao));
  const r = await chamarSite("/orders", { per_page: "1" });
  if (!Array.isArray(r.dados)) throw new ErroSite("Listagem de pedidos do site fora do contrato.");
  if (!r.dados.length) return { ok: true as const, pedidos: 0, metas: [] as string[], dataEntrega: null as string | null, pagamento: null as string | null };
  const p = objeto(r.dados[0]), metas = Array.isArray(p.meta_data) ? p.meta_data.map(m => texto(objeto(m).key, 80)).filter(Boolean).slice(0, 80) : [];
  const alvo = metasEntregaSite().metasData.map(s => s.toLowerCase());
  return { ok: true as const, pedidos: r.paginas, metas, dataEntrega: metas.find(m => alvo.includes(m.toLowerCase())) ?? null, pagamento: texto(p.payment_method, 60) || null };
}

export async function reprocessarFalhasSite(sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await exigirAdministrador(tx, sessao);
    return (await tx.eventoSite.updateMany({ where: { estado: "FALHOU" }, data: { estado: "PENDENTE", tentativas: 0, proximaTentativa: new Date(), erro: null } })).count;
  });
}
