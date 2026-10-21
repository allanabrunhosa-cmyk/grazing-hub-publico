import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), publicDir: caminho("../../public"), cacheDir: caminho("../../node_modules/.cache/vite-pedidos"), optimizeDeps: { entries: ["pedidos.html"] }, plugins: [{ name: "pedidos-fontes-isoladas", enforce: "pre", transform(fonte, id) {
  if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
  return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/vendas";\n@source "../../testes/visual/pedidos.tsx";');
} }], build: { outDir: caminho("../../.tmp-pedidos-preview"), emptyOutDir: false, rolldownOptions: { input: caminho("./pedidos.html") } }, resolve: { alias: [
  { find: /^\.\/resumo-pedido-actions$/, replacement: caminho("./resumo-pedido-acoes.ts") },
  { find: /^\.\/actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/cadastro-cliente-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/entregas-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/custos-entrega-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^.*embalagens-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: "next/navigation", replacement: caminho("./gestor-navegacao.tsx") },
  { find: "next/image", replacement: caminho("./imagem-simulada.tsx") },
  { find: "next/link", replacement: caminho("./navegacao-simulada.tsx") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4231, strictPort: true } });
