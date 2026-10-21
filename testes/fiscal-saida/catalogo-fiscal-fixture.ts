import { vi } from "vitest";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";
import type { ConsultaTabelaFiscal } from "@/lib/fiscal/catalogos/tipos";
/** Somente suíte sintética. Nenhuma consulta ao fornecedor ou à sessão real. */
export function mockarCatalogoFiscal() {
  const fetchLocal = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname !== "/api/fiscal/tabelas") throw new Error("Consulta fora da tabela local da suíte.");
    const p = url.searchParams;
    return Response.json(consultarTabelaFiscal({ ...Object.fromEntries(p.entries()), tabela: p.get("tabela") as ConsultaTabelaFiscal["tabela"], crt: p.has("crt") ? Number(p.get("crt")) as 1 | 2 | 3 | 4 : null, modelo: p.has("modelo") ? Number(p.get("modelo")) as 55 | 65 : undefined }));
  });
  vi.stubGlobal("fetch", fetchLocal);
  return fetchLocal;
}
