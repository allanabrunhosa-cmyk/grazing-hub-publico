import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";
const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
export default mergeConfig(base, defineConfig({
  resolve: { alias: [
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./conversoes-acoes.ts") },
    { find: "@/app/(protegido)/compras/actions", replacement: caminho("./compras-acoes-simuladas.ts") },
  ] },
  server: { port: 4177 },
}));
