import { ErroIfood, objeto } from "./dominio";
import { diaValido, somarDias } from "@/lib/vendas/pedidos-agenda-dominio";
import { METODOS_FINANCEIROS_IFOOD, type FinanceiroConfigIfood } from "./financeiro-config-dominio";
export { METODOS_FINANCEIROS_IFOOD, type FinanceiroConfigIfood } from "./financeiro-config-dominio";
export function validarFinanceiroConfigIfood(entrada: unknown): FinanceiroConfigIfood {
  const d = objeto(entrada), formas = objeto(d.formas);
  if (!Number.isSafeInteger(d.prazoDias) || Number(d.prazoDias) < 0 || Number(d.prazoDias) > 3650 || !["CORRIDOS", "UTEIS"].includes(String(d.contagem))) throw new ErroIfood("Defina prazo previsto de 0 a 3650 dias e a contagem dos dias.");
  if (Object.keys(formas).some(k => !METODOS_FINANCEIROS_IFOOD.includes(k as typeof METODOS_FINANCEIROS_IFOOD[number]) || typeof formas[k] !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(formas[k] as string))) throw new ErroIfood("Mapeamento financeiro inválido.");
  return { prazoDias: Number(d.prazoDias), contagem: d.contagem as "CORRIDOS" | "UTEIS", formas: formas as Record<string, string> };
}
export function vencimentoPrevistoIfood(diaConfirmacao: string, config: FinanceiroConfigIfood) {
  if (!diaValido(diaConfirmacao)) throw new ErroIfood("Data de confirmação inválida.");
  let dia = diaConfirmacao, restantes = config.prazoDias;
  while (restantes > 0) { dia = somarDias(dia, 1); const semana = new Date(`${dia}T12:00:00Z`).getUTCDay(); if (config.contagem === "CORRIDOS" || semana !== 0 && semana !== 6) restantes--; }
  return new Date(`${dia}T12:00:00Z`);
}
