import "dotenv/config";
import { sincronizarDistribuicaoNFe } from "../src/lib/sefaz/sincronizar.ts";

const MAX_LOTES = 3; // conforme pedido: comece com poucos lotes por execução pra não tomar 656

console.log(`Consultando distribuição de NF-e (até ${MAX_LOTES} lote(s))...`);

const resumo = await sincronizarDistribuicaoNFe(MAX_LOTES);

console.log("");
console.log(`Lotes consultados: ${resumo.lotesConsultados}`);
console.log(`cStat final: ${resumo.cStatFinal} — ${resumo.xMotivoFinal}`);
console.log(`Novas notas: ${resumo.novos} | já existiam: ${resumo.jaExistentes} | ignoradas (eventos): ${resumo.ignorados}`);
console.log(`Motivo da parada: ${resumo.motivoParada}`);

if (resumo.motivoParada === "BLOQUEIO") {
  console.log("");
  console.log("⚠️  A SEFAZ pediu pra esperar (137 = sem novidade, 656 = uso indevido). Aguarde 1h antes de rodar de novo.");
}

if (resumo.notasNovas.length > 0) {
  console.log("");
  console.log("Notas novas encontradas:");
  console.log("");
  console.log("Fornecedor".padEnd(40), "Valor".padStart(12), "  Data emissão");
  console.log("-".repeat(70));
  for (const nota of resumo.notasNovas) {
    const fornecedor = (nota.fornecedorNome ?? "—").slice(0, 39).padEnd(40);
    const valor = nota.valorTotal != null ? `R$ ${nota.valorTotal.toFixed(2)}` : "—";
    const data = nota.dataEmissao ? nota.dataEmissao.toLocaleDateString("pt-BR") : "—";
    console.log(fornecedor, valor.padStart(12), "  " + data);
  }
}

process.exit(0);
