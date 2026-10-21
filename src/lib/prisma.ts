import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { contextoExecucao } from "@/lib/contexto-execucao";

// Evita criar uma conexão nova a cada recarregamento em desenvolvimento
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const bancoPrincipal = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Operações compartilhadas chamadas pelo MCP participam da mesma transação da
// autorização, aprovação, idempotência e auditoria. Fora desse contexto, o
// comportamento do cliente original é preservado. Não abre transação aninhada.
export function clienteComContexto(cliente: PrismaClient): PrismaClient { return new Proxy(cliente, {
  get(alvo, propriedade) {
    const contexto = contextoExecucao();
    if (contexto && propriedade === "$transaction") {
      const banco = contexto.banco;
      return async (operacao: ((tx: typeof banco) => Promise<unknown>) | Promise<unknown>[]) =>
        typeof operacao === "function" ? operacao(banco) : Promise.all(operacao);
    }
    const banco = contexto?.banco ?? alvo;
    const valor = Reflect.get(banco, propriedade);
    return typeof valor === "function" ? valor.bind(banco) : valor;
  },
}); }
export const prisma = clienteComContexto(bancoPrincipal);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = bancoPrincipal;
}
