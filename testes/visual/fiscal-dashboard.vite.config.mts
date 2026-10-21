import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: caminho("./"), cacheDir: caminho("../../.tmp/fiscal-dashboard/vite-cache"), optimizeDeps: { entries: ["fiscal-dashboard.html"] },
  resolve: { alias: [
    { find: "@/app/(protegido)/financeiro/fiscal/documento-actions", replacement: caminho("./fiscal-documento-acoes.ts") },
    { find: "@/app/(protegido)/configuracoes/actions", replacement: caminho("./fiscal-certificado-acoes.ts") },
    { find: "@/app/(protegido)/vendas/pedidos/link-pedido-protegido", replacement: caminho("./fiscal-dashboard-navegacao.tsx") },
    { find: "next/navigation", replacement: caminho("./fiscal-dashboard-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./fiscal-dashboard-navegacao.tsx") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    { find: "@", replacement: caminho("../../src") },
  ] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4448, strictPort: true },
});
