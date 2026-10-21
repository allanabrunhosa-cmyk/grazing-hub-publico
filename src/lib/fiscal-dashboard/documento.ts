import "server-only";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { extrairDetalhesFiscaisNFe, extrairItensNFe } from "@/lib/sefaz/parseNFe";
import type { TipoDocumentoDashboardFiscal } from "./tipos";

export type DetalheDocumentoDashboard = {
  campos: { nome: string; valor: string | null }[];
  itens: { numero: number; descricao: string; quantidade: number; unidade: string; valor: number }[];
  aviso: string | null;
};
export function recursoDocumentoDashboard(tipo: TipoDocumentoDashboardFiscal) {
  return tipo === "NF_SAIDA" ? "vendas.fiscal" : tipo === "NFS_ENTRADA" ? "financeiro.nfse" : "notas";
}
/** Consulta local sob demanda. Não manifesta, transmite, concilia ou obtém arquivos externos. */
export async function consultarDocumentoDashboard(tipo: TipoDocumentoDashboardFiscal, id: string): Promise<DetalheDocumentoDashboard | { erro: string }> {
  await exigirPermissao("financeiro.fiscal.painel");
  if (!["NF_SAIDA", "NF_ENTRADA", "NFC_ENTRADA", "NFS_ENTRADA"].includes(tipo) || typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return { erro: "Documento inválido." };
  if (!await podeAcessar(recursoDocumentoDashboard(tipo))) return { erro: "Seu acesso não permite consultar os detalhes desta nota." };
  if (tipo === "NF_SAIDA" && !await podeAcessar("vendas.pedidos")) return { erro: "Seu acesso não permite consultar o pedido desta nota." };
  try {
    if (tipo === "NFS_ENTRADA") {
      const nota = await prisma.notaFiscalServico.findUnique({ where: { id }, select: { numero: true, serie: true, chaveAcesso: true, codigoVerificacao: true, prestadorNome: true, municipioNome: true, uf: true, valorIss: true } });
      if (!nota) return { erro: "Nota não encontrada." };
      return { campos: [{ nome: "Número", valor: nota.numero }, { nome: "Série", valor: nota.serie }, { nome: "Chave de acesso", valor: nota.chaveAcesso }, { nome: "Código de verificação", valor: nota.codigoVerificacao }, { nome: "Prestador", valor: nota.prestadorNome }, { nome: "Município", valor: [nota.municipioNome, nota.uf].filter(Boolean).join(" / ") || null }, { nome: "ISS (R$)", valor: nota.valorIss?.toFixed(2).replace(".", ",") ?? null }], itens: [], aviso: "Consulta dos dados locais da NFS-e. Nenhuma manifestação ou lançamento financeiro foi executado." };
    }
    const nota = tipo === "NF_SAIDA"
      ? await prisma.documentoFiscalSaida.findUnique({ where: { id }, select: { xml: true, chaveFiscal: true, numero: true, serie: true, protocolo: true, protocoloCancelamento: true, ambiente: true } })
      : await prisma.notaFiscalRecebida.findUnique({ where: { id }, select: { xml: true, chaveAcesso: true, fornecedorNome: true } });
    if (!nota) return { erro: "Nota não encontrada." };
    const campos: DetalheDocumentoDashboard["campos"] = [{ nome: "Chave de acesso", valor: "chaveFiscal" in nota ? nota.chaveFiscal : nota.chaveAcesso }];
    if ("ambiente" in nota) campos.push({ nome: "Ambiente", valor: nota.ambiente === "PRODUCAO" ? "Produção" : nota.ambiente === "HOMOLOGACAO" ? "Homologação" : "Não informado" }, { nome: "Série", valor: nota.serie }, { nome: "Protocolo", valor: nota.protocolo }, { nome: "Protocolo de cancelamento", valor: nota.protocoloCancelamento });
    else campos.push({ nome: "Emitente", valor: nota.fornecedorNome });
    // O extrator oficial só é usado no XML completo já persistido e validado na origem.
    if (!nota.xml || nota.xml.length > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(nota.xml)) return { campos, itens: [], aviso: "XML completo não disponível. Somente os dados locais conhecidos são exibidos." };
    try {
      const detalhes = extrairDetalhesFiscaisNFe(nota.xml);
      campos.push({ nome: "Natureza da operação", valor: detalhes.naturezaOperacao }, { nome: "Emitente no XML", valor: detalhes.emitenteNome });
      const itens = extrairItensNFe(nota.xml).map(i => ({ numero: i.numeroItem, descricao: i.descricaoProduto, quantidade: i.quantidadeComercial, unidade: i.unidadeComercial, valor: i.valorTotalItem }));
      return { campos, itens, aviso: itens.length ? null : "O XML local não contém itens disponíveis para esta consulta." };
    } catch { return { campos, itens: [], aviso: "Não foi possível ler os itens do XML local. Os dados conhecidos da nota foram preservados." }; }
  } catch { return { erro: "Não foi possível consultar a nota. Tente novamente." }; }
}
