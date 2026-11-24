import { afterAll, beforeAll, vi } from "vitest";

/**
 * Fixa somente o relógio (Date) do arquivo de teste. O fluxo de caixa trata pendente
 * a vencer como provisão e pendente vencido como pagamento não realizado; cenários
 * com datas fixas precisam declarar o "hoje" para não mudar de sentido com o tempo.
 */
export function fixarHojeDoFluxo(dia: string) {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${dia}T15:00:00Z`));
  });
  afterAll(() => { vi.useRealTimers(); });
}
