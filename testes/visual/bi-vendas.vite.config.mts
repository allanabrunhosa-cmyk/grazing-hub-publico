import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  define: { "process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY": JSON.stringify("") },
  root: caminho("./"), cacheDir: caminho("../../.tmp/bi-vendas/vite-cache"), optimizeDeps: { entries: ["bi-vendas.html"] },
  plugins: [{ name: "bi-fontes-isoladas", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "../../testes/visual/bi-vendas.tsx";');
  } }],
  resolve: { alias: [
    { find: "@/app/(protegido)/vendas/pedidos/link-pedido-protegido", replacement: caminho("./bi-vendas-navegacao.tsx") },
    { find: "next/navigation", replacement: caminho("./bi-vendas-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./bi-vendas-navegacao.tsx") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4452, strictPort: true },
});
