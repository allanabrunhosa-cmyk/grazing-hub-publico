import { z } from "zod";
import type { Acao } from "@/lib/permissoes/catalogo";
import { contratoEscrita } from "./contratos-negocio";

export function funcao<N extends string>(nome: N, modulo: string, titulo: string, recurso: string, acao: Acao, dados: z.ZodType, confirmacao = false) {
  const escrita = acao !== "visualizar";
  return { nome, escopo: `hub:v2:${nome}`, modulo, titulo, recurso, acao, escrita, confirmacao, destrutiva: acao === "editar" || acao === "excluir" || confirmacao, externa: false, previaTransacional: false, detalhada: true, somenteAdministrador: false,
    descricao: `${titulo}. ${escrita ? "Usa as regras e permissões atuais do HUB. Chave de idempotência: data UTC da primeira chamada AAAA-MM-DD seguida de _ e identificador único de 16 a 80 caracteres; reutilize a chave ao repetir a mesma solicitação." : "Consulta delimitada, conforme suas permissões atuais no HUB."}${confirmacao ? " Prepare a proposta e peça ao usuário que revise e aprove na página autenticada do HUB. A IA não pode aprovar; depois execute pelo identificador da proposta." : ""}`,
    entrada: escrita ? contratoEscrita(dados, confirmacao) : dados };
}
