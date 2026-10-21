import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracaoBase from "./vite.config.mjs";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig(mergeConfig(configuracaoBase, {
  cacheDir: caminho("../../node_modules/.cache/vite-fornecedores-vinculos"),
  optimizeDeps: { entries: ["fornecedores-vinculos.html"] },
  plugins: [{
    name: "fornecedores-vinculos-fontes-isoladas",
    enforce: "pre",
    transform(fonte: string, id: string) {
      if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
      // Reutiliza os tokens sem examinar outros checkouts na prévia.
      return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
        .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/fornecedores";\n@source "../../testes/visual/fornecedores-vinculos.tsx";');
    },
  }],
  server: { host: "127.0.0.1", port: 4197, strictPort: true },
}));
