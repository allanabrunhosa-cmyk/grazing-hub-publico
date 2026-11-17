import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"), cacheDir: caminho("../../.tmp/parcelamento-cartao/vite"),
  optimizeDeps: { entries: ["parcelamento-cartao.html"] },
  resolve: { alias: { "@": caminho("../../src") } },
  css: { postcss: caminho("../../") },
  plugins: [{ name: "parcelamento-fontes-isoladas", enforce: "pre", transform(fonte, id) {
    if (id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../components";\n@source "./(protegido)/notas-fiscais";\n@source "../../testes/visual/parcelamento-cartao.tsx";');
  } }],
  server: { host: "127.0.0.1", port: 4285, strictPort: true },
});
