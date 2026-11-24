import { receberEventoAsaas } from "@/lib/asaas/eventos";

/**
 * Webhook do Asaas. Autenticado pelo header asaas-access-token; sem sessão de pessoas.
 * Responde 200 somente depois de persistir o evento; o processamento é do worker.
 */
export async function POST(request: Request) {
  const sem = { "Cache-Control": "no-store" };
  try {
    const { status } = await receberEventoAsaas(await request.text(), request.headers.get("asaas-access-token"));
    return new Response(null, { status, headers: sem });
  } catch {
    // Falha ao persistir: o Asaas reenvia; nenhum detalhe interno é exposto.
    return new Response(null, { status: 500, headers: sem });
  }
}
