import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@/generated/prisma/client";

// Contexto interno, criado exclusivamente após validação OAuth pelo servidor.
// Não é uma credencial, Server Action ou parâmetro aceito do cliente.
type ContextoExecucao = { usuarioId: string; sessaoVersao: number; banco: Prisma.TransactionClient };
const armazenamento = new AsyncLocalStorage<ContextoExecucao>();
export function contextoExecucao() { return armazenamento.getStore(); }
export function comContextoExecucao<T>(contexto: ContextoExecucao, executar: () => Promise<T>) {
  if (armazenamento.getStore()) throw new Error("Contexto de execução já definido.");
  return armazenamento.run(contexto, executar);
}
