import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), publicDir: caminho("../../public"), cacheDir: caminho("../../.cache/gestor-vite"), optimizeDeps: { entries: ["gestor.html"] }, plugins: [{ name: "gestor-fontes-isoladas", enforce: "pre", transform(fonte, id) {
  if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
  return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/vendas";\n@source "../../testes/visual/gestor.tsx";');
} }], resolve: { alias: [
  { find: /^\.\/resumo-pedido-actions$/, replacement: caminho("./resumo-pedido-acoes.ts") },
  { find: /^\.\/gestor-actions$/, replacement: caminho("./gestor-acoes.ts") },
  { find: /^\.\/actions$/, replacement: caminho("./gestor-pedidos-acoes.ts") },
  { find: /^\.\/cadastro-cliente-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/entregas-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/custos-entrega-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^.*embalagens-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
  { find: "next/navigation", replacement: caminho("./gestor-navegacao.tsx") },
  { find: "next/image", replacement: caminho("./imagem-simulada.tsx") },
  { find: "next/link", replacement: caminho("./gestor-link.tsx") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4245, strictPort: true } });
