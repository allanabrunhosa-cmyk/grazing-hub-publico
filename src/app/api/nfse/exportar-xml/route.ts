import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { compactarXmlsNfse, nomeArquivoNfse, periodoExportacaoNfse } from "@/lib/nfse/exportacao";
import { NOTAS_NFSE_VISIVEIS } from "@/lib/nfse/visibilidade";

export async function GET(requisicao: Request) {
  if (!(await getSession())) return Response.json({ erro: "Sua sessão expirou." }, { status: 401 });
  if (!(await podeAcessar("financeiro.nfse", "visualizar"))) return Response.json({ erro: "Seu perfil não permite exportar estas notas." }, { status: 403 });
  const consulta = new URL(requisicao.url).searchParams;
  const id = consulta.get("id");
  try {
    const periodo = periodoExportacaoNfse(consulta.get("de") ?? "", consulta.get("ate") ?? "");
    const notas = await prisma.notaFiscalServico.findMany({
      where: { ...NOTAS_NFSE_VISIVEIS, ...(id ? { id } : {}), dataEmissao: periodo, xml: { not: null } },
      select: { id: true, numero: true, xml: true }, orderBy: { id: "asc" }, take: 201,
    });
    if (!notas.length) return Response.json({ erro: "Nenhum XML disponível para exportar neste período." }, { status: 404 });
    if (notas.length > 200) return Response.json({ erro: "Selecione um período menor para exportar até 200 XMLs por vez." }, { status: 400 });
    const conteudo = id ? notas[0].xml! : await compactarXmlsNfse(notas.map(nota => ({ ...nota, xml: nota.xml! })));
    return new Response(conteudo as BodyInit, { headers: {
      "Content-Type": id ? "application/xml; charset=utf-8" : "application/zip",
      "Content-Disposition": `attachment; filename="${id ? nomeArquivoNfse(notas[0]) : "nfse-xmls.zip"}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Não foi possível exportar os XMLs." }, { status: 400 });
  }
}
