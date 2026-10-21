import { MENSAGEM_SOLICITACAO } from "../../src/lib/recuperacao-senha/validacao";
export async function solicitarRecuperacaoAction() { return { ok: true, mensagem: MENSAGEM_SOLICITACAO }; }
export async function redefinirSenhaAction() { return { ok: true }; }
export async function verificarLinkRecuperacaoAction() { return { valido: !location.search.includes("invalido") }; }
export async function loginAction() { return { erro: "E-mail ou senha inválidos." }; }
