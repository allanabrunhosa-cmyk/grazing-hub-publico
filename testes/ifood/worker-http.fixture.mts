import { appendFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Preload exclusivo do ensaio: banco isolado e fetch sem saída para a rede.
const url = new URL(process.env.DATABASE_URL ?? "");
const schema = process.env.IFOOD_WORKER_TESTE_SCHEMA ?? "";
if (process.env.IFOOD_BANCO_TESTE !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_teste") || !/^teste_ifood_worker_[a-f0-9]{32}$/.test(schema)) throw Error("Worker de teste exige banco e schema locais exclusivos.");
const cenario = JSON.parse(readFileSync(process.env.IFOOD_WORKER_TESTE_CENARIO!, "utf8")) as {
  merchant: string;
  pedido: { id: string };
  eventos: unknown[];
  detalhesFalham?: boolean;
  interromperConfirmacao?: boolean;
};
const registrar = (dados: object) => appendFileSync(process.env.IFOOD_WORKER_TESTE_LOG!, JSON.stringify(dados) + "\n");
registrar({ inicio: { id: randomUUID(), pid: process.pid, instante: new Date().toISOString() } });
const banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: "-c search_path=" + schema }, { schema }) });
// O entrypoint verdadeiro continua usando src/lib/prisma; somente o destino do banco é injetado.
(globalThis as typeof globalThis & { prisma: PrismaClient }).prisma = banco;
globalThis.fetch = async (input, init) => {
  const destino = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const caminho = destino.pathname, metodo = init?.method ?? "GET";
  const resposta = (dados: unknown, status = 200) => new Response(status === 202 ? null : JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
  if (destino.origin === "https://merchant-api.ifood.com.br") {
    if (metodo === "GET" && caminho === "/events/v1.0/events:polling" && new Headers(init?.headers).get("x-polling-merchants") === cenario.merchant) {
      registrar({ caminho, metodo }); return resposta(cenario.eventos);
    }
    if (metodo === "POST" && caminho === "/events/v1.0/events/acknowledgment") {
      const ids = JSON.parse(String(init?.body)) as { id: string }[];
      const persistidos = await banco.eventoIfood.count({ where: { externoId: { in: ids.map(e => e.id) } } });
      registrar({ caminho, metodo, eventos: ids.length, persistidos });
      if (!ids.length || persistidos !== ids.length) throw Error("ACK antes da persistência.");
      return resposta(null, 202);
    }
    if (metodo === "GET" && caminho === `/order/v1.0/orders/${cenario.pedido.id}`) {
      registrar({ caminho, metodo }); return resposta(cenario.detalhesFalham ? {} : cenario.pedido, cenario.detalhesFalham ? 503 : 200);
    }
    if (metodo === "POST" && caminho === `/order/v1.0/orders/${cenario.pedido.id}/confirm`) {
      registrar({ caminho, metodo });
      // Interrupção real do filho após ENVIANDO durável, antes de salvar o resultado do POST.
      if (cenario.interromperConfirmacao) process.exit(73);
      return resposta(null, 202);
    }
  }
  registrar({ bloqueada: true, metodo });
  throw Error("Saída HTTP fora do cenário de teste bloqueada.");
};
