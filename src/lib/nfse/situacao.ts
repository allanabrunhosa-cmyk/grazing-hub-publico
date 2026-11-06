import { randomUUID } from "node:crypto";
import type { DestinoFinanceiroNfse } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";

export type DecisaoNfse = "ACEITAR" | "RECUSAR" | "ALTERAR_DESTINO_FINANCEIRO";

type EntradaDecisaoNfse = {
  nfseId: string;
  decisao: DecisaoNfse;
  dataVencimento?: string | null;
  destinoFinanceiro?: DestinoFinanceiroNfse;
  destinoFinanceiroAnterior?: DestinoFinanceiroNfse | null;
};

type EntradaValidada =
  | { nfseId: string; decisao: "ACEITAR"; dataVencimento?: string; destinoFinanceiro?: DestinoFinanceiroNfse }
  | { nfseId: string; decisao: "RECUSAR" }
  | { nfseId: string; decisao: "ALTERAR_DESTINO_FINANCEIRO"; destinoFinanceiro: DestinoFinanceiroNfse; destinoFinanceiroAnterior: DestinoFinanceiroNfse | null };

function destinoValido(valor: unknown): valor is DestinoFinanceiroNfse {
  return valor === "FINANCEIRO" || valor === "SOMENTE_FISCAL";
}

export function validarEntradaDecisaoNfse(input: unknown): EntradaValidada | { erro: string } {
  const dados = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const { nfseId, decisao, dataVencimento, destinoFinanceiro, destinoFinanceiroAnterior } = dados;
  if (typeof nfseId !== "string" || !nfseId.trim() || nfseId.length > 100) {
    return { erro: "Informe uma NFS-e válida." };
  }
  if (decisao === "ALTERAR_DESTINO_FINANCEIRO") {
    if (!destinoValido(destinoFinanceiro) || (destinoFinanceiroAnterior !== null && !destinoValido(destinoFinanceiroAnterior))) {
      return { erro: "Informe o destino atual e escolha o novo destino financeiro." };
    }
    if (destinoFinanceiro === destinoFinanceiroAnterior) return { erro: "Escolha um destino diferente do atual." };
    if (dataVencimento !== undefined) return { erro: "A alteração do destino preserva o vencimento informado anteriormente." };
    return { nfseId, decisao, destinoFinanceiro, destinoFinanceiroAnterior };
  }
  if (decisao !== "ACEITAR" && decisao !== "RECUSAR") return { erro: "Escolha uma ação válida para a NFS-e." };
  if (destinoFinanceiroAnterior !== undefined) return { erro: "Informe o destino anterior apenas ao alterar o destino financeiro." };
  if (destinoFinanceiro !== undefined && (decisao !== "ACEITAR" || !destinoValido(destinoFinanceiro))) {
    return { erro: "Escolha um destino financeiro válido somente ao aceitar a NFS-e." };
  }
  if (destinoFinanceiro === "SOMENTE_FISCAL" && dataVencimento !== undefined) {
    return { erro: "Informe vencimento somente para a NFS-e destinada ao financeiro." };
  }
  const vencimento = dataVencimento === null || dataVencimento === undefined || dataVencimento === "" ? undefined : dataVencimento;
  if (vencimento !== undefined && (typeof vencimento !== "string" || !dataLancamentoValida(vencimento))) {
    return { erro: "Informe um vencimento válido." };
  }
  if (vencimento && decisao !== "ACEITAR") {
    return { erro: "Informe vencimento somente para a NFS-e destinada ao financeiro." };
  }
  if (decisao === "RECUSAR") return { nfseId, decisao };
  return { nfseId, decisao, ...(vencimento ? { dataVencimento: vencimento } : {}),
    ...(destinoValido(destinoFinanceiro) ? { destinoFinanceiro } : {}) };
}

function eventoDestino(destino: DestinoFinanceiroNfse) {
  return destino === "SOMENTE_FISCAL" ? "DESTINO_SOMENTE_FISCAL_NO_HUB" : "DESTINO_FINANCEIRO_NO_HUB";
}

export async function decidirNfse(input: EntradaDecisaoNfse & { autorNome: string }) {
  const dados = validarEntradaDecisaoNfse(input);
  if ("erro" in dados) return dados;
  const semVinculos = { id: dados.nfseId, lancamentos: { none: {} } };
  return prisma.$transaction(async tx => {
    const registrarEvento = (tipo: string) => tx.eventoNfse.create({ data: {
      notaFiscalId: dados.nfseId, identificador: `LOCAL-${randomUUID()}`, tipo, criadoPorNome: input.autorNome,
    } });
    if (dados.decisao === "ALTERAR_DESTINO_FINANCEIRO") {
      const atualizacao = await tx.notaFiscalServico.updateMany({
        where: { ...semVinculos, status: "ACEITA", destinoFinanceiro: dados.destinoFinanceiroAnterior },
        data: { destinoFinanceiro: dados.destinoFinanceiro },
      });
      if (atualizacao.count !== 1) return { erro: "A situação ou o destino da nota mudou, ou ela já foi lançada. Atualize a página." };
      await registrarEvento(eventoDestino(dados.destinoFinanceiro));
      return { ok: true as const };
    }
    const aceita = dados.decisao === "ACEITAR";
    const destino = aceita ? dados.destinoFinanceiro : undefined;
    const vencimento = aceita ? dados.dataVencimento : undefined;
    const resultado = await tx.notaFiscalServico.updateMany({
      where: { ...semVinculos, status: "PENDENTE" },
      data: {
        status: aceita ? "ACEITA" : "RECUSADA",
        ...(destino ? { destinoFinanceiro: destino } : {}),
        ...(vencimento ? { dataVencimento: new Date(`${vencimento}T00:00:00.000Z`) } : {}),
      },
    });
    if (resultado.count !== 1) return { erro: "A situação da nota mudou ou ela já foi lançada. Atualize a página." };
    await registrarEvento(aceita ? "ACEITE_NO_HUB" : "RECUSA_NO_HUB");
    if (destino) await registrarEvento(eventoDestino(destino));
    return { ok: true as const };
  });
}
