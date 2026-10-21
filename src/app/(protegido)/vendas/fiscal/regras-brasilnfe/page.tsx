import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { listarRegrasTributariasBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias";
import { RegrasBrasilNfeClient } from "./regras-client";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";

export default async function RegrasBrasilNfePage() {
  const sessao = await exigirPermissao("vendas.fiscal", "visualizar");
  const [regras, regime] = await Promise.all([listarRegrasTributariasBrasilNfe(sessao), obterRegimeFiscalEmpresaBrasilNfe()]);
  const [editar, produtos, grupos, formas, responsaveis] = await Promise.all([
    podeAcessar("vendas.fiscal", "editar"),
    prisma.produtoVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true, versao: true, fiscal: true, fiscalRevisado: true }, orderBy: { nome: "asc" } }),
    prisma.grupoFiscalVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true, versao: true, fiscal: true }, orderBy: { nome: "asc" } }),
    prisma.formaPagamentoVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.usuario.findMany({ where: { id: { in: [...new Set(regras.flatMap(r => r.atual ? [r.atual.responsavelId] : []))] } }, select: { id: true, nome: true } }),
  ]);
  const fiscal = (v: unknown): Record<string, string> => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k, valor]) => ["ncm", "cest", "origem", "cfop", "csosn", "cstIcms", "pis", "cofins", "ipi", "fcp", "ean", "unidadeTributavel", "cEnq", "cBenef", "cstIbsCbs", "cClassTrib"].includes(k) && typeof valor === "string")) : {};
  return <RegrasBrasilNfeClient regras={regras} editar={editar} responsaveis={Object.fromEntries(responsaveis.map(r => [r.id, r.nome]))} catalogos={{ crt: regime.crt, vigenteDesde: regime.vigenteDesde, vigenteAte: regime.vigenteAte, produtos: produtos.map(p => ({ id: p.id, nome: p.nome, versao: p.versao, revisado: p.fiscalRevisado, fiscal: fiscal(p.fiscal) })), grupos: grupos.map(g => ({ ...g, fiscal: fiscal(g.fiscal) })), formas }} />;
}
