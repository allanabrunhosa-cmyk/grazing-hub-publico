import { getSession } from "@/lib/session";
import { baixarArquivoFiscalSaida } from "@/lib/fiscal-saida/servico";
export async function GET(req: Request, contexto: { params: Promise<{ id: string }> }) {
  const sessao = await getSession(); if (!sessao) return Response.json({ erro: "Sua sessão expirou." }, { status: 401 });
  const parametros = new URL(req.url).searchParams;
  const tipo = parametros.get("tipo") ?? "";
  try {
    const arquivo = await baixarArquivoFiscalSaida((await contexto.params).id, tipo, sessao);
    if (!arquivo) return Response.json({ erro: "Arquivo ainda não obtido do emissor." }, { status: 404 });
    const mime = tipo === "pdf" ? "application/pdf" : tipo === "html" ? "text/html; charset=utf-8" : "application/xml; charset=utf-8";
    const nome = tipo === "cancelamento" ? "cancelamento-saida.xml" : `documento-saida.${tipo}`;
    const disposicao = parametros.get("visualizar") === "1" && ["pdf", "html"].includes(tipo) ? "inline" : "attachment";
    return new Response(arquivo as BodyInit, { headers: { "Content-Type": mime, "Content-Disposition": `${disposicao}; filename="${nome}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
  } catch { return Response.json({ erro: "Documento indisponível ou acesso não autorizado." }, { status: 403 }); }
}
