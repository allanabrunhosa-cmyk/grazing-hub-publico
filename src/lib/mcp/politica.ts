import { z } from "zod";
import { permissaoEfetiva, permissaoOperarPedido, permissaoConsultarPorcoes, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { ESCOPOS_MCP, FUNCOES_MCP, exigenciasDaFuncaoMcp, type EscopoMcp } from "./catalogo";

const ids = z.array(z.string().min(1).max(120).regex(/^[a-zA-Z0-9:_-]+$/)).max(200).nullable();
export const RestricoesSchema = z.object({ contas: ids, lancamentos: ids }).strict();
export type RestricoesMcp = z.infer<typeof RestricoesSchema>;
export const SEM_RESTRICAO: RestricoesMcp = { contas: null, lancamentos: null };
export const EscoposSchema = z.array(z.enum(ESCOPOS_MCP as [EscopoMcp, ...EscopoMcp[]])).min(1).max(ESCOPOS_MCP.length).refine(v => new Set(v).size === v.length);
export type IdentidadeMcp = { ativo: boolean; excluidoEm: Date | null; sessaoVersao: number; admin: boolean; permissoes: Permissoes; excecoes: Excecoes };
export function permiteFuncaoMcp(usuario: Pick<IdentidadeMcp, "admin" | "permissoes" | "excecoes">, f: typeof FUNCOES_MCP[number]) {
  if ("somenteAdministrador" in f && f.somenteAdministrador && !usuario.admin) return false;
  return usuario.admin || exigenciasDaFuncaoMcp(f).every(r =>
    f.modulo !== "iFood" && r.recurso === "vendas.pedidos.producao" && r.acao === "editar"
      ? permissaoOperarPedido(usuario.permissoes, usuario.excecoes)
      : f.nome === "porcoes_consultar" && r.recurso === "suprimentos.porcoes" && r.acao === "visualizar" ? permissaoConsultarPorcoes(usuario.permissoes, usuario.excecoes)
      : permissaoEfetiva(usuario.permissoes, usuario.excecoes, r.recurso, r.acao));
}

export function escoposDoUsuario(usuario: IdentidadeMcp): EscopoMcp[] {
  if (!usuario.ativo || usuario.excluidoEm) return [];
  return FUNCOES_MCP.filter(f => permiteFuncaoMcp(usuario, f)).map(f => f.escopo);
}

export function intersectarEscopos(...listas: readonly string[][]): EscopoMcp[] {
  return ESCOPOS_MCP.filter(s => listas.every(lista => lista.includes(s)));
}

function intersecao(a: string[] | null, b: string[] | null): string[] | null {
  if (a === null) return b;
  if (b === null) return a;
  return a.filter(id => b.includes(id));
}
export function intersectarRestricoes(a: RestricoesMcp, b: RestricoesMcp): RestricoesMcp {
  return { contas: intersecao(a.contas, b.contas), lancamentos: intersecao(a.lancamentos, b.lancamentos) };
}

export function registroPermitido(r: RestricoesMcp, id: string, contaId: string | null): boolean {
  return (r.contas === null || (contaId !== null && r.contas.includes(contaId))) &&
    (r.lancamentos === null || r.lancamentos.some(original => id === original || id.startsWith(`fatura:${original}:`)));
}

export class ErroMcp extends Error {
  constructor(public codigo: "invalid_token" | "insufficient_scope" | "invalid_request" | "temporarily_unavailable" | "rate_limit" | "volume_excedido", public status: number, mensagem: string) { super(mensagem); }
}
