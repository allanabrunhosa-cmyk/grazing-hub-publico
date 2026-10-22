import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { GruposFiscais } from "@/app/(protegido)/vendas/fiscal/grupos-fiscais-client";
import { grupoFiscalArquivado } from "@/lib/tributacao/grupos-operacionais";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import { hojeFiscal } from "@/lib/tributacao/validacao";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";

export default async function GruposFiscaisPage() {
  const sessao = await exigirPermissao("vendas.fiscal");
  const [grupos, editar, regime] = await Promise.all([
    prisma.grupoFiscalVenda.findMany({ include: { produtos: { select: { id: true } } }, orderBy: { nome: "asc" } }),
    podeAcessar("vendas.fiscal", "editar"),
    obterRegimeFiscalEmpresaBrasilNfe(),
  ]);
  const painel = await consultarPainelFiscal(sessao);
  const classes = versoesVigentes(painel.versoes, hojeFiscal()).filter(v => v.tipo === "CLASSIFICACAO").map(v => v.dados as ClassificacaoFiscal);
  const gruposExibidos = grupos.filter(g => !grupoFiscalArquivado(g.fiscal)).map(g => {
    const legados = g.produtos.filter(p => !classes.some(c => c.produtoId === p.id && Object.hasOwn(c, "grupoFiscalId")));
    const canonicos = classes.filter(c => c.grupoFiscalId === g.id && c.produtoId).map(c => ({ id: c.produtoId! }));
    return { ...g, fiscal: g.fiscal as Record<string, string>, produtos: [...legados, ...canonicos] };
  });
  return <div className="space-y-5"><GruposFiscais grupos={gruposExibidos} editar={editar} crt={regime.crt} painel={painel} /></div>;
}
