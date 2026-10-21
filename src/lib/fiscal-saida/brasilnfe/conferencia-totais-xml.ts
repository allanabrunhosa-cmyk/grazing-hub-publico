import "server-only";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { Prisma } from "@/generated/prisma/client";

export class ErroConferenciaXmlBrasilNfe extends Error {
  constructor() { super("XML fiscal diverge da montagem conferida pelo HUB ou possui formato incompatível."); this.name = "ErroConferenciaXmlBrasilNfe"; }
}
const falha = (): never => { throw new ErroConferenciaXmlBrasilNfe(); };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : falha();
function decimal(v: unknown, casas: number): Prisma.Decimal {
  if (!(typeof v === "string" || typeof v === "number" && Number.isFinite(v)) || !new RegExp(`^(?:0|[1-9]\\d{0,12})(?:\\.\\d{1,${casas}})?$`).test(String(v))) return falha();
  return new Prisma.Decimal(String(v));
}
function decimalEsperado(v: unknown, casas: number): Prisma.Decimal {
  const d = decimal(v, 10); if (d.decimalPlaces() > casas) return falha(); return d;
}
function igual(a: unknown, b: unknown, casas: number) { if (!decimal(a, casas).eq(decimalEsperado(b, casas))) falha(); }
const opcional = (v: unknown) => v === undefined ? "0" : v;
const nomeHomologacao55 = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

/** Complementa a conferência de identidade/protocolo de arquivos.ts. Só compara
 * a montagem já selada; não calcula tributos, altera dados ou aceita totais novos. */
export function conferirTotaisDocumentoXmlBrasilNfe(xml: string, documentoFiscalEsperado: unknown): void {
  if (typeof xml !== "string" || !xml || Buffer.byteLength(xml) > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY|<\s*(?:html|script)\b/i.test(xml) || XMLValidator.validate(xml) !== true) return falha();
  const esperado = objeto(documentoFiscalEsperado);
  if (esperado.ModeloDocumento !== 55 && esperado.ModeloDocumento !== 65 || esperado.TipoAmbiente !== 1 && esperado.TipoAmbiente !== 2 || !Array.isArray(esperado.Produtos) || esperado.Produtos.length < 1 || esperado.Produtos.length > 990) return falha();
  let raiz: Record<string, unknown>;
  try { raiz = objeto(new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: true, processEntities: false }).parse(xml)); } catch { return falha(); }
  const inf = objeto(objeto(objeto(raiz.nfeProc).NFe).infNFe), ide = objeto(inf.ide);
  if (ide.mod !== String(esperado.ModeloDocumento) || ide.tpAmb !== String(esperado.TipoAmbiente)) return falha();
  if (esperado.ModeloDocumento === 55 && esperado.TipoAmbiente === 2 && (objeto(esperado.Cliente).NmCliente !== nomeHomologacao55 || objeto(inf.dest).xNome !== nomeHomologacao55)) return falha();
  const itens = Array.isArray(inf.det) ? inf.det : inf.det ? [inf.det] : [];
  if (itens.length !== esperado.Produtos.length) return falha();
  let produtos = new Prisma.Decimal(0), frete = new Prisma.Decimal(0), desconto = new Prisma.Decimal(0), outras = new Prisma.Decimal(0), seguro = new Prisma.Decimal(0);
  esperado.Produtos.forEach((entrada, indice) => {
    const p = objeto(entrada), item = objeto(itens[indice]), x = objeto(item.prod), icms = objeto(objeto(item.imposto).ICMS), grupos = Object.keys(icms);
    if (typeof p.CodProdutoServico !== "string" || !p.CodProdutoServico || p.CodProdutoServico.length > 100 || typeof p.NCM !== "string" || !/^\d{8}$/.test(p.NCM) || !Number.isSafeInteger(p.CFOP) || !/^\d{4}$/.test(String(p.CFOP)) || !Number.isSafeInteger(p.OrigemProduto) || Number(p.OrigemProduto) < 0 || Number(p.OrigemProduto) > 8
      || item["@_nItem"] !== String(indice + 1) || x.cProd !== p.CodProdutoServico || x.NCM !== p.NCM || x.CFOP !== String(p.CFOP) || grupos.length !== 1 || !/^(?:ICMS\d{2}|ICMSSN\d{3}|ICMSPart|ICMSST)$/.test(grupos[0]) || objeto(icms[grupos[0]]).orig !== String(p.OrigemProduto)) return falha();
    if (typeof p.UnidadeComercial !== "string" || x.uCom !== p.UnidadeComercial || typeof p.UnidadeComercialTributavel !== "string" || x.uTrib !== p.UnidadeComercialTributavel) return falha();
    igual(x.qCom, p.Quantidade, 4); igual(x.qTrib, p.QuantidadeTributavel, 4); igual(x.vUnCom, p.ValorUnitario, 10); igual(x.vUnTrib, p.ValorUnitarioTributavel, 10); igual(x.vProd, p.ValorTotal, 2);
    if (decimalEsperado(p.Quantidade, 4).lte(0) || decimalEsperado(p.QuantidadeTributavel, 4).lte(0) || !decimalEsperado(p.Quantidade, 4).mul(decimalEsperado(p.ValorUnitario, 10)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).eq(decimalEsperado(p.ValorTotal, 2)) || !decimalEsperado(p.QuantidadeTributavel, 4).mul(decimalEsperado(p.ValorUnitarioTributavel, 10)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).eq(decimalEsperado(p.ValorTotal, 2))) return falha();
    for (const [xmlCampo, campo] of [["vFrete", "ValorFrete"], ["vDesc", "ValorDesconto"], ["vOutro", "ValorOutrasDespesas"], ["vSeg", "ValorSeguro"]]) igual(opcional(x[xmlCampo]), opcional(p[campo]), 2);
    // O provedor não pode acrescentar uma FCI que não constava da montagem.
    if (p.nFCI === undefined ? x.nFCI !== undefined : typeof p.nFCI !== "string" || x.nFCI !== p.nFCI) return falha();
    produtos = produtos.add(decimalEsperado(p.ValorTotal, 2)); frete = frete.add(decimalEsperado(opcional(p.ValorFrete), 2)); desconto = desconto.add(decimalEsperado(opcional(p.ValorDesconto), 2)); outras = outras.add(decimalEsperado(opcional(p.ValorOutrasDespesas), 2)); seguro = seguro.add(decimalEsperado(opcional(p.ValorSeguro), 2));
  });
  const total = objeto(objeto(inf.total).ICMSTot);
  igual(total.vProd, produtos.toFixed(2), 2); igual(total.vFrete, frete.toFixed(2), 2); igual(total.vDesc, desconto.toFixed(2), 2); igual(total.vOutro, outras.toFixed(2), 2); igual(total.vSeg, seguro.toFixed(2), 2); igual(total.vNF, esperado.ValorTotal, 2);
  igual(produtos.add(frete).sub(desconto).add(outras).add(seguro).toFixed(2), esperado.ValorTotal, 2);
}
