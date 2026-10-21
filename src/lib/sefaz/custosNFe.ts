import { XMLParser } from "fast-xml-parser";
import type { CustosNotaFiscal, DetalhamentoTributos } from "@/lib/notas-fiscais/custos";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, trimValues: true });
function dinheiro(valor: unknown): number {
  if (valor == null || valor === "") return 0;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 999999999999.99) throw new Error("Valor inválido nos custos da nota.");
  return Math.round(numero * 100) / 100;
}

function registro(valor: unknown): Record<string, unknown> | null {
  return valor != null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}

function valorTributo(grupo: unknown, campo: string): number {
  const raiz = registro(grupo);
  if (!raiz) return 0;
  if (campo in raiz) return dinheiro(raiz[campo]);
  for (const valor of Object.values(raiz)) {
    const filho = registro(valor);
    if (filho && campo in filho) return dinheiro(filho[campo]);
  }
  return 0;
}

function somarAcrescimos(tributos: DetalhamentoTributos) {
  return dinheiro(tributos.icmsSt + tributos.icmsMonofasicoRetido + tributos.fcpSt + tributos.impostoImportacao
    + tributos.pisSt + tributos.cofinsSt + tributos.ipiDevolvido);
}

function somarItens(itens: { tributos: DetalhamentoTributos }[], campo: keyof DetalhamentoTributos) {
  return dinheiro(itens.reduce((soma, item) => soma + item.tributos[campo], 0));
}

function totalOuItens(valor: unknown, itens: { tributos: DetalhamentoTributos }[], campo: keyof DetalhamentoTributos) {
  return valor == null || valor === "" ? somarItens(itens, campo) : dinheiro(valor);
}

export function extrairCustosNFe(xml: string): CustosNotaFiscal {
  const nota = parser.parse(xml)?.nfeProc?.NFe?.infNFe;
  if (!nota) throw new Error("Não foi possível ler os custos do XML.");
  const totais = nota.total?.ICMSTot ?? {};
  const lista = nota.det == null ? [] : Array.isArray(nota.det) ? nota.det : [nota.det];
  const itens = lista.map((det: {
    "@_nItem"?: unknown; prod?: Record<string, unknown>;
    imposto?: { ICMS?: Record<string, Record<string, unknown>>; IPI?: unknown; II?: unknown; PIS?: unknown; COFINS?: unknown; PISST?: unknown; COFINSST?: unknown };
    impostoDevol?: unknown;
  }, indice: number) => {
    const prod = det.prod ?? {};
    const imposto = det.imposto ?? {};
    const icms = Object.values(imposto.ICMS ?? {})[0] as Record<string, unknown> | undefined;
    const pisSt = registro(imposto.PISST);
    const cofinsSt = registro(imposto.COFINSST);
    const tributos: DetalhamentoTributos = {
      icmsIncluso: dinheiro(icms?.vICMS), fcpIncluso: dinheiro(icms?.vFCP),
      pisIncluso: valorTributo(imposto.PIS, "vPIS"), cofinsIncluso: valorTributo(imposto.COFINS, "vCOFINS"),
      icmsSt: dinheiro(icms?.vICMSST), icmsMonofasicoRetido: dinheiro(icms?.vICMSMonoReten),
      fcpSt: dinheiro(icms?.vFCPST), impostoImportacao: valorTributo(imposto.II, "vII"),
      pisSt: String(pisSt?.indSomaPISST) === "1" ? dinheiro(pisSt?.vPIS) : 0,
      cofinsSt: String(cofinsSt?.indSomaCOFINSST) === "1" ? dinheiro(cofinsSt?.vCOFINS) : 0,
      ipiDevolvido: valorTributo(det.impostoDevol, "vIPIDevol"),
    };
    return {
      numeroItem: Number(det["@_nItem"] ?? indice + 1), produtos: String(prod.indTot ?? "1") === "0" ? 0 : dinheiro(prod.vProd),
      frete: dinheiro(prod.vFrete), seguro: dinheiro(prod.vSeg), outrasDespesas: dinheiro(prod.vOutro),
      ipi: valorTributo(imposto.IPI, "vIPI"), desconto: dinheiro(prod.vDesc), tributos,
      outrosTributos: somarAcrescimos(tributos),
      abatimentos: String(icms?.indDeduzDeson) === "1" ? dinheiro(icms?.vICMSDeson) : 0,
    };
  });
  if (!itens.length || new Set(itens.map((item: { numeroItem: number }) => item.numeroItem)).size !== itens.length) throw new Error("Itens inválidos no XML.");
  const tributos: DetalhamentoTributos = {
    icmsIncluso: dinheiro(totais.vICMS), fcpIncluso: dinheiro(totais.vFCP),
    pisIncluso: dinheiro(totais.vPIS), cofinsIncluso: dinheiro(totais.vCOFINS),
    icmsSt: totalOuItens(totais.vST, itens, "icmsSt"),
    icmsMonofasicoRetido: totalOuItens(totais.vICMSMonoReten, itens, "icmsMonofasicoRetido"),
    fcpSt: totalOuItens(totais.vFCPST, itens, "fcpSt"), impostoImportacao: totalOuItens(totais.vII, itens, "impostoImportacao"),
    pisSt: somarItens(itens, "pisSt"), cofinsSt: somarItens(itens, "cofinsSt"),
    ipiDevolvido: totalOuItens(totais.vIPIDevol, itens, "ipiDevolvido"),
  };
  return {
    itens, produtos: dinheiro(totais.vProd), frete: dinheiro(totais.vFrete), ipi: dinheiro(totais.vIPI),
    seguro: dinheiro(totais.vSeg), outrasDespesas: dinheiro(totais.vOutro), desconto: dinheiro(totais.vDesc),
    outrosTributos: somarAcrescimos(tributos), tributos,
    abatimentos: dinheiro(itens.reduce((soma: number, item: { abatimentos: number }) => soma + item.abatimentos, 0)), totalNota: dinheiro(totais.vNF),
  };
}
