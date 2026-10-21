import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { analisarDesign } from "./regras-design.mjs";

const raiz = process.cwd();
const verificacoes = [
  { arquivo: "src/components/ui/button.tsx", proibidos: ["rounded-full", "h-11", "h-8", "duration-150"], esperado: ["--ds-botao-raio", "--ds-controle-altura", "--ds-movimento-rapido"] },
  { arquivo: "src/components/ui/input.tsx", proibidos: ["rounded-md", "h-11"], esperado: ["--ds-controle-altura", "--ds-controle-raio", "--ds-movimento-rapido"] },
  { arquivo: "src/components/ui/select.tsx", proibidos: ["rounded-md", "h-11", "h-8"], esperado: ["--ds-controle-altura", "--ds-controle-raio", "--ds-popup-raio"] },
  { arquivo: "src/components/ui/combobox.tsx", proibidos: ["rounded-md", "h-11"], esperado: ["--ds-controle-altura", "--ds-controle-raio", "--ds-popup-raio"] },
  { arquivo: "src/components/ui/dialog.tsx", proibidos: ["rounded-xl", "duration-150"], esperado: ["--ds-dialogo-raio", "--ds-movimento-rapido"] },
  { arquivo: "src/components/ui/card.tsx", proibidos: ["rounded-xl"], esperado: ["--ds-cartao-raio"] },
  { arquivo: "src/components/ui/tabs.tsx", proibidos: ["rounded-lg", "rounded-md"], esperado: ["--ds-aba-raio", "--ds-movimento-rapido"] },
  { arquivo: "src/components/ui/dropdown-menu.tsx", proibidos: ["rounded-lg", "duration-100"], esperado: ["--ds-popup-raio", "--ds-movimento-rapido"] },
];

const problemas = [];
for (const verificacao of verificacoes) {
  const conteudo = readFileSync(resolve(raiz, verificacao.arquivo), "utf8");
  for (const termo of verificacao.proibidos) {
    if (conteudo.includes(termo)) problemas.push(verificacao.arquivo + ": valor local protegido encontrado (" + termo + ").");
  }
  for (const termo of verificacao.esperado) {
    if (!conteudo.includes(termo)) problemas.push(verificacao.arquivo + ": token obrigatório ausente (" + termo + ").");
  }
}

let consumidores = 0;
function visitar(pasta) {
  for (const item of readdirSync(resolve(raiz, pasta), { withFileTypes: true })) {
    const arquivo = pasta + "/" + item.name;
    if (item.isDirectory()) visitar(arquivo);
    else if (item.name.endsWith(".tsx") && arquivo !== "src/components/ui/button.tsx") {
      consumidores++;
      problemas.push(...analisarDesign(arquivo, readFileSync(resolve(raiz, arquivo), "utf8"))
        .map(p => `${p.arquivo}:${p.linha} [${p.regra}] ${p.mensagem}`));
    }
  }
}
visitar("src/app");
visitar("src/components");

if (problemas.length) {
  console.error("Verificação de tokens de design falhou:\n" + problemas.map(item => "- " + item).join("\n"));
  process.exit(1);
}

console.log(`Verificação de design concluída (${verificacoes.length} bases; ${consumidores} consumidores TSX).`);
