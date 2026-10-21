import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-vendas"), optimizeDeps: { entries: ["vendas.html"] }, plugins: [{
  name: "vendas-fontes-isoladas", enforce: "pre",
  transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/vendas";\n@source "./(protegido)/insumos";\n@source "../../testes/visual/vendas.tsx";');
  },
}], resolve: { alias: [
  { find: "@/app/(protegido)/vendas/produtos/embalagens-actions", replacement: caminho("./vendas-acoes.ts") },
  { find: "@/app/(protegido)/porcoes/actions", replacement: caminho("./porcoes-acoes.ts") },
  { find: /^\.\/cadastro-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\/cadastro-cliente-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\/credito-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: /^\.\/historico-actions$/, replacement: caminho("./clientes-acoes.ts") },
  { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./vendas-acoes.ts") },
  { find: /^\.\.\/actions$/, replacement: caminho("./vendas-acoes.ts") },
  { find: /^\.\/actions$/, replacement: caminho("./vendas-acoes.ts") },
  { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
  { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
  { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4218, strictPort: true } });
