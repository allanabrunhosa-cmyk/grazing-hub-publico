import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"), publicDir: caminho("../../public"), cacheDir: caminho("../../.tmp-integracoes/vite-cache"), optimizeDeps: { entries: [caminho("./integracoes-asaas-site.html")] },
  plugins: [{ name: "integracoes-visual-isolado", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/configuracoes/integracoes";\n@source "./(protegido)/vendas/pedidos/cobranca-asaas.tsx";\n@source "../../testes/visual/integracoes-asaas-site.tsx";');
  } }],
  resolve: { alias: [{ find: "./actions", replacement: caminho("./mcp-acoes.ts") }, { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") }, { find: "next/link", replacement: caminho("./navegacao-simulada.tsx") }, { find: "@", replacement: caminho("../../src") }] },
  css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4263, strictPort: true },
});
