import { validarDataEntradaEstoque } from "./data-entrada";

export type EntradaTratamentoLocalNota = {
  notaFiscalId: string;
  versao: number;
  acao: "DEVOLUCAO" | "IGNORAR" | "REABRIR";
  dataDevolucao?: string;
  motivo: string;
};

export function validarTratamentoLocalNota(entrada: EntradaTratamentoLocalNota, agora = new Date()): { erro: string } | (Omit<EntradaTratamentoLocalNota, "dataDevolucao"> & { dataDevolucao: Date | null }) {
  if (!entrada || typeof entrada.notaFiscalId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(entrada.notaFiscalId)) {
    return { erro: "Nota fiscal inválida. Reabra o painel." } as const;
  }
  if (!Number.isSafeInteger(entrada.versao) || entrada.versao < 0 || entrada.versao >= 2_147_483_647) {
    return { erro: "Revisão da nota inválida. Reabra o painel." } as const;
  }
  if (!["DEVOLUCAO", "IGNORAR", "REABRIR"].includes(entrada.acao)) {
    return { erro: "Selecione um tratamento válido para a nota." } as const;
  }
  const motivo = typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
  if (motivo.length < 15 || motivo.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(motivo)) {
    return { erro: "Informe um motivo de 15 a 500 caracteres, sem caracteres de controle." } as const;
  }
  let dataDevolucao: Date | null = null;
  if (entrada.acao === "DEVOLUCAO") {
    const validacao = validarDataEntradaEstoque(entrada.dataDevolucao, agora);
    if ("erro" in validacao) {
      return { erro: validacao.erro.includes("futura")
        ? "A data de devolução não pode ser futura. Registre somente uma devolução já realizada."
        : "Informe uma data de devolução válida." } as const;
    }
    dataDevolucao = validacao.data;
  }
  return { ...entrada, motivo, dataDevolucao };
}
