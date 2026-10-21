import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({ root: caminho("./"), resolve: { alias: [
  { find: "./recuperacao-actions", replacement: caminho("./login-acoes.ts") },
  { find: "@/app/login/actions", replacement: caminho("./login-acoes.ts") },
  { find: "next/link", replacement: caminho("./login-links.tsx") },
  { find: "@", replacement: caminho("../../src") },
] }, css: { postcss: caminho("../../") }, server: { host: "127.0.0.1", port: 4194, strictPort: true } });
