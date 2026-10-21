import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-estrutura-fiscal"), optimizeDeps: { entries: ["estrutura-fiscal.html"] }, resolve: { alias: [
  { find: /^(\.\.\/)+estrutura-actions$/, replacement: caminho("./estrutura-fiscal-acoes.ts") },
  { find: /^\.\/fiscal-actions$/, replacement: caminho("./estrutura-fiscal-pedido-acoes.ts") },
  { find: /^(\.\.\/){1,2}actions$/, replacement: caminho("./vinculos-fiscais-acoes.ts") },
  { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
  { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
  { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4461, strictPort: true } });
