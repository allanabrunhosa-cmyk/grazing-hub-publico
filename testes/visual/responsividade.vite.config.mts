import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";
const caminho = (arquivo: string) => fileURLToPath(new URL(arquivo, import.meta.url));
export default defineConfig(mergeConfig(base, {
  cacheDir: caminho("../../node_modules/.cache/vite-responsividade"),
  optimizeDeps: { entries: ["responsividade.html"] },
  resolve: { alias: [
    { find: "next/navigation", replacement: caminho("./responsividade-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./responsividade-navegacao.tsx") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./responsividade-acoes.ts") },
  ] },
  plugins: [{ name: "responsividade-fontes-isoladas", enforce: "pre", transform(fonte: string, id: string) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
      .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)";\n@source "../../testes/visual/responsividade.tsx";');
  } }],
  server: { host: "127.0.0.1", port: 4227, strictPort: true },
}));
