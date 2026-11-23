import { receberAvisoSite } from "@/lib/site/processamento";

/**
 * Webhook do WooCommerce. Autenticado pela assinatura HMAC dos bytes originais;
 * sem sessão de pessoas. O aviso só aponta o pedido, relido depois pela API.
 */
export async function POST(request: Request) {
  const sem = { "Cache-Control": "no-store" };
  try {
    const corpo = Buffer.from(await request.arrayBuffer());
    const { status } = await receberAvisoSite(corpo, { assinatura: request.headers.get("x-wc-webhook-signature"), topico: request.headers.get("x-wc-webhook-topic"), entrega: request.headers.get("x-wc-webhook-delivery-id") });
    return new Response(null, { status, headers: sem });
  } catch {
    return new Response(null, { status: 500, headers: sem });
  }
}
