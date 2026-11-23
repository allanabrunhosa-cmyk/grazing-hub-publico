import "dotenv/config";
import { setTimeout } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { asaasAtivo } from "@/lib/asaas/configuracao";
import { processarEventoAsaas } from "@/lib/asaas/eventos";
import { reconciliarCobrancasIncertas } from "@/lib/asaas/cobrancas";
import { siteAtivo } from "@/lib/site/cliente";
import { coletarPedidosSite, processarEventoSite } from "@/lib/site/processamento";

let parar = false;
process.on("SIGTERM", () => { parar = true; });
process.on("SIGINT", () => { parar = true; });
/** Um único worker para Asaas e Site: filas duráveis no banco, sem depender da interface. */
async function executar() {
  const umaVez = process.argv.includes("--uma-vez");
  if (!asaasAtivo() && !siteAtivo()) { console.log("Integrações Asaas e Site desativadas."); return; }
  let ciclo = 0;
  try {
    do {
      try {
        await coletarPedidosSite();
        for (let n = 0; n < 20 && !parar; n++) if (!await processarEventoSite()) break;
        for (let n = 0; n < 20 && !parar; n++) if (!await processarEventoAsaas()) break;
        if (ciclo++ % 30 === 0) await reconciliarCobrancasIncertas();
      } catch { console.error("integracoes.worker: falha local; consultar pendências no HUB."); }
      if (!umaVez && !parar) await setTimeout(2000);
    } while (!umaVez && !parar);
  } finally { await prisma.$disconnect(); }
}
void executar();
