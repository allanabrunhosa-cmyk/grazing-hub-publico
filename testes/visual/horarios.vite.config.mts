import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-horarios"), optimizeDeps: { entries: ["horarios.html"] }, resolve: { alias: [
  { find: /^\.\/actions$/, replacement: caminho("./horarios-acoes.ts") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4236, strictPort: true } });
