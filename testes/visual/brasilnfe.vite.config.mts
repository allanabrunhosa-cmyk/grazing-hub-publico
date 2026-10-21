import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-brasilnfe"), optimizeDeps: { entries: ["brasilnfe.html"] }, resolve: { alias: [{ find: "@", replacement: caminho("../../src") }] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4439, strictPort: true } });
