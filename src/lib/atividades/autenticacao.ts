import "server-only";
import { bancoPrincipal } from "@/lib/prisma";
import { registrarAtividade } from "./registro";
/** Tentativa sem identidade confirmada nunca recebe o autor do e-mail informado. */
export async function registrarAutenticacao(ator: { userId: string; nome: string } | null, acao: "LOGIN" | "LOGIN_RECUSADO" | "LOGOUT_EXPLICITO" | "AUTORIZACAO_NEGADA", recurso = "configuracoes.usuarios", estrito = false) {
  try {
    await bancoPrincipal.$transaction(tx => registrarAtividade(tx, ator ?? { tipo: "SISTEMA", referencia: "Autenticação sem identidade confirmada" }, {
      modulo: "autenticacao", recurso, acao, entidade: "Sessao", resumo: {
        LOGIN: "Autenticação concluída com credenciais validadas.", LOGIN_RECUSADO: "Tentativa de autenticação recusada, sem identidade confirmada.",
        LOGOUT_EXPLICITO: "Saída explícita da sessão.", AUTORIZACAO_NEGADA: "Operação recusada pela autorização do servidor.",
      }[acao], resultado: acao === "AUTORIZACAO_NEGADA" ? "NEGADO" : acao === "LOGIN_RECUSADO" ? "FALHA" : "SUCESSO",
      categoria: "ACESSO", origem: "INTERFACE",
    }));
  } catch {
    // Nenhum corpo, e-mail, senha, token ou erro do driver entra no diagnóstico.
    console.error("atividade_autenticacao_indisponivel", acao);
    if (estrito) throw new Error("Registro de autenticação indisponível.");
  }
}
