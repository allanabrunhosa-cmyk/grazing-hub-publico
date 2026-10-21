import "server-only";
import { XMLParser } from "fast-xml-parser";
import { Prisma } from "@/generated/prisma/client";
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export class ErroXmlHomologacaoBrasilNfe extends Error {
  constructor() { super("XML da homologação não corresponde ao total, itens ou omissão de IPI aprovados. Conferir o documento; não reenviar."); this.name = "ErroXmlHomologacaoBrasilNfe"; }
}
/** Identidade, ambiente e protocolo já foram conferidos pelo adaptador.
 * Aqui confrontamos as condições do manifesto original, sem recalcular o pedido
 * nem aplicar regras fiscais atuais retroativamente ao arquivo histórico. */
export function conferirXmlHomologacaoBrasilNfe(xml: string | undefined, esperado: unknown) {
  const e = obj(esperado);
  const falhar = (): never => { throw new ErroXmlHomologacaoBrasilNfe(); };
  if (!xml) return falhar();
  if (Buffer.byteLength(xml) > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)
    || typeof e.total !== "string" || !/^\d{1,12}\.\d{2}$/.test(e.total) || !Number.isSafeInteger(e.quantidadeItens) || Number(e.quantidadeItens) < 1 || Number(e.quantidadeItens) > 990 || e.ipiOmitido !== true) falhar();
  let raiz: Record<string, unknown>;
  try { raiz = obj(new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: false }).parse(xml)); } catch { return falhar(); }
  const inf = obj(obj(obj(raiz.nfeProc).NFe).infNFe), total = obj(obj(inf.total).ICMSTot).vNF;
  if (typeof total !== "string" || !/^\d{1,13}(?:\.\d{1,2})?$/.test(total) || !new Prisma.Decimal(total).eq(e.total as string)) falhar();
  const itens = Array.isArray(inf.det) ? inf.det : inf.det ? [inf.det] : [];
  if (itens.length !== e.quantidadeItens || itens.some((i, n) => obj(i)["@_nItem"] !== String(n + 1) || Object.hasOwn(obj(obj(i).imposto), "IPI"))) falhar();
}
