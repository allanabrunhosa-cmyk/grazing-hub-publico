import "dotenv/config";
import { setTimeout } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { coletarEventos } from "@/lib/ifood/coletor";
import { processarEvento } from "@/lib/ifood/processamento";
import { processarMerchant } from "@/lib/ifood/merchant";
import { recuperarAcoesIfood } from "@/lib/ifood/reconciliacao";
import { enviarAcao } from "@/lib/ifood/acoes";

let parar = false;
process.on("SIGTERM", () => { parar = true; });
process.on("SIGINT", () => { parar = true; });
async function executar() {
  const umaVez = process.argv.includes("--uma-vez");
  if (process.env.IFOOD_ATIVO !== "1") { console.log("Integração iFood desativada."); return; }
  // Workers separados: processamento lento não atrasa o heartbeat/polling.
  const papel = process.argv.includes("--coletor") ? "coletor" : "processador";
  try {
    do {
      try {
        if (papel === "coletor") await coletarEventos();
        else {
          await prisma.acaoIfood.updateMany({ where: { estado: "ENVIANDO", enviadaEm: { lt: new Date(Date.now() - 120000) } }, data: { estado: "INCERTA", erro: "Envio interrompido; aguardando evento/reconciliação" } });
          for (let n = 0; n < 20 && !parar; n++) if (!await processarEvento()) break;
          await recuperarAcoesIfood();
          await enviarAcao();
          await processarMerchant();
        }
      } catch { console.error("ifood.worker: falha local; consultar pendências no HUB."); }
      if (!umaVez && !parar) await setTimeout(1000);
    } while (!umaVez && !parar);
  } finally { await prisma.$disconnect(); }
}
void executar();
