import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-vinculos-fiscais"),
  optimizeDeps: { entries: ["vinculos-fiscais.html"] },
  resolve: { alias: [
    { find: /^(\.\.\/){1,2}actions$/, replacement: caminho("./vinculos-fiscais-acoes.ts") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4427, strictPort: true },
});
