import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const caminho = (arquivo: string) => fileURLToPath(new URL(arquivo, import.meta.url));

export default defineConfig({
  root: caminho("./"),
  publicDir: caminho("../../public"),
  cacheDir: caminho("../../.tmp/qualidade-visual-automatizada/vite"),
  optimizeDeps: { entries: [caminho("./qualidade.html")] },
  plugins: [{
    name: "qualidade-fontes-isoladas",
    enforce: "pre",
    transform(fonte, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
      // Mantém o CSS real, restringindo apenas a descoberta de utilitários.
      return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
        .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "../lib";\n@source "../../testes/visual/qualidade.tsx";');
    },
  }],
  resolve: { alias: [
    { find: "@/app/(protegido)/configuracoes/design/actions", replacement: caminho("./design-acoes.ts") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
    { find: "next/image", replacement: caminho("./imagem-simulada.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4238, strictPort: true },
});
