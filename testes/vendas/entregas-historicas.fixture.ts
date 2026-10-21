import { criarEntregaHistorica, SPREADSHEET_ENTREGAS_HISTORICAS, SHEET_ENTREGAS_HISTORICAS, type FonteEntregasHistoricas } from "@/lib/vendas/entregas-historicas-dominio";
export const SHIPPING_SINTETICO = "Destinatária fictícia\nRua Sintética, 10\n12345-111\nSão Paulo\nSão Paulo\n12345-678";
export function fonteEntregasSintetica(endereco: string | null = SHIPPING_SINTETICO, numero = "55"): FonteEntregasHistoricas {
  return { origem: "google-sheets-entrega", spreadsheetId: SPREADSHEET_ENTREGAS_HISTORICAS, sheetId: SHEET_ENTREGAS_HISTORICAS, aba: "Orders", faixa: "I2:J3", consultadoEm: "2026-10-15T12:00:00Z", colunas: { I: "Full Address (Shipping)", J: "Número do pedido" }, linhas: [{ linha: 2, numero, endereco }] };
}
export function entregaSintetica(endereco: string | null = SHIPPING_SINTETICO, numero = "55") {
  const fonte = fonteEntregasSintetica(endereco, numero);
  return criarEntregaHistorica(fonte, fonte.linhas[0], "a".repeat(64));
}
export function entregaProjetadaSintetica(endereco: string | null = SHIPPING_SINTETICO, numero = "55") {
  const e = entregaSintetica(endereco, numero);
  return { ...e, temShipping: !!e.enderecoOriginal?.trim() };
}
