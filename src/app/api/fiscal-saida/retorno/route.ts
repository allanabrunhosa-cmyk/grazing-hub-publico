/** O envio individual usa consulta autenticada. A habilitação manual por
 * documento nunca autoriza callback ou processamento automático. */
export async function POST(request: Request) {
  void request;
  return Response.json({ erro: "Callback fiscal desativado. Conferir o documento pela consulta manual autorizada." }, { status: 503 });
}
