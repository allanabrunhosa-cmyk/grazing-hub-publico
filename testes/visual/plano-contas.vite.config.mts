import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"),
  resolve: { alias: [
    { find: "./actions", replacement: caminho("./plano-contas-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4190, strictPort: true },
});

