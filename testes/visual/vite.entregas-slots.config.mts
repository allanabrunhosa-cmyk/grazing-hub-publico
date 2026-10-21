import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig({
  root: caminho("./"),
  resolve: { alias: [
    { find: "next/image", replacement: caminho("./imagem-simulada.tsx") },
    { find: "@/app/(protegido)/configuracoes/actions", replacement: caminho("./entregas-slots-acoes.ts") },
    { find: "@/app/(protegido)/vendas/area-entrega/actions", replacement: caminho("./entregas-slots-acoes.ts") },
    { find: "@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", replacement: caminho("./entregas-slots-acoes.ts") },
    { find: "./cadastro-cliente-actions", replacement: caminho("./entregas-slots-acoes.ts") },
    { find: "./entregas-actions", replacement: caminho("./entregas-slots-acoes.ts") },
    { find: "./actions", replacement: caminho("./entregas-slots-acoes.ts") },
    { find: "next/navigation", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "next/link", replacement: caminho("./navegacao-simulada.tsx") },
    { find: "@", replacement: caminho("../../src") },
  ] },
  css: { postcss: caminho("../../") },
  server: { host: "127.0.0.1", port: 4237, strictPort: true },
});
