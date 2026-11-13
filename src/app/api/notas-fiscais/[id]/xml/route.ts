import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { xmlRecebidoCompleto } from "@/lib/fiscal-dashboard/arquivo-recebido";

/** Download do XML já armazenado. Não consulta a SEFAZ nem manifesta a nota. */
export async function GET(_requisicao: Request, contexto: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return Response.json({ erro: "Sua sessão expirou." }, { status: 401 });
  if (!await podeAcessar("financeiro.fiscal.painel", "visualizar") || !await podeAcessar("notas", "visualizar")) {
    return Response.json({ erro: "Seu acesso não permite baixar esta nota." }, { status: 403 });
  }
  const { id } = await contexto.params;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({ erro: "Documento inválido." }, { status: 400 });
  try {
    const nota = await prisma.notaFiscalRecebida.findUnique({ where: { id }, select: { tipo: true, xml: true, chaveAcesso: true } });
    if (!nota || !xmlRecebidoCompleto(nota)) return Response.json({ erro: "XML completo não disponível para esta nota." }, { status: 404 });
    const identificador = /^\d{44}$/.test(nota.chaveAcesso) ? nota.chaveAcesso : id;
    return new Response(nota.xml, { headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="nota-recebida-${identificador}.xml"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
    } });
  } catch { return Response.json({ erro: "Não foi possível baixar a nota. Tente novamente." }, { status: 500 }); }
}
