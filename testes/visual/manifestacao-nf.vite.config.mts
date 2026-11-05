import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
const acoes = caminho("./manifestacao-nf-acoes.ts");

export default defineConfig({
  ...base,
  cacheDir: caminho("../../.tmp/manifestacao-nf/vite"),
  optimizeDeps: { entries: ["manifestacao-nf.html"] },
  plugins: [{
    name: "manifestacao-nf-fontes-isoladas", enforce: "pre",
    transform(fonte, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
      return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/notas-fiscais";\n@source "./(protegido)/financeiro/manifesto-nfs";\n@source "../../testes/visual/manifestacao-nf.tsx";');
    },
  }],
  resolve: { alias: [
    { find: "@/app/(protegido)/notas-fiscais/actions", replacement: acoes },
    { find: /^\.\/aceitar-nota$/, replacement: acoes },
    { find: /^\.\/tratamento-local-actions$/, replacement: acoes },
    { find: "@/app/(protegido)/notas-fiscais/tratamento-local-actions", replacement: acoes },
    { find: "@/lib/notas-fiscais/api-cliente", replacement: acoes },
    ...(base.resolve?.alias as { find: string | RegExp; replacement: string }[]),
  ] },
  server: { host: "127.0.0.1", port: 4278, strictPort: true },
});
