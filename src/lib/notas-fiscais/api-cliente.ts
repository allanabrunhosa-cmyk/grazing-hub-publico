export type ResultadoBuscaNotas =
  | { agendada: true; mensagem: string }
  | { erro: string };

export type ResultadoImportacaoXml =
  | { mensagem: string }
  | { erro: string };

export type ResultadoImportacaoChave =
  | { mensagem: string }
  | { erro: string };

async function lerResposta<T>(resposta: Response): Promise<T> {
  const tipo = resposta.headers.get("content-type") ?? "";
  if (resposta.redirected || !tipo.includes("application/json")) {
    return { erro: "Sua sessão expirou. Atualize a página e entre novamente." } as T;
  }

  const resultado = await resposta.json() as T;
  if (!resposta.ok && (!resultado || typeof resultado !== "object" || !("erro" in resultado))) {
    throw new Error("Resposta inválida do servidor.");
  }
  return resultado;
}

export async function buscarNotasPelaApi(): Promise<ResultadoBuscaNotas> {
  const resposta = await fetch("/api/notas-fiscais/buscar", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  return lerResposta<ResultadoBuscaNotas>(resposta);
}

export async function importarChavePelaApi(chave: string): Promise<ResultadoImportacaoChave> {
  const resposta = await fetch("/api/notas-fiscais/importar-chave", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ chave }),
  });
  return lerResposta<ResultadoImportacaoChave>(resposta);
}

export function importarXmlPelaApi(formulario: FormData): Promise<ResultadoImportacaoXml>;
export function importarXmlPelaApi(formulario: FormData, notaFiscalId: string): Promise<{ ok: true } | { erro: string }>;
export async function importarXmlPelaApi(
  formulario: FormData,
  notaFiscalId?: string
): Promise<ResultadoImportacaoXml | { ok: true }> {
  if (notaFiscalId) formulario.set("notaFiscalId", notaFiscalId);
  const resposta = await fetch("/api/notas-fiscais/importar-xml", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    body: formulario,
  });
  return lerResposta<ResultadoImportacaoXml | { ok: true }>(resposta);
}
