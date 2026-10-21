import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { GruposFiscais } from "@/app/(protegido)/vendas/fiscal/grupos-fiscais-client";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";

export default async function GruposFiscaisPage() {
  await exigirPermissao("vendas.fiscal");
  const [grupos, editar, regime] = await Promise.all([
    prisma.grupoFiscalVenda.findMany({ where: { ativo: true }, include: { produtos: { select: { id: true } } }, orderBy: { nome: "asc" } }),
    podeAcessar("vendas.fiscal", "editar"),
    obterRegimeFiscalEmpresaBrasilNfe(),
  ]);
  return <GruposFiscais grupos={grupos.map(g => ({ ...g, fiscal: g.fiscal as Record<string,string> }))} editar={editar} crt={regime.crt} />;
}
