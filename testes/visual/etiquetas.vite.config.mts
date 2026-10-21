import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (arquivo: string) => fileURLToPath(new URL(arquivo, import.meta.url));
export default defineConfig({
  define: { "process.env.NEXT_PUBLIC_BROWSER_PRINT_SCRIPT_URL": "undefined" },
  root: caminho("./"),
  publicDir: caminho("../../public"),
  optimizeDeps: { entries: ["etiquetas.html"] },
  resolve: { alias: [
    { find: "./operacao-actions", replacement: caminho("./etiquetas-operacao-acoes.ts") },
    { find: "./pontos-actions", replacement: caminho("./etiquetas-pontos-acoes.ts") },
    { find: "@/app/(protegido)/producao/etiquetas/pontos-actions", replacement: caminho("./etiquetas-pontos-acoes.ts") },
    { find: "@/app/(protegido)/producao/etiquetas/actions", replacement: caminho("./etiquetas-acoes.ts") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "next/script", replacement: caminho("./etiquetas-script.tsx") },
    { find: "next/navigation", replacement: caminho("./etiquetas-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./etiquetas-navegacao.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4199, strictPort: true },
});
