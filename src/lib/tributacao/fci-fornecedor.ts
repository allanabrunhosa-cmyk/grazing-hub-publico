import "server-only";
import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Prisma } from "@/generated/prisma/client";
import type { ClassificacaoFiscal, RepasseFciFornecedor } from "./tipos";
import { NUMERO_FCI_FISCAL } from "./fci";
import { hashTecnico } from "./fotografia-tecnica";
import { ErroEstruturaFiscal } from "./validacao";
import { dataRepasseFciValida } from "./fci-fornecedor-contrato";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, trimValues: true, removeNSPrefix: true, processEntities: false });
const falha = (m: string): never => { throw new ErroEstruturaFiscal(`FCI do fornecedor: ${m}`); };
const lista = <T>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
type NoXml = { [chave: string]: unknown };
const no = (v: unknown): NoXml => v && typeof v === "object" && !Array.isArray(v) ? v as NoXml : {};

/** Somente leitura de entradas já conciliadas. Não consulta SEFAZ, gera CI ou altera estoque. */
export async function conferirRepasseFciFornecedor(tx: Prisma.TransactionClient, c: ClassificacaoFiscal, data: string): Promise<RepasseFciFornecedor> {
  const d = c.fci, pedido = d?.repasseFornecedor, materiais = c.fotografiaTecnica?.materiais;
  if (!pedido || !d?.numero || d.situacao !== "EXIGIDA" || !["FRACIONADO", "REVENDA"].includes(c.natureza) || c.tratamento !== "NORMAL" || c.configuracaoNcm || !c.ncm || !["3", "5", "8"].includes(c.origem ?? "")) return falha("repasse exige mercadoria revendida ou fracionada, sem nova industrialização e com decisão explícita.");
  if (d.apuracaoCompleta || d.periodoApuracao != null || d.conteudoImportacao != null || d.valorParcelaImportada != null || d.valorSaidaReferencia != null || d.dispensa || d.declaracaoResponsavel) return falha("repasse não admite apuração própria nem dispensa no mesmo registro.");
  if (!dataRepasseFciValida(data)) return falha("vigência inválida para conferência das entradas.");
  if (!materiais || materiais.insumos.length !== 1 || materiais.insumos[0].transitiva || materiais.insumos[0].insumoId !== pedido.insumoId) return falha("o insumo deve corresponder ao único material direto da mercadoria fotografada.");
  const itens = await tx.notaFiscalItem.findMany({ where: { insumoId: pedido.insumoId, status: "CONCILIADO", destino: "ESTOQUE", notaFiscal: { tipo: "PROC_NFE" } }, orderBy: [{ notaFiscalId: "asc" }, { numeroItem: "asc" }], take: 101, select: { id: true, insumoId: true, numeroItem: true, codigoProdutoFornecedor: true, ncm: true, notaFiscal: { select: { chaveAcesso: true, xml: true, manifestacoes: { where: { sucesso: true }, orderBy: { createdAt: "desc" }, take: 1, select: { tipo: true } } } } } });
  if (!itens.length || itens.length > 100) return falha("entradas conciliadas ausentes ou acima do limite de conferência; revise a rastreabilidade do lote.");
  const documentos: NonNullable<RepasseFciFornecedor["registro"]>["documentos"] = [];
  for (const i of itens) {
    const xml = i.notaFiscal.xml;
    if (i.insumoId !== pedido.insumoId || !xml || xml.length > 15_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return falha("a entrada vinculada precisa ter XML completo e legível.");
    if (["OPERACAO_NAO_REALIZADA", "DESCONHECIMENTO_DA_OPERACAO"].includes(i.notaFiscal.manifestacoes[0]?.tipo ?? "")) return falha("a entrada vinculada possui manifestação incompatível.");
    let raiz: NoXml;
    try { raiz = no(parser.parse(xml)); } catch { return falha("não foi possível conferir o XML da entrada vinculada."); }
    const processo = no(raiz.nfeProc), inf = no(no(processo.NFe).infNFe), protocolo = no(no(processo.protNFe).infProt), ide = no(inf.ide);
    if (protocolo.cStat !== "100" || protocolo.chNFe !== i.notaFiscal.chaveAcesso || inf["@_Id"] !== `NFe${i.notaFiscal.chaveAcesso}` || ide.mod !== "55" || ide.tpAmb !== "1") return falha("a prova deve ser NF-e de produção com protocolo de autorização e chave correspondentes.");
    const emissao = String(ide.dhEmi ?? ide.dEmi ?? "").slice(0, 10);
    if (!dataRepasseFciValida(emissao)) return falha("data oficial de emissão ausente ou inválida no XML de entrada.");
    if (emissao > data) continue;
    const dets = lista(inf.det).map(no).filter(n => String(n["@_nItem"]) === String(i.numeroItem));
    if (dets.length !== 1) return falha("o item conciliado não corresponde a um único detalhe da NF-e.");
    const det = dets[0], produto = no(det.prod), grupos = Object.values(no(no(det.imposto).ICMS)).map(no);
    const numero = String(produto.nFCI ?? "").toUpperCase();
    if (produto.cProd !== i.codigoProdutoFornecedor || produto.NCM !== i.ncm || produto.NCM !== c.ncm || grupos.length !== 1 || String(grupos[0].orig) !== c.origem) return falha("código, NCM e origem da entrada divergem da mercadoria; confira o fornecedor e o lote.");
    if (!NUMERO_FCI_FISCAL.test(numero) || numero === "00000000-0000-0000-0000-000000000000" || numero !== d.numero) return falha("controle FCI ausente, inválido ou divergente nas entradas; não é possível escolher um número por suposição.");
    documentos.push({ itemId: i.id, numeroItem: i.numeroItem, xmlHash: createHash("sha256").update(xml).digest("hex"), dataEmissao: emissao });
  }
  if (!documentos.length) return falha("não há entrada autorizada anterior à vigência da classificação.");
  if (new Set(documentos.map(n => n.itemId)).size !== documentos.length) return falha("há duplicidade de identificação dos itens conciliados.");
  return { insumoId: pedido.insumoId, registro: { algoritmo: "grazing.fci-fornecedor.v1", natureza: c.natureza as "FRACIONADO" | "REVENDA", ncm: c.ncm, origem: c.origem!, materiaisHash: hashTecnico(materiais), documentos } };
}
