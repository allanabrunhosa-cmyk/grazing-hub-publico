import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { VinculosFiscais } from "@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";
import { hojeFiscal } from "@/lib/tributacao/validacao";

export default async function VinculosFiscaisPage() {
  await exigirPermissao("vendas.fiscal");
  const [produtos, grupos, editar] = await Promise.all([
    prisma.produtoVenda.findMany({
      select: { id: true, nome: true, codigo: true, fotoUrl: true, categorias: { select: { categoria: { select: { id: true, nome: true, ativo: true } } }, orderBy: { categoria: { nome: "asc" } } }, classificacoes: true, ativo: true, versao: true, fiscal: true, fiscalRevisado: true, grupoFiscalId: true },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    }),
    prisma.grupoFiscalVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true, ativo: true, fiscal: true }, orderBy: { nome: "asc" } }),
    podeAcessar("vendas.fiscal", "editar"),
  ]);
  const idsAnalise = [...new Set(produtos.map(p => (p.fiscal as Record<string, unknown>)?.ncmClassificacaoVersaoId).filter((id): id is string => typeof id === "string" && id.length <= 100))];
  const analises = idsAnalise.length ? await prisma.versaoEstruturaFiscal.findMany({
    where: { id: { in: idsAnalise }, tipo: "CLASSIFICACAO", status: "ATIVO", vigenciaInicio: { lte: new Date(`${hojeFiscal()}T00:00:00Z`) } },
    select: { id: true, chave: true, dados: true, versao: true, vigenciaInicio: true, criadoPorNome: true, createdAt: true },
  }) : [];
  return <VinculosFiscais produtos={produtos.map(p => {
    const fiscal = p.fiscal as Record<string, string>;
    const versao = analises.find(v => v.id === fiscal.ncmClassificacaoVersaoId && v.chave === p.id);
    const classificacao = versao?.dados as unknown as ClassificacaoFiscal | undefined;
    return { ...p, categorias: p.categorias.map(v => v.categoria), fiscal,
      analiseFiscal: classificacao?.analiseNcm && versao ? { ncm: classificacao.ncm, ncmAplicabilidade: classificacao.ncmAplicabilidade, analiseNcm: classificacao.analiseNcm, configuracaoNcm: classificacao.configuracaoNcm,
        versao: { numero: versao.versao, inicio: versao.vigenciaInicio.toISOString().slice(0, 10), autor: versao.criadoPorNome, atualizadaEm: versao.createdAt.toISOString() } } : undefined };
  })}
    grupos={grupos.map(g => ({ ...g, fiscal: g.fiscal as Record<string, string> }))} editar={editar} />;
}
