import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const p = (s: string) => fileURLToPath(new URL(s, import.meta.url));
export default defineConfig({ root: p("./"), cacheDir: p("../../.tmp/fiscal-unificado/vite-cache"), optimizeDeps: { entries: ["fiscal-unificado.html"] }, resolve: { dedupe: ["react", "react-dom"], alias: [
  { find: /^(?:.*\/)?simples-actions$/, replacement: p("./fiscal-unificado-simples-acoes.ts") },
  { find: /^(\.\.?\/)+manutencao-actions$/, replacement: p("./fiscal-unificado-acoes.ts") },
  { find: /^(\.\.\/)+estrutura-actions$/, replacement: p("./estrutura-fiscal-acoes.ts") },
  { find: /^(\.\.?\/)+actions$/, replacement: p("./fiscal-unificado-vendas-acoes.ts") },
  { find: "@/app/(protegido)/configuracoes/actions", replacement: p("./fiscal-certificado-acoes.ts") },
  { find: "@/app/login/actions", replacement: p("./layout-acoes.ts") },
  { find: "next/navigation", replacement: p("./fiscal-unificado-navegacao.tsx") },
  { find: "next/link", replacement: p("./fiscal-unificado-navegacao.tsx") },
  { find: "@", replacement: p("../../src") },
] }, css: { postcss: p("../../") }, server: { host: "127.0.0.1", port: 4269, strictPort: true } });
