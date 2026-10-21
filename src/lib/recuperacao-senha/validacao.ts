export const MENSAGEM_SOLICITACAO = "Se este e-mail estiver vinculado a uma conta ativa, você receberá as instruções para redefinir sua senha.";
export const ERRO_LINK = "Este link é inválido, expirou ou já foi utilizado. Solicite um novo link para continuar.";
export const MINUTOS_VALIDADE = 30;

export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < 8) return "Crie uma senha com pelo menos 8 caracteres.";
  if (new TextEncoder().encode(senha).length > 72) return "A senha é muito longa. Use no máximo 72 bytes (acentos e símbolos podem ocupar mais de um).";
  if (!/\p{Lu}/u.test(senha)) return "Inclua pelo menos uma letra maiúscula na senha.";
  if (!/[\p{P}\p{S}]/u.test(senha)) return "Inclua pelo menos um caractere especial na senha.";
  if (senha !== confirmacao) return "As senhas não coincidem. Confira a confirmação.";
  return null;
}

export function tokenBemFormado(token: string) { return /^[A-Za-z0-9_-]{43}$/.test(token); }
