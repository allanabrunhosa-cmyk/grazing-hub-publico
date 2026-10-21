import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"), cacheDir: caminho("../../.tmp/permissoes-atendimento-20261021/vite-cache"),
  optimizeDeps: { entries: ["permissoes-atendimento.html"] },
  plugins: [{ name: "permissoes-fontes-isoladas", enforce: "pre", transform(fonte, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
    return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
      .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "../app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx";\n@source "../../testes/visual/permissoes-atendimento.tsx";');
  } }],
  resolve: { alias: [{ find: "@", replacement: caminho("../../src") }] },
  css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4459, strictPort: true },
});
