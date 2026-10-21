import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const porta = Number(process.env.FISCAL_PEDIDO_VISUAL_PORT ?? "4258");
if (![4258, 4458].includes(porta)) throw new Error("Porta da prévia sintética fora do contrato local.");
export default defineConfig({ root: caminho("./"), publicDir: caminho("../../public"), cacheDir: caminho("../../node_modules/.cache/vite-pedido-detalhe"), optimizeDeps: { entries: ["pedido-detalhe.html"] }, plugins: [{ name: "pedidos-fontes-isoladas", enforce: "pre", transform(fonte, id) {
  if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
  return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/vendas";\n@source "../../testes/visual/pedido-detalhe.tsx";');
} }], build: { outDir: caminho("../../.tmp-pedidos-preview"), emptyOutDir: false, rolldownOptions: { input: caminho("./pedido-detalhe.html") } }, resolve: { alias: [
  { find: /^\.\/resumo-pedido-actions$/, replacement: caminho("./resumo-pedido-acoes.ts") },
  { find: /^\.\/gestor-actions$/, replacement: caminho("./gestor-acoes.ts") },
  { find: /^\.\/emissao-actions$/, replacement: caminho("./pedido-fiscal-acoes.ts") },
  { find: /^\.\/actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/cadastro-cliente-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/entregas-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^\.\/custos-entrega-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: /^.*embalagens-actions$/, replacement: caminho("./pedidos-acoes.ts") },
  { find: "next/navigation", replacement: caminho("./gestor-navegacao.tsx") },
  { find: "next/image", replacement: caminho("./imagem-simulada.tsx") },
  { find: "next/link", replacement: caminho("./navegacao-simulada.tsx") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: porta, strictPort: true } });

