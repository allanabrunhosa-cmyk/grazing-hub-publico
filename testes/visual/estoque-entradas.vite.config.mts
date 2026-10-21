import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracao from "./entrada-avulsa.vite.config.mjs";
const caminho = (nome: string) => fileURLToPath(new URL(nome, import.meta.url));
export default defineConfig({ ...configuracao, resolve: { alias: [
  { find: "next/navigation", replacement: caminho("./estoque-filtros-navegacao.tsx") },
  { find: "./actions", replacement: caminho("./estoque-entradas-acoes.ts") },
  { find: "./movimentacoes-actions", replacement: caminho("./estoque-entradas-acoes.ts") },
  { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./conversoes-acoes.ts") },
  { find: "@/app/(protegido)/insumos/insumo-dialog", replacement: caminho("../../src/app/(protegido)/insumos/insumo-dialog.tsx") },
  ...configuracao.resolve!.alias as { find: string; replacement: string }[],
] }, server: { host: "127.0.0.1", port: 4187, strictPort: true } });
