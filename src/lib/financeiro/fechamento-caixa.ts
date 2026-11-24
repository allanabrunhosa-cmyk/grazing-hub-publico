import type { Prisma } from "@/generated/prisma/client";
import { periodoDoMes, periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { registrarAtividade } from "@/lib/atividades/registro";
import type { SessaoAtual } from "@/lib/session";

type Tx = Prisma.TransactionClient;

/** Erro de regra: a mensagem pode ser mostrada ao usuário. */
export class ErroCaixaFechado extends Error {}

const TRAVA = "fechamento-caixa";

function dataBr(dia: string) {
  return dia.split("-").reverse().join("/");
}

export function nomeMesFechamento(mes: string) {
  return new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Último dia fechado (YYYY-MM-DD) ou null quando não há fechamento vigente. */
export async function caixaFechadoAte(tx: Pick<Tx, "fechamentoCaixa">): Promise<string | null> {
  const ultimo = await tx.fechamentoCaixa.findFirst({ where: { reabertoEm: null }, orderBy: { mes: "desc" }, select: { mes: true } });
  return ultimo ? periodoDoMes(ultimo.mes)?.ate ?? null : null;
}

/** Mesmo dia civil usado pelo Fluxo de Caixa para posicionar o lançamento. */
function dia(data: Date | string) {
  return (typeof data === "string" ? data : data.toISOString()).slice(0, 10);
}

/**
 * Impede movimento realizado (baixa, estorno, pagamento) com data em mês fechado.
 * Compartilha trava com o fechamento: uma baixa em curso termina antes de o mês fechar.
 */
export async function exigirCaixaAberto(tx: Tx, datas: (Date | string | null | undefined)[], Erro: new (mensagem: string) => Error = ErroCaixaFechado) {
  const dias = datas.filter((data): data is Date | string => !!data).map(dia);
  if (!dias.length) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${TRAVA}))`;
  const fechadoAte = await caixaFechadoAte(tx);
  if (fechadoAte && dias.some(d => d <= fechadoAte)) {
    throw new Erro(`O fluxo de caixa está fechado até ${dataBr(fechadoAte)}. Peça a um administrador para reabrir o mês antes de movimentar esse período.`);
  }
}

function exigirAdministrador(sessao: SessaoAtual) {
  if (!sessao.admin) throw new ErroCaixaFechado("Somente administradores fecham ou reabrem o mês do fluxo de caixa.");
}

/** Fecha o mês informado e, por consequência, todos os anteriores. */
export async function fecharMesCaixa(tx: Tx, mesValor: unknown, sessao: SessaoAtual, hoje = periodoMesAteHoje().ate) {
  exigirAdministrador(sessao);
  const mes = typeof mesValor === "string" ? mesValor : "";
  const periodo = /^\d{4}-\d{2}$/.test(mes) ? periodoDoMes(mes) : null;
  if (!periodo || mes < "2000-01") throw new ErroCaixaFechado("Escolha um mês válido para fechar.");
  if (periodo.ate >= hoje) throw new ErroCaixaFechado("Só é possível fechar um mês que já terminou.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${TRAVA}))`;
  const fechadoAte = await caixaFechadoAte(tx);
  if (fechadoAte && periodo.ate <= fechadoAte) throw new ErroCaixaFechado(`O fluxo de caixa já está fechado até ${dataBr(fechadoAte)}.`);
  const fechamento = await tx.fechamentoCaixa.create({ data: { mes, fechadoPorId: sessao.userId, fechadoPorNome: sessao.nome } });
  await registrarAtividade(tx, sessao, {
    modulo: "financeiro", recurso: "financeiro.fluxo", acao: "FECHAMENTO_MES", entidade: "FechamentoCaixa", entidadeId: fechamento.id,
    resumo: `Fluxo de caixa fechado até ${dataBr(periodo.ate)}.`, categoria: "CRITICA",
    antes: { fechadoAte }, depois: { fechadoAte: periodo.ate, mes },
  });
  return { fechadoAte: periodo.ate, mes };
}

/** Reabre o último mês fechado; o bloqueio recua para o fechamento vigente anterior. */
export async function reabrirMesCaixa(tx: Tx, motivoValor: unknown, sessao: SessaoAtual) {
  exigirAdministrador(sessao);
  const motivo = typeof motivoValor === "string" ? motivoValor.trim() : "";
  if (motivo.length < 5 || motivo.length > 500) throw new ErroCaixaFechado("Informe o motivo da reabertura (5 a 500 caracteres).");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${TRAVA}))`;
  const ultimo = await tx.fechamentoCaixa.findFirst({ where: { reabertoEm: null }, orderBy: { mes: "desc" } });
  if (!ultimo) throw new ErroCaixaFechado("Não há mês fechado para reabrir.");
  await tx.fechamentoCaixa.update({ where: { id: ultimo.id }, data: { reabertoEm: new Date(), reabertoPorId: sessao.userId, reabertoPorNome: sessao.nome, motivoReabertura: motivo } });
  const fechadoAte = await caixaFechadoAte(tx);
  await registrarAtividade(tx, sessao, {
    modulo: "financeiro", recurso: "financeiro.fluxo", acao: "REABERTURA_MES", entidade: "FechamentoCaixa", entidadeId: ultimo.id,
    resumo: `Mês ${ultimo.mes} do fluxo de caixa reaberto.`, categoria: "CRITICA",
    antes: { fechadoAte: periodoDoMes(ultimo.mes)?.ate ?? null }, depois: { fechadoAte, motivo },
  });
  return { fechadoAte, mes: ultimo.mes };
}

export type HistoricoFechamentoCaixa = { id: string; mes: string; fechadoEm: string; fechadoPorNome: string; reabertoEm: string | null; reabertoPorNome: string | null; motivoReabertura: string | null };

export async function consultarFechamentoCaixa(db: Pick<Tx, "fechamentoCaixa">): Promise<{ fechadoAte: string | null; historico: HistoricoFechamentoCaixa[] }> {
  const [fechadoAte, registros] = await Promise.all([
    caixaFechadoAte(db),
    db.fechamentoCaixa.findMany({ orderBy: [{ fechadoEm: "desc" }], take: 12 }),
  ]);
  return { fechadoAte, historico: registros.map(r => ({ id: r.id, mes: r.mes, fechadoEm: r.fechadoEm.toISOString(), fechadoPorNome: r.fechadoPorNome,
    reabertoEm: r.reabertoEm?.toISOString() ?? null, reabertoPorNome: r.reabertoPorNome, motivoReabertura: r.motivoReabertura })) };
}
