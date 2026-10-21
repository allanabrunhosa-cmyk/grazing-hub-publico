import { contextoDoHost } from "@/lib/hosts";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { consultarConflitosIdentidadeCliente } from "@/lib/vendas/clientes-unicidade";
import { ErroCadastroVenda, objeto } from "@/lib/vendas/dominio";

const LIMITE_BYTES = 2048;
class CorpoGrande extends Error {}
async function lerEntrada(requisicao: Request) {
  if (Number(requisicao.headers.get("content-length")) > LIMITE_BYTES) throw new CorpoGrande();
  if (requisicao.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ErroCadastroVenda("Informe os identificadores em JSON.");
  const leitor = requisicao.body?.getReader();
  if (!leitor) throw new ErroCadastroVenda("Informe os identificadores.");
  const partes: Uint8Array[] = []; let tamanho = 0;
  try {
    for (;;) {
      const parte = await leitor.read();
      if (parte.done) break;
      tamanho += parte.value.byteLength;
      if (tamanho > LIMITE_BYTES) { await leitor.cancel(); throw new CorpoGrande(); }
      partes.push(parte.value);
    }
  } finally { leitor.releaseLock(); }
  return objeto(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(partes))));
}

export async function POST(requisicao: Request) {
  const cabecalhos = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const host = contextoDoHost(requisicao.headers), site = requisicao.headers.get("sec-fetch-site");
  if (!host || host.identidade === "etiquetas" || requisicao.headers.get("origin") !== host.origem || (site !== null && site !== "same-origin")) return Response.json({ erro: "Origem não permitida para consultar o cadastro." }, { status: 403, headers: cabecalhos });
  if (!await getSession()) return Response.json({ erro: "Sua sessão expirou." }, { status: 401, headers: cabecalhos });
  try {
    const entrada = await lerEntrada(requisicao);
    if (entrada.contexto !== "CLIENTES" && entrada.contexto !== "PEDIDOS") return Response.json({ erro: "Contexto de cadastro inválido." }, { status: 400, headers: cabecalhos });
    if (host.identidade === "pedidos" && entrada.contexto !== "PEDIDOS") return Response.json({ erro: "Consulta não permitida neste acesso." }, { status: 403, headers: cabecalhos });
    if (!await podeAcessar(entrada.contexto === "PEDIDOS" ? "vendas.pedidos" : "vendas.clientes")) return Response.json({ erro: "Seu perfil não permite consultar este cadastro." }, { status: 403, headers: cabecalhos });
    return Response.json(await consultarConflitosIdentidadeCliente(prisma, entrada), { headers: cabecalhos });
  } catch (erro) {
    const status = erro instanceof CorpoGrande ? 413 : erro instanceof ErroCadastroVenda || erro instanceof SyntaxError || erro instanceof TypeError ? 400 : 503;
    return Response.json({ erro: status === 503 ? "Não foi possível verificar o cadastro. Tente novamente." : "Dados de consulta inválidos." }, { status, headers: cabecalhos });
  }
}
