export type PlanejamentoRaspberry = { estacao: string; fila: string; conexao: "USB" | "REDE" };

/** Metadados de preparação: não são endpoint, credencial nem autorização de envio. */
export function validarPlanejamentoRaspberry(valor: unknown): PlanejamentoRaspberry | null {
  if (valor === null) return null;
  if (!valor || typeof valor !== "object") throw new Error("Preparação do Raspberry Pi inválida.");
  const campos = valor as Record<string, unknown>;
  const estacao = typeof campos.estacao === "string" ? campos.estacao.trim() : "";
  const fila = typeof campos.fila === "string" ? campos.fila.trim() : "";
  if (!/^[\p{L}\p{N} _.-]{1,80}$/u.test(estacao)) throw new Error("Informe o nome da estação Raspberry Pi (até 80 caracteres, sem endereço ou senha).");
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(fila)) throw new Error("Informe a fila da impressora usando letras, números, hífen ou sublinhado.");
  if (campos.conexao !== "USB" && campos.conexao !== "REDE") throw new Error("Selecione a conexão USB ou rede do Raspberry Pi.");
  return { estacao, fila, conexao: campos.conexao };
}

export function lerPlanejamentoRaspberry(valor: unknown): PlanejamentoRaspberry | null {
  try { return validarPlanejamentoRaspberry(valor); } catch { return null; }
}
