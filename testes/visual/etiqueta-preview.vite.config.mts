import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig({
  root: caminho("./"),
  publicDir: caminho("../../public"),
  resolve: { alias: { "@": caminho("../../src") } },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4185, strictPort: true },
});
