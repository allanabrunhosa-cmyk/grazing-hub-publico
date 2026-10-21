import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracao from "./layout.vite.config.mjs";

export default defineConfig({
  ...configuracao,
  resolve: { alias: [
    { find: "@/app/(protegido)/inventario/perdas/actions", replacement: fileURLToPath(new URL("./perdas-acoes-simuladas.ts", import.meta.url)) },
    ...configuracao.resolve!.alias as { find: string; replacement: string }[],
  ] },
  server: { host: "127.0.0.1", port: 4181, strictPort: true },
});
