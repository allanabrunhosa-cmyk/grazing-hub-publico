import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./compras.vite.config.mjs";
const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
export default defineConfig({ ...base, resolve: { alias: [
  { find: "@/app/(protegido)/insumos/insumo-dialog", replacement: caminho("../../src/app/(protegido)/insumos/insumo-dialog.tsx") },
  { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./conversoes-acoes.ts") },
  ...base.resolve!.alias as { find: string; replacement: string }[],
] }, server: { host: "127.0.0.1", port: 4184, strictPort: true } });
