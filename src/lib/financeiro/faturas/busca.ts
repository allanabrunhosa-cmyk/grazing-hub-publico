import type { Prisma } from "@/generated/prisma/client";
import { valoresDecimaisDaBusca } from "@/lib/busca-valor";

export function filtroBuscaFatura(busca?: string): Prisma.FaturaCartaoWhereInput {
  const termo = busca?.trim();
  if (!termo) return {};
  const valores = valoresDecimaisDaBusca(termo);
  return { OR: [
    { cartao: { OR: [{ nome: { contains: termo, mode: "insensitive" } }, { emissor: { contains: termo, mode: "insensitive" } }] } },
    ...(valores.length ? [{ totalInformado: { in: valores } }] : []),
  ] };
}

export function filtroBuscaItemFatura(busca?: string): Prisma.ItemFaturaCartaoWhereInput {
  const termo = busca?.trim();
  if (!termo) return {};
  const valores = valoresDecimaisDaBusca(termo);
  return { OR: [
    { descricaoOriginal: { contains: termo, mode: "insensitive" } },
    { estabelecimentoNormalizado: { contains: termo, mode: "insensitive" } },
    ...(valores.length ? [{ valor: { in: valores } }] : []),
  ] };
}
