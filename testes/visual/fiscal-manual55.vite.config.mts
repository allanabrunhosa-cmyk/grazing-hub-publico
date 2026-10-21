import { mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import pedido from "./pedido-detalhe.vite.config.mjs";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default mergeConfig(pedido, {
  cacheDir: caminho("../../.tmp/fiscal-manual55-ui/vite-cache"), optimizeDeps: { entries: ["fiscal-manual55.html"] },
  resolve: { alias: [{ find: /^\.\/emissao-actions$/, replacement: caminho("./fiscal-manual55-acoes.ts") }] },
  build: { outDir: caminho("../../.tmp/fiscal-manual55-ui/vite-compilado"), emptyOutDir: false, rolldownOptions: { input: caminho("./fiscal-manual55.html") } },
  server: { host: "127.0.0.1", port: 4495, strictPort: true }, preview: { host: "127.0.0.1", port: 4495, strictPort: true },
});
