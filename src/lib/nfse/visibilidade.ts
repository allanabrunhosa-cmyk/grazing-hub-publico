import type { Prisma } from "@/generated/prisma/client";
import { DATA_MINIMA_NFSE_DATE } from "./parse";

// A busca automática mantém o recorte; somente importações manuais podem abrir exceção.
export const NOTAS_NFSE_VISIVEIS = {
  OR: [
    { dataEmissao: { gte: DATA_MINIMA_NFSE_DATE } },
    { importadaManualmente: true },
  ],
} satisfies Prisma.NotaFiscalServicoWhereInput;
