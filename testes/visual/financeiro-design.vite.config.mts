import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./inventario-design.vite.config.mjs";
const caminho = (nome: string) => fileURLToPath(new URL(nome, import.meta.url));
export default defineConfig({ ...base,
  optimizeDeps: { entries: ["financeiro-design.html"] },
  resolve: { alias: [
    { find: "./actions", replacement: caminho("./plano-contas-acoes.ts") },
    { find: "./cartoes-actions", replacement: caminho("./financeiro-design-acoes.ts") },
    { find: "@/app/(protegido)/financeiro/bancario/actions", replacement: caminho("./financeiro-design-acoes.ts") },
    ...base.resolve!.alias as { find: string; replacement: string }[],
  ] },
  server: { host: "127.0.0.1", port: 4223, strictPort: true },
});
