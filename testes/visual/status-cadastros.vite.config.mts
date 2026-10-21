import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";
const caminho = (nome: string) => fileURLToPath(new URL(nome, import.meta.url));
export default defineConfig({
  ...base,
  resolve: { alias: [
    { find: "../status-cadastros-actions", replacement: caminho("./status-cadastros-acoes.ts") },
    { find: "./actions", replacement: caminho("./plano-contas-acoes.ts") },
    { find: "@/app/(protegido)/insumos/actions", replacement: caminho("./acoes-simuladas.ts") },
    ...base.resolve!.alias as { find: string; replacement: string }[],
  ] },
  server: { host: "127.0.0.1", port: 4193, strictPort: true },
});
