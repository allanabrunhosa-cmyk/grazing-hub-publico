import { ErroPedidoVenda } from "./pedidos-dominio";

export const LIMITE_RESPONSAVEL_CANCELAMENTO = 120;
export const LIMITE_MOTIVO_CANCELAMENTO = 1000;

export function aceitaNomeResponsavelCancelamento(valor: string) {
  return valor.length <= LIMITE_RESPONSAVEL_CANCELAMENTO && /^[\p{L}\p{M} .'’-]*$/u.test(valor);
}

export function nomeResponsavelCancelamentoValido(valor: string) {
  return aceitaNomeResponsavelCancelamento(valor) && /\p{L}/u.test(valor);
}

/** Nome informado é contexto do cancelamento; a autoridade continua sendo a sessão autenticada. */
export function validarResponsavelCancelamento(valor: unknown) {
  if (typeof valor !== "string" || !nomeResponsavelCancelamentoValido(valor)) {
    throw new ErroPedidoVenda("Informe o nome do responsável pelo cancelamento, com até 120 caracteres.");
  }
  return valor.normalize("NFC").trim().replace(/ +/g, " ");
}

export function aceitaMotivoCancelamento(valor: string) {
  return valor.length <= LIMITE_MOTIVO_CANCELAMENTO && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(valor);
}

export function validarMotivoCancelamento(valor: unknown) {
  if (typeof valor !== "string" || !valor.trim() || !aceitaMotivoCancelamento(valor)) {
    throw new ErroPedidoVenda("Informe o motivo do cancelamento, com até 1000 caracteres.");
  }
  return valor.trim();
}
