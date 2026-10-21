import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: caminho("./"), cacheDir: caminho("../../node_modules/.cache/vite-porcoes"), optimizeDeps: { entries: ["porcoes.html", "decimal-padrao.html"] },
  resolve: { alias: [
    { find: /^\.\/actions$/, replacement: caminho("./porcoes-acoes.ts") },
    { find: "@/app/(protegido)/porcoes/actions", replacement: caminho("./porcoes-acoes.ts") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./porcoes-acoes.ts") },
    { find: /^\.\.\/actions$/, replacement: caminho("./porcoes-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "@/lib/insumos/consulta-porcoes-cliente", replacement: caminho("./porcoes-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  plugins: [{ name: "porcoes-fontes-isoladas", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
      .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/porcoes";\n@source "./(protegido)/insumos";\n@source "./(protegido)/vendas/lista-ordenavel.tsx";\n@source "../../testes/visual/porcoes.tsx";\n@source "../../testes/visual/decimal-padrao.tsx";\n@source "./(protegido)/vendas/formas-pagamento";');
  } }],
  css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4238, strictPort: true },
});
