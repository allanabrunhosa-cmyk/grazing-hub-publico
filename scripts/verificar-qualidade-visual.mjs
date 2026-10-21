import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { analisarQualidadeVisual } from "./regras-design.mjs";
import { compararBaseline } from "./baseline-design.mjs";

const raiz = process.cwd();
const problemas = [];
let consumidores = 0;
function visitar(pasta) {
  for (const item of readdirSync(resolve(raiz, pasta), { withFileTypes: true })) {
    const arquivo = `${pasta}/${item.name}`;
    if (item.isDirectory()) visitar(arquivo);
    else if (item.name.endsWith(".tsx")) {
      consumidores++;
      problemas.push(...analisarQualidadeVisual(arquivo, readFileSync(resolve(raiz, arquivo), "utf8")));
    }
  }
}
visitar("src/app"); visitar("src/components");
const baseline = JSON.parse(readFileSync(resolve(raiz, "docs/design-system/desvios-baseline.json"), "utf8"));
const resultado = compararBaseline(problemas, baseline);
if (process.argv.includes("--relatorio")) {
  console.log(JSON.stringify({ consumidores, ...resultado, problemas }, null, 2));
} else {
  console.log(`Qualidade visual: ${consumidores} arquivos; ${resultado.existentes} desvios históricos; ${resultado.novos.length} novos; ${resultado.resolvidos.reduce((s, p) => s + p.quantidade, 0)} resolvidos.`);
  for (const p of resultado.novos) console.error(`${p.arquivo}:${p.linha} [${p.regra}] ${p.mensagem}`);
}
if (resultado.resolvidos.length) {
  console.error("Há dívida resolvida: remova/reduza essas entradas por revisão no baseline, para impedir sua reintrodução.");
  if (!process.argv.includes("--relatorio")) for (const p of resultado.resolvidos) console.error(`${p.chave} ${p.arquivo} [${p.regra}] -${p.quantidade}`);
}
if (resultado.novos.length || resultado.resolvidos.length) process.exitCode = 1;
