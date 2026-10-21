import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (nome: string) => fileURLToPath(new URL(nome, import.meta.url));
export default defineConfig({
  root: caminho("./"), publicDir: caminho("../../public"),
  optimizeDeps: { entries: ["inventario-design.html"] },
  resolve: { alias: [
    { find: "./categorias-actions", replacement: caminho("./inventario-design-acoes.ts") },
    ...["inventario/actions", "inventario/perdas/categorias-actions", "inventario/contagem/actions"].map(nome => ({ find: `@/app/(protegido)/${nome}`, replacement: caminho("./inventario-design-acoes.ts") })),
    { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4222, strictPort: true },
});
