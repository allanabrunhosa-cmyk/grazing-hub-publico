import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (arquivo: string) => fileURLToPath(new URL(arquivo, import.meta.url));
export default defineConfig({
  root: caminho("./"),
  cacheDir: caminho("../../.tmp-campos/vite-cache"),
  optimizeDeps: { entries: [caminho("./campos-bloqueados.html")] },
  plugins: [{ name: "campos-bloqueados-isolados", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "../../testes/visual/campos-bloqueados.tsx";');
  } }],
  resolve: { alias: { "@": caminho("../../src") } },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4237, strictPort: true },
});
