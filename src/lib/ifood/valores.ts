import { Prisma } from "@/generated/prisma/client";
import { moeda, objeto, texto } from "./dominio";

/** Decimais BRL do Order, não Amount.value (centavos) de negociações. */
export function detalharValoresIfood(valor: unknown) {
  const p = objeto(valor), total = objeto(p.total), problemas: string[] = [];
  const beneficios = (Array.isArray(p.benefits) ? p.benefits : []).flatMap(v => {
    try {
      const b = objeto(v);
      const patrocinadores = (Array.isArray(b.sponsorshipValues) ? b.sponsorshipValues : []).map(v => {
        const a = objeto(v); return { nome: texto(a.name, 80), valor: moeda(a.value).toFixed(2) };
      });
      const quantia = moeda(b.value);
      if (!patrocinadores.reduce((s,a) => s.plus(a.valor), new Prisma.Decimal(0)).eq(quantia) || patrocinadores.some(a => !["MERCHANT", "IFOOD"].includes(a.nome))) problemas.push("Patrocínio do benefício não reconciliado ou desconhecido");
      return [{ valor: quantia.toFixed(2), alvo: texto(b.target, 80), alvoId: texto(b.targetId, 100), campanha: b.campaign ? texto(objeto(b.campaign).name, 300) : "", patrocinadores }];
    } catch { problemas.push("Detalhe de benefício fora do contrato"); return []; }
  });
  const taxas = (Array.isArray(p.additionalFees) ? p.additionalFees : []).flatMap(v => {
    try {
      const t = objeto(v), responsaveis = (Array.isArray(t.liabilities) ? t.liabilities : []).map(v => {
        const a = objeto(v), percentual = String(a.percentage);
        if (!/^\d{1,3}(?:\.\d{1,6})?$/.test(percentual) || new Prisma.Decimal(percentual).gt(100)) throw new Error();
        return { nome: texto(a.name, 80), percentual };
      });
      if (responsaveis.length && !responsaveis.reduce((s,a) => s.plus(a.percentual),new Prisma.Decimal(0)).eq(100)) problemas.push("Responsáveis da taxa não reconciliados");
      return [{ tipo: texto(t.type, 80), descricao: texto(t.description, 300), valor: moeda(t.value).toFixed(2), responsaveis }];
    } catch { problemas.push("Detalhe de taxa fora do contrato"); return []; }
  });
  const soma = (vs: { valor: string }[]) => vs.reduce((s,v) => s.plus(v.valor),new Prisma.Decimal(0));
  if (!soma(beneficios).eq(moeda(total.benefits))) problemas.push("Benefícios detalhados divergem do total");
  if (!soma(taxas).eq(moeda(total.additionalFees ?? 0))) problemas.push("Taxas detalhadas divergem do total");
  const patrocinioIfood = soma(beneficios.flatMap(b => b.patrocinadores.filter(a => a.nome === "IFOOD")));
  const descontoLoja = soma(beneficios.flatMap(b => b.patrocinadores.filter(a => a.nome === "MERCHANT")));
  return { beneficios, taxas, problemas, patrocinioIfood: patrocinioIfood.toFixed(2), descontoLoja: descontoLoja.toFixed(2), taxasIfood: moeda(total.additionalFees ?? 0).toFixed(2) };
}
