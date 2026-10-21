import { diaValido, somarDias } from "./pedidos-agenda-dominio";
import { diaUtilBancarioNacional } from "./calendario-bancario";

/** Data comercial civil, sem conversão pelo fuso do navegador ou do banco. */
export function dataCompraValida(valor: unknown): valor is string {
  return typeof valor === "string" && diaValido(valor) && valor >= "2000-01-01" && valor <= "2200-12-31";
}
export function dataCompraCivil(valor: Date | null | undefined): string | null {
  return valor?.toISOString().slice(0, 10) ?? null;
}
export type PrazoPagamentoPedido = { prazoDias: number; inicioPrazo: string; contagemPrazo: string; vencimentoFlexivel: boolean };

/** Só projeta o prazo quando o fato inicial existe. Não presume captura ou repasse. */
export function vencimentoPrazoPedido(forma: PrazoPagamentoPedido, compra: string, pagamento?: string): string | null {
  const base = forma.inicioPrazo === "VENDA" ? compra : pagamento;
  if (!base) return null;
  if (!dataCompraValida(base) || !Number.isSafeInteger(forma.prazoDias) || forma.prazoDias < 0 || forma.prazoDias > 3650 || !["VENDA", "PAGAMENTO"].includes(forma.inicioPrazo) || !["CORRIDOS", "UTEIS"].includes(forma.contagemPrazo)) throw new Error("Prazo da forma de pagamento inválido.");
  if (forma.contagemPrazo === "CORRIDOS") return somarDias(base, forma.prazoDias);
  let dia = base, restantes = forma.prazoDias;
  while (restantes) {
    dia = somarDias(dia, 1);
    if (diaUtilBancarioNacional(dia)) restantes--;
  }
  return dia;
}
