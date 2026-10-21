import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { processarFiscalSaida } from "@/lib/fiscal-saida/servico";
import { MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE, transmissaoBrasilNfeLiberada } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";
async function executar() {
  try { if (!transmissaoBrasilNfeLiberada()) { console.log(MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE); return; } for (let n = 0; n < 20; n++) { const r = await processarFiscalSaida(); if (!r.processado) { console.log(r.mensagem); break; } } }
  catch { console.error("Processamento fiscal de saída interrompido; conferir fila durável."); process.exitCode = 1; }
  finally { await prisma.$disconnect(); }
}
void executar();
