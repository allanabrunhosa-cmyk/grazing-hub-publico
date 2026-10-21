import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: caminho("./"),
  cacheDir: caminho("../../node_modules/.cache/vite-edicao-cadastros"),
  optimizeDeps: { entries: ["edicao-cadastros.html"] },
  resolve: { alias: [
    { find: "../status-cadastros-actions", replacement: caminho("./status-cadastros-acoes.ts") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./edicao-cadastros-acoes.ts") },
    { find: "@/app/(protegido)/fornecedores/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "@/lib/insumos/consulta-porcoes-cliente", replacement: caminho("./porcoes-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  plugins: [{ name: "edicao-cadastros-fontes-isoladas", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
      .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/insumos";\n@source "./(protegido)/fornecedores";\n@source "../../testes/visual/edicao-cadastros.tsx";');
  } }],
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4243, strictPort: true },
});
