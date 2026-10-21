export const METODOS_FINANCEIROS_IFOOD = ["IFOOD_ONLINE", "SUBSIDIO_IFOOD", "CREDIT", "DEBIT", "PIX", "CASH", "MEAL_VOUCHER", "FOOD_VOUCHER"] as const;
export type FinanceiroConfigIfood = { prazoDias: number; contagem: "CORRIDOS" | "UTEIS"; formas: Record<string, string> };
