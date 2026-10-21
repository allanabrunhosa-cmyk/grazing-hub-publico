import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"), cacheDir: caminho("../../.tmp-vite-exclusao"), optimizeDeps: { entries: ["exclusao-insumos.html"] },
  resolve: { alias: [
    { find: "@/app/(protegido)/inventario/contagem/actions", replacement: caminho("./inventario-design-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "next/link", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./exclusao-insumos-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  plugins: [{ name: "exclusao-insumos-fontes-isoladas", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
      .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/insumos";\n@source "./(protegido)/inventario/contagem";\n@source "../../testes/visual/exclusao-insumos.tsx";\n@source "../../testes/visual/contagem-homologados.tsx";');
  } }],
  css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4248, strictPort: true },
});
