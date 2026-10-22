import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";

import { prisma } from "@/lib/prisma";

import { VinculosFiscais } from "@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client";

import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import { regrasDaOperacao } from "@/lib/tributacao/ficha";
import { camposDoProduto, regraDoGrupo } from "@/lib/tributacao/campos-simples";
import type { PerfilFiscal, RegraFiscal, ClassificacaoFiscal } from "@/lib/tributacao/tipos";

import { hojeFiscal } from "@/lib/tributacao/validacao";



export default async function VinculosFiscaisPage({ searchParams }: { searchParams?: Promise<{ produto?: string }> }) {
  const consulta = await searchParams;
  const produtoInicial = consulta?.produto && /^(INSUMO:)?[a-zA-Z0-9_-]{1,100}$/.test(consulta.produto) ? consulta.produto : undefined;

  const sessao = await exigirPermissao("vendas.fiscal");

  const [produtos, grupos, editar] = await Promise.all([

    prisma.produtoVenda.findMany({

      select: { id: true, nome: true, codigo: true, fotoUrl: true, categorias: { select: { categoria: { select: { id: true, nome: true, ativo: true } } }, orderBy: { categoria: { nome: "asc" } } }, classificacoes: true, ativo: true, versao: true, fiscal: true, fiscalRevisado: true, grupoFiscalId: true },

      orderBy: [{ nome: "asc" }, { id: "asc" }],

    }),

    prisma.grupoFiscalVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true, ativo: true, fiscal: true }, orderBy: { nome: "asc" } }),

    podeAcessar("vendas.fiscal", "editar"),

  ]);

  const painel = await consultarPainelFiscal(sessao, { tabelas: false, evidenciasEntrada: false });
  const vs = versoesVigentes(painel.versoes, hojeFiscal());
  const perfil = vs.find(v => v.tipo === "PERFIL")?.dados as PerfilFiscal | undefined;
  const contexto = { modelo: "65" as const, destinatario: "CONSUMIDOR_FINAL" as const, ufDestino: perfil?.uf ?? "SP" };
  return <VinculosFiscais produtoInicial={produtoInicial} produtos={produtos.map(p => {

    const versao = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === p.id);
    const classificacao = versao?.dados as ClassificacaoFiscal | undefined;
    const rv = classificacao && perfil ? regrasDaOperacao(vs, classificacao, p.id, { ...contexto, data: hojeFiscal(), estabelecimento: perfil.estabelecimento, operacao: "VENDA" }, perfil).efetiva : undefined;
    const rg = classificacao?.grupoFiscalId && perfil ? regraDoGrupo(vs, classificacao.grupoFiscalId, classificacao.grupo, contexto, perfil).efetiva?.dados as RegraFiscal | undefined : undefined;
    const fiscal = camposDoProduto(classificacao, rv?.dados as RegraFiscal | undefined, rg);
    return { ...p, ncmNaoAplicavel: classificacao?.natureza === "SERVICO" || classificacao?.ncmAplicabilidade === "NAO_APLICAVEL", ncmEditavel: !classificacao || classificacao.tratamento === "NORMAL" && classificacao.natureza !== "SERVICO" && !classificacao.configuracaoNcm, grupoFiscalId: classificacao && Object.hasOwn(classificacao, "grupoFiscalId") ? classificacao.grupoFiscalId ?? null : p.grupoFiscalId, referenciaFiscal: { classificacaoId: versao?.id ?? null, regraId: rv?.id ?? null, contexto }, categorias: p.categorias.map(v => v.categoria), fiscal,

      analiseFiscal: classificacao?.analiseNcm && versao ? { ncm: classificacao.ncm, ncmAplicabilidade: classificacao.ncmAplicabilidade, analiseNcm: classificacao.analiseNcm, configuracaoNcm: classificacao.configuracaoNcm,

        versao: { numero: versao.versao, inicio: versao.vigenciaInicio, autor: versao.criadoPorNome, atualizadaEm: versao.createdAt } } : undefined };

  })}

    grupos={grupos.map(g => ({ ...g, fiscal: g.fiscal as Record<string, string> }))} editar={editar} />;

}
