import { mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default mergeConfig(base, {
  cacheDir: caminho("../../.tmp/fiscal-manual65-ui/vite-cache"),
  optimizeDeps: { entries: ["brasilnfe.html"] },
  server: { host: "127.0.0.1", port: 4496, strictPort: true },
});
