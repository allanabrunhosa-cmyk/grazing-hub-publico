import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../.tmp/tabelas-fiscais-20261014/vite-cache"), optimizeDeps: { entries: ["fiscal-seletores.html"] }, resolve: { dedupe: ["react", "react-dom"], alias: { "@": caminho("../../src") } }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4491, strictPort: true } });
