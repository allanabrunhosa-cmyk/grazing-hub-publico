import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracao from "./vite.config.mjs";

export default defineConfig({
  ...configuracao,
  resolve: { alias: [
    { find: "@/app/(protegido)/notas-fiscais/actions", replacement: fileURLToPath(new URL("./busca-notas-acoes.ts", import.meta.url)) },
    ...configuracao.resolve!.alias as { find: string; replacement: string }[],
  ] },
  server: { host: "127.0.0.1", port: 4176, strictPort: true },
});
