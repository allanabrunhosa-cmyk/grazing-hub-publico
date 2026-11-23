import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { exigirAdministrador } from "@/lib/site/configuracao";
import { chamarAsaas } from "./cliente";
import { ambienteAsaas, estadoConfiguracaoAsaas } from "./configuracao";
import { ErroAsaas, objeto } from "./dominio";

export async function estadoAsaas() {
  const ambiente = ambienteAsaas();
  const [pendentes, falhos, semVinculo, ultimo, incertas] = await Promise.all([
    prisma.eventoAsaas.count({ where: { ambiente, estado: "PENDENTE" } }),
    prisma.eventoAsaas.count({ where: { ambiente, estado: "FALHOU" } }),
    prisma.eventoAsaas.count({ where: { ambiente, estado: "SEM_VINCULO" } }),
    prisma.eventoAsaas.findFirst({ where: { ambiente }, orderBy: { recebidoEm: "desc" }, select: { recebidoEm: true } }),
    prisma.cobrancaAsaas.count({ where: { ambiente, estado: { in: ["ENVIANDO", "INCERTA"] } } }),
  ]);
  return { ...estadoConfiguracaoAsaas(), pendentes, falhos, semVinculo, incertas, ultimoEvento: ultimo?.recebidoEm.toISOString() ?? null };
}
export type EstadoAsaas = Awaited<ReturnType<typeof estadoAsaas>>;

/** Leitura mínima para conferir a chave; não cria nem altera nada no Asaas. */
export async function testarAsaas(sessao: SessaoAtual) {
  try { await prisma.$transaction(tx => exigirAdministrador(tx, sessao)); } catch (e) { throw new ErroAsaas(e instanceof Error ? e.message : "Acesso negado."); }
  const r = objeto(await chamarAsaas(ambienteAsaas(), "/customers", { consulta: { limit: "1" } }));
  if (!Array.isArray(r.data)) throw new ErroAsaas("Resposta do Asaas fora do contrato.");
  return { ok: true as const, ambiente: ambienteAsaas() };
}

export async function reprocessarFalhasAsaas(sessao: SessaoAtual) {
  try {
    return await prisma.$transaction(async tx => {
      await exigirAdministrador(tx, sessao);
      return (await tx.eventoAsaas.updateMany({ where: { estado: { in: ["FALHOU", "SEM_VINCULO"] } }, data: { estado: "PENDENTE", tentativas: 0, proximaTentativa: new Date(), recebidoEm: new Date(), erro: null } })).count;
    });
  } catch (e) { throw new ErroAsaas(e instanceof Error ? e.message : "Não foi possível reprocessar."); }
}
