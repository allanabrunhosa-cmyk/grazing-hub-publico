// Somente um identificador opaco e um destino fixo. Nunca aceitar URL de retorno.
export function retornoOAuthLogin(valor: unknown) {
  return typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor) ? valor : undefined;
}
