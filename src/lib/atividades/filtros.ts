import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { diaValido, inicioDiaNoFuso, somarDias } from "@/lib/vendas/pedidos-agenda-dominio";
import { MODULOS, ORIGENS, RESULTADOS, type FiltrosAtividades } from "./types";
export class ErroConsultaAtividades extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}
export function validarFiltros(input: FiltrosAtividades) {
  if (!input || typeof input.usuarioId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.usuarioId)) throw new ErroConsultaAtividades(400, "Usuário inválido.");
  if (!diaValido(input.de) || !diaValido(input.ate) || input.de > input.ate || input.de < "2000-01-01" || input.ate > "2200-12-31") throw new ErroConsultaAtividades(400, "Informe um período válido.");
  if ((input.modulo && !MODULOS.includes(input.modulo as typeof MODULOS[number])) ||
    (input.origem && !ORIGENS.includes(input.origem as typeof ORIGENS[number])) ||
    (input.resultado && !RESULTADOS.includes(input.resultado as typeof RESULTADOS[number])) ||
    (input.perspectiva && !["autor", "cadastro"].includes(input.perspectiva)) ||
    (input.acao && (input.acao.length > 100 || !/^[\p{L}\p{N} _./-]+$/u.test(input.acao)))) throw new ErroConsultaAtividades(400, "Filtro inválido.");
  const filtros = { usuarioId: input.usuarioId, de: input.de, ate: input.ate, modulo: input.modulo || undefined,
    origem: input.origem || undefined, resultado: input.resultado || undefined, acao: input.acao || undefined, perspectiva: input.perspectiva ?? "autor" };
  return { filtros, inicio: inicioDiaNoFuso(input.de, "America/Sao_Paulo"), fim: inicioDiaNoFuso(somarDias(input.ate, 1), "America/Sao_Paulo"),
    hash: createHash("sha256").update(JSON.stringify(filtros)).digest("hex") };
}
type Cursor = { data: string; id: string; limite: string; filtros: string };
function assinatura(corpo: string) {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) throw new ErroConsultaAtividades(503, "Consulta de atividades indisponível.");
  return createHmac("sha256", segredo).update("atividades:" + corpo).digest("base64url");
}
export function criarCursor(cursor: Cursor) {
  const corpo = Buffer.from(JSON.stringify(cursor)).toString("base64url");
  return corpo + "." + assinatura(corpo);
}
export function lerCursor(texto: string, hash: string): Cursor {
  try {
    if (typeof texto !== "string" || texto.length > 1000) throw Error();
    const [corpo, sig, extra] = texto.split(".");
    if (!corpo || !sig || extra) throw Error();
    const atual = Buffer.from(sig), esperado = Buffer.from(assinatura(corpo));
    if (atual.length !== esperado.length || !timingSafeEqual(atual, esperado)) throw Error();
    const c = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Cursor;
    if (!c || c.filtros !== hash || !/^[a-zA-Z0-9_-]{1,160}$/.test(c.id) || !/^\d{1,20}$/.test(c.limite) ||
      typeof c.data !== "string" || c.data.length > 30 || new Date(c.data).toISOString() !== c.data) throw Error();
    return c;
  } catch (erro) {
    if (erro instanceof ErroConsultaAtividades && erro.status === 503) throw erro;
    throw new ErroConsultaAtividades(400, "Paginação inválida. Reaplique os filtros.");
  }
}
