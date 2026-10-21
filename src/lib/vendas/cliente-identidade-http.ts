import type { ConsultaIdentidadeCliente, ConflitosIdentidadeCliente } from "./cliente-identidade-consulta";

/** Leitura independente da fila de Server Actions usada pela consulta pública de CNPJ. */
async function consultar(contexto: "CLIENTES" | "PEDIDOS", entrada: ConsultaIdentidadeCliente, signal?: AbortSignal): Promise<ConflitosIdentidadeCliente> {
  const resposta = await fetch("/api/vendas/clientes/identidade", {
    method: "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contexto, ...entrada }),
  });
  if (!resposta.ok) throw new Error("Consulta de cadastro indisponível.");
  const dados: unknown = await resposta.json();
  if (!dados || typeof dados !== "object" || !("email" in dados) || !("documento" in dados) || typeof dados.email !== "boolean" || typeof dados.documento !== "boolean") throw new Error("Resposta de cadastro inválida.");
  return { email: dados.email, documento: dados.documento };
}

export const consultarIdentidadeClienteCadastro = (entrada: ConsultaIdentidadeCliente, signal?: AbortSignal) => consultar("CLIENTES", entrada, signal);
export const consultarIdentidadeClientePedido = (entrada: ConsultaIdentidadeCliente, signal?: AbortSignal) => consultar("PEDIDOS", entrada, signal);
