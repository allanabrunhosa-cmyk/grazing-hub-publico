export async function lerJsonLimitado(request: Request, limite: number): Promise<Record<string, unknown> | null> {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(tamanho) || tamanho > limite || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limite) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    const dado = JSON.parse(texto);
    return dado && typeof dado === "object" && !Array.isArray(dado) ? dado : null;
  } catch { return null; }
}
