import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";

export type DecisaoNfse = "ACEITAR" | "RECUSAR";

export async function decidirNfse(input: { nfseId: string; decisao: DecisaoNfse; autorNome: string; dataVencimento?: string | null }) {
  const vencimento = input.dataVencimento || null;
  if (vencimento && (!dataLancamentoValida(vencimento) || input.decisao !== "ACEITAR")) return { erro: "Informe um vencimento válido somente ao aceitar a NFS-e." };
  const status = input.decisao === "ACEITAR" ? "ACEITA" : "RECUSADA";
  return prisma.$transaction(async tx => {
    const resultado = await tx.notaFiscalServico.updateMany({
      where: {
        id: input.nfseId, status: "PENDENTE", lancamentos: { none: {} },
      },
      data: { status, ...(vencimento ? { dataVencimento: new Date(`${vencimento}T00:00:00.000Z`) } : {}) },
    });
    if (resultado.count !== 1) return { erro: "A situação da nota mudou ou ela já foi lançada. Atualize a página." };
    await tx.eventoNfse.create({ data: {
      notaFiscalId: input.nfseId,
      identificador: `LOCAL-${randomUUID()}`,
      tipo: input.decisao === "ACEITAR" ? "ACEITE_NO_HUB" : "RECUSA_NO_HUB",
      criadoPorNome: input.autorNome,
    } });
    return { ok: true as const };
  });
}
