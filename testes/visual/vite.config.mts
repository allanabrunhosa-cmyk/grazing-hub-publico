import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig({
  root: caminho("./"),
  resolve: { alias: [
    { find: "@/lib/vendas/cliente-identidade-http", replacement: caminho("./clientes-acoes.ts") },
    { find: "./importar-chave", replacement: caminho("./pagamentos-acoes.ts") },
    { find: "../status-cadastros-actions", replacement: caminho("./status-cadastros-acoes.ts") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "./baixar-nota", replacement: caminho("./baixa-nota-simulada.ts") },
    { find: "./conciliacao-actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "next/link", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "next/image", replacement: caminho("./imagem-simulada.tsx") },
    { find: "@/app/login/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/app/(protegido)/financeiro/bancario/actions", replacement: caminho("./contas-acoes-simuladas.ts") },
    { find: "@/app/(protegido)/inventario/contagem/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/app/(protegido)/fornecedores/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "./conciliar-fornecedor-actions", replacement: caminho("./fornecedor-nota-acoes.ts") },
    { find: "./aceitar-nota", replacement: caminho("./acoes-simuladas.ts") },
    { find: "./importar-xml", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/app/(protegido)/financeiro/lancamentos/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/app/(protegido)/financeiro/contas/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/app/(protegido)/notas-fiscais/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/app/(protegido)/producao/etiquetas/actions", replacement: caminho("./etiquetas-acoes.ts") },
    { find: "@/app/(protegido)/producao/etiquetas/pontos-actions", replacement: caminho("./pontos-acoes.ts") },
    { find: "./pontos-actions", replacement: caminho("./pontos-acoes.ts") },
    { find: "next/script", replacement: caminho("./etiquetas-script.tsx") },
    { find: "@/app/(protegido)/insumos/insumo-dialog", replacement: caminho("./insumo-simulado.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
