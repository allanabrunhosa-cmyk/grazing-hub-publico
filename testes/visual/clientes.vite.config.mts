import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-clientes"), optimizeDeps: { entries: ["clientes.html"] }, plugins: [{
  name: "clientes-fontes-isoladas", enforce: "pre",
  transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    // Mesmos tokens; a prévia não precisa examinar outros checkouts/artefatos locais.
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/vendas";\n@source "../../testes/visual/clientes.tsx";');
  },
}], resolve: { alias: [
  { find: /^\.\/cadastro-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\/cadastro-cliente-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\/credito-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\/historico-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\.\/actions$/, replacement: caminho("./vendas-acoes.ts") },
  { find: /^\.\/actions$/, replacement: caminho("./vendas-acoes.ts") },
  { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
  { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, build: { outDir: caminho("../../.tmp-clientes-preview"), emptyOutDir: false, rolldownOptions: { input: caminho("./clientes.html") } }, server: { host: "127.0.0.1", port: 4229, strictPort: true }, preview: { host: "127.0.0.1", port: 4229, strictPort: true } });
