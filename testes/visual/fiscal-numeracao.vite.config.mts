import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), cacheDir: caminho("../../.tmp/fiscal-numeracao/vite-cache"), optimizeDeps: { entries: ["fiscal-numeracao.html"] },
  resolve: { dedupe: ["react", "react-dom"], alias: [{ find: "next/navigation", replacement: caminho("./fiscal-dashboard-navegacao.tsx") }, { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") }, { find: "@/app/(protegido)/configuracoes/actions", replacement: caminho("./fiscal-certificado-acoes.ts") }, { find: "next/link", replacement: caminho("./fiscal-dashboard-navegacao.tsx") }, { find: "@", replacement: caminho("../../src") }] },
  css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4494, strictPort: true },
});
