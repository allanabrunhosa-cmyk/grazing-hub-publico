import { getSession } from "@/lib/session";
import { baixarArquivoNumeradoFiscalSaida } from "@/lib/fiscal-saida/servico";
import { disposicaoArquivo, nomeArquivoGrazing, numeroNoNome } from "@/lib/nome-arquivo";
export async function GET(req: Request, contexto: { params: Promise<{ id: string }> }) {
  const sessao = await getSession(); if (!sessao) return Response.json({ erro: "Sua sessão expirou." }, { status: 401 });
  const parametros = new URL(req.url).searchParams;
  const tipo = parametros.get("tipo") ?? "";
  try {
    const arquivo = await baixarArquivoNumeradoFiscalSaida((await contexto.params).id, tipo, sessao);
    if (!arquivo?.conteudo) return Response.json({ erro: "Arquivo ainda não obtido do emissor." }, { status: 404 });
    const mime = tipo === "pdf" ? "application/pdf" : tipo === "html" ? "text/html; charset=utf-8" : "application/xml; charset=utf-8";
    const numero = numeroNoNome(arquivo.numero);
    const nome = tipo === "cancelamento" ? nomeArquivoGrazing("NF saída", "xml", `${numero} cancelamento`) : nomeArquivoGrazing("NF saída", tipo, numero);
    const disposicao = parametros.get("visualizar") === "1" && ["pdf", "html"].includes(tipo) ? "inline" : "attachment";
    return new Response(arquivo.conteudo as BodyInit, { headers: { "Content-Type": mime, "Content-Disposition": disposicaoArquivo(nome, disposicao), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
  } catch { return Response.json({ erro: "Documento indisponível ou acesso não autorizado." }, { status: 403 }); }
}
