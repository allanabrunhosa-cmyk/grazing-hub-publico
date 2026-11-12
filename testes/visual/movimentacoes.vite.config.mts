import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
export default defineConfig({
  ...base,
  cacheDir: caminho("../../.tmp/manifesto-movimentacoes-20261111/vite-movimentacoes"),
  optimizeDeps: { entries: ["movimentacoes.html"] },
  plugins: [{
    name: "movimentacoes-fontes-isoladas", enforce: "pre",
    transform(fonte, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
      return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
        .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/financeiro/movimentacoes";\n@source "./(protegido)/financeiro/lancamentos";\n@source "../../testes/visual/movimentacoes.tsx";');
    },
  }],
  server: { host: "127.0.0.1", port: 4389, strictPort: true },
});
