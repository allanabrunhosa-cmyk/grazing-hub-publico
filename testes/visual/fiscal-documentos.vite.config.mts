import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./fiscal-dashboard.vite.config.mjs";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
export default defineConfig({
  ...base,
  cacheDir: caminho("../../.tmp/fiscal-dashboard-documentos-datas-20261113/vite"),
  plugins: [{
    name: "fiscal-documentos-fontes-isoladas", enforce: "pre",
    transform(fonte, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
      return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
        .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/financeiro/fiscal";\n@source "../../testes/visual/fiscal-layout.tsx";\n@source "../../testes/visual/fiscal-dashboard.tsx";');
    },
  }],
  server: { host: "127.0.0.1", port: 4448, strictPort: true },
});
