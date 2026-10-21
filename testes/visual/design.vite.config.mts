import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const caminho = (arquivo: string) => fileURLToPath(new URL(arquivo, import.meta.url));
export default defineConfig({
  root: caminho("./"),
  cacheDir: caminho("../../node_modules/.cache/vite-design"),
  optimizeDeps: { entries: [caminho("./design.html")] },
  plugins: [{ name: "laboratorio-design-isolado", configureServer(servidor) {
    servidor.middlewares.use((req, _res, next) => {
      if (req.url?.split("?")[0] === "/configuracoes/design/laboratorio") req.url = "/design.html?laboratorio";
      next();
    });
  } }],
  resolve: { alias: [
    { find: "@/app/(protegido)/configuracoes/design/actions", replacement: caminho("./design-acoes.ts") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4220, strictPort: true },
});
