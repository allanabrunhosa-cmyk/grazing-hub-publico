import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig({
  root: caminho("./"),
  resolve: { alias: [
    { find: "@/app/(protegido)/inventario/perdas/perda-dialog", replacement: caminho("./posicao-atual-perda-simulada.tsx") },
    { find: "@/app/(protegido)/insumos/insumo-dialog", replacement: caminho("./insumo-simulado.tsx") },
    { find: "../status-cadastros-actions", replacement: caminho("./status-cadastros-acoes.ts") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./acoes-simuladas.ts") },
    { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "@/app/(protegido)/inventario/perdas/actions", replacement: caminho("./posicao-atual-acoes.ts") },
    { find: "@/app/(protegido)/inventario/historico-insumo-actions", replacement: caminho("./posicao-atual-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4182, strictPort: true },
});
